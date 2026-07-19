import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const RESEARCH_PATTERN = /\bresearch\b/i;

const DIRECTIVE = `[research-guard: This is a research request. Do not shortcut to a single web_search call. Instead:
1. Query both backends in parallel (same turn, independent calls): the web_search tool with 2-4 varied query angles via queries, and kagi search "<query>" --limit 10 via bash.
2. Use fetch_content to read the most promising sources the searches surface — do not rely only on the synthesized search snippets.
3. Synthesize the combined results: cross-check claims across backends, prefer agreeing sources, cite URLs for non-obvious claims, and distill rather than dumping raw output.]`;

export default function (pi: ExtensionAPI) {
  pi.on("input", (event) => {
    if (event.source === "extension") return { action: "continue" as const };

    if (!RESEARCH_PATTERN.test(event.text ?? "")) {
      return { action: "continue" as const };
    }

    return {
      action: "transform" as const,
      text: event.text + "\n\n" + DIRECTIVE,
    };
  });
}
