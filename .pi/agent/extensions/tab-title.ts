import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";

const TICKET_PATTERN = /^([A-Z]+-\d+)/;

const PROMPT_HINT = `
## Tab Title

This session has no name yet. Once you understand what the user wants to work on, call \`set_tab_title\` exactly once with a summary of at most 5 words. Do not call it for greetings or unclear requests; wait until the task is clear.
`.trim();

async function getBranchTicket(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<string | null> {
	const result = await pi.exec("git", ["branch", "--show-current"], { cwd, signal, timeout: 5000 });
	if (result.code !== 0) return null;

	return result.stdout.trim().match(TICKET_PATTERN)?.[1] ?? null;
}

async function renameRexTab(pi: ExtensionAPI, title: string, signal?: AbortSignal): Promise<string | null> {
	const block = process.env.REX_BLOCK;
	if (!block) return null;

	const inspect = await pi.exec("rex", ["block", "inspect", block, "--json"], { signal, timeout: 5000 });
	if (inspect.code !== 0) return `Rex tab not renamed: block inspect failed: ${inspect.stderr.trim()}`;

	const windowId: string | undefined = JSON.parse(inspect.stdout).block?.window_id;
	if (!windowId) return `Rex tab not renamed: no window_id for ${block}`;

	const sessionArgs = process.env.REX_SESSION ? ["-s", process.env.REX_SESSION] : [];
	const rename = await pi.exec("rex", ["window", "rename", ...sessionArgs, windowId, title], { signal, timeout: 5000 });
	if (rename.code !== 0) return `Rex tab not renamed: ${rename.stderr.trim()}`;

	return `Rex tab ${windowId} renamed.`;
}

function formatTitle(ticket: string | null, summary: string): string {
	return [ticket, summary.trim()].filter(Boolean).join(" ");
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		if (pi.getSessionName()) return;

		return { systemPrompt: event.systemPrompt + "\n\n" + PROMPT_HINT };
	});

	pi.registerTool({
		name: "set_tab_title",
		label: "Set Tab Title",
		description:
			"Names the session (shown in the terminal tab title) with the branch ticket and a short task summary. Only works once per session.",
		promptSnippet: "Name the session/terminal tab once the task is clear",
		parameters: Type.Object({
			summary: Type.String({ description: "What we are working on, at most 5 words" }),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const existing = pi.getSessionName();
			if (existing) {
				return { content: [{ type: "text", text: `Session already named "${existing}"; leaving it unchanged.` }] };
			}

			const title = formatTitle(await getBranchTicket(pi, ctx.cwd, signal), params.summary);
			pi.setSessionName(title);
			const rexResult = await renameRexTab(pi, title, signal);

			return { content: [{ type: "text", text: [`Session named "${title}".`, rexResult].filter(Boolean).join(" ") }] };
		},
	});
}
