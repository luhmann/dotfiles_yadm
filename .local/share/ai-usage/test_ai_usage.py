import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone


SCRIPT = Path(os.environ.get("AI_USAGE_BIN", Path.home() / ".local" / "bin" / "ai-usage"))


def load(path):
    loader = importlib.machinery.SourceFileLoader("ai_usage", str(path))
    module = importlib.util.module_from_spec(importlib.util.spec_from_loader(loader.name, loader))
    loader.exec_module(module)
    return module


render = load(SCRIPT).render


NOW = datetime(2026, 9, 19, 8, 30, tzinfo=timezone.utc)


class RenderingTests(unittest.TestCase):
    def test_dynamic_model_quota_and_private_identity(self):
        data = [{"provider": "claude", "source": "web", "usage": {
            "accountEmail": "private@example.com", "loginMethod": "Max 5x",
            "extraRateWindows": [{"title": "Fable only", "window": {
                "usedPercent": 2, "windowMinutes": 10080,
                "resetsAt": "2026-09-26T01:00:00Z"}}]}}]

        output = render(data, now=NOW)

        self.assertIn("Fable only · weekly", output)
        self.assertIn("2%", output)
        self.assertIn("6d 16h", output)
        self.assertNotIn("private@example.com", output)
        self.assertNotIn("\033[", output)

    def test_duplicate_weekly_windows_are_not_called_session(self):
        data = [{"provider": "codex", "usage": {
            "primary": {"usedPercent": 12, "windowMinutes": 10080, "resetsAt": "2026-09-25T09:13:10Z"},
            "secondary": {"usedPercent": 12, "windowMinutes": 10080, "resetsAt": "2026-09-25T09:13:31Z"}}}]

        output = render(data, now=NOW)

        self.assertEqual(output.count("12%"), 1)
        self.assertIn("Matching weekly windows merged", output)
        self.assertNotIn("Session", output)

    def test_distinct_weekly_windows_are_preserved(self):
        data = [{"provider": "codex", "usage": {
            "primary": {"usedPercent": 12, "windowMinutes": 10080, "resetsAt": "2026-09-25T09:13:10Z"},
            "secondary": {"usedPercent": 13, "windowMinutes": 10080, "resetsAt": "2026-09-25T09:13:31Z"}}}]

        output = render(data, now=NOW)

        self.assertIn("12%", output)
        self.assertIn("13%", output)
        self.assertNotIn("merged", output)

    def test_missing_values_are_not_zero_and_past_reset_is_explicit(self):
        data = [{"provider": "claude", "usage": {
            "primary": {"windowMinutes": 300},
            "secondary": {"usedPercent": 100, "resetsAt": "2026-09-18T00:00:00Z"}}}]

        output = render(data, now=NOW)

        self.assertIn("—", output)
        self.assertIn("due now", output)
        self.assertIn("100%", output)

    def test_details_show_history_without_money_conversion(self):
        data = [{"provider": "codex", "openaiDashboard": {"usageBreakdown": [
            {"day": "2026-09-18", "totalCreditsUsed": 44.22,
             "services": [{"service": "Unknown", "creditsUsed": 44.22}]}]}}]

        compact = render(data, now=NOW)
        detailed = render(data, now=NOW, details=True)

        self.assertNotIn("44.22", compact)
        self.assertIn("2026-09-18  44.22", detailed)
        self.assertIn("Unknown: 44.22", detailed)
        self.assertNotIn("$", detailed)

    def test_partial_failure_preserves_healthy_provider(self):
        data = [{"provider": "codex", "error": "Sign in required"},
                {"provider": "claude", "usage": {"primary": {"usedPercent": 14}}}]

        output = render(data, now=NOW)

        self.assertIn("Sign in required", output)
        self.assertIn("14%", output)


class CommandTests(unittest.TestCase):
    def test_command_passes_source_and_preserves_failure_and_raw_json(self):
        data = [{"provider": "codex", "error": "Sign in required"},
                {"provider": "claude", "usage": {"primary": {"usedPercent": 14}}}]
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "codexbar"
            executable.write_text(f"#!{sys.executable}\nimport sys\nassert sys.argv[1:] == ['usage', '--provider', 'both', '--source', 'web', '--format', 'json']\nprint({json.dumps(data)!r})\nsys.exit(2)\n")
            executable.chmod(0o700)
            environment = {**os.environ, "PATH": directory + os.pathsep + os.environ.get("PATH", "")}
            command = [sys.executable, str(SCRIPT)]

            rendered = subprocess.run(command, env=environment, text=True, capture_output=True)
            raw = subprocess.run(command + ["--json"], env=environment, text=True, capture_output=True)

        self.assertEqual(rendered.returncode, 2)
        self.assertIn("14%", rendered.stdout)
        self.assertIn("Sign in required", rendered.stdout)
        self.assertEqual(raw.returncode, 2)
        self.assertEqual(json.loads(raw.stdout), data)


if __name__ == "__main__":
    unittest.main()
