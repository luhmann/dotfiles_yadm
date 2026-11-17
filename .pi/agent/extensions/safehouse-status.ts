import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const isSandboxed = () => process.env.APP_SANDBOX_CONTAINER_ID === "agent-safehouse";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const theme = ctx.ui.theme;
		ctx.ui.setStatus(
			"security",
			`· ${isSandboxed() ? theme.fg("dim", "sandboxed") : theme.fg("warning", "unsandboxed")}`,
		);
	});
}
