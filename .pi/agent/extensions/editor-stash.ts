import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let stashed: string | null = null;

	const updateIndicator = (ctx: ExtensionContext) => {
		ctx.ui.setStatus("stash", stashed !== null ? "stash" : undefined);
	};

	pi.registerShortcut("alt+s", {
		description: "Stash / pop the editor draft",
		handler: async (ctx) => {
			const current = ctx.ui.getEditorText();
			if (current.trim().length > 0) {
				stashed = current;
				ctx.ui.setEditorText("");
			} else if (stashed !== null) {
				ctx.ui.setEditorText(stashed);
				stashed = null;
			} else {
				ctx.ui.notify("Nothing to stash", "info");
				return;
			}
			updateIndicator(ctx);
		},
	});
}
