import { copyToClipboard, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const shortId = (id: string) => id.split("-")[0];

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setStatus("session", `· ${ctx.ui.theme.fg("dim", shortId(ctx.sessionManager.getSessionId()))}`);
	});

	pi.registerCommand("copy-session-id", {
		description: "Copy the current session id to the clipboard",
		handler: async (_args, ctx) => {
			const id = ctx.sessionManager.getSessionId();
			await copyToClipboard(id);
			ctx.ui.notify(`Copied session id ${id}`, "info");
		},
	});
}
