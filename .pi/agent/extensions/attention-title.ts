import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Changes the terminal title to include a 🔴 indicator when pi
 * is idle and waiting for input. Clears when you start typing.
 *
 * Ghostty (and most terminals) show the title in the tab/title bar,
 * so you can spot at a glance which pane needs attention.
 */
export default function (pi: ExtensionAPI) {
	const INDICATOR = "🔴 ";

	let baseTitle = "π";

	// Capture the base title whenever pi sets it
	// (pi sets title on session start/switch as "π - session - dir")
	function setAttention(ctx: { ui: { setTitle(t: string): void } }) {
		ctx.ui.setTitle(`${INDICATOR}${baseTitle}`);
	}

	function clearAttention(ctx: { ui: { setTitle(t: string): void } }) {
		ctx.ui.setTitle(baseTitle);
	}

	// When the agent finishes (waiting for user input) → show indicator
	pi.on("agent_end", async (_event, ctx) => {
		setAttention(ctx);
	});

	// When user sends input → clear indicator
	pi.on("input", async (_event, ctx) => {
		clearAttention(ctx);
		return { action: "continue" as const };
	});

	// Track the base title from session info
	pi.on("session_start", async (_event, ctx) => {
		const name = pi.getSessionName();
		const cwd = ctx.cwd.split("/").pop() || ctx.cwd;
		baseTitle = name ? `π - ${name} - ${cwd}` : `π - ${cwd}`;
		clearAttention(ctx);
	});

	// Also clear on session switch
	pi.on("session_switch", async (_event, ctx) => {
		const name = pi.getSessionName();
		const cwd = ctx.cwd.split("/").pop() || ctx.cwd;
		baseTitle = name ? `π - ${name} - ${cwd}` : `π - ${cwd}`;
		clearAttention(ctx);
	});
}
