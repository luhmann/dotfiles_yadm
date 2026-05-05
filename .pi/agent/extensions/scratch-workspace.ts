import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const SCRATCH_BASE = join(homedir(), "icloud", "org", "_scratch");
const SUBDIRECTORIES = ["plans", "research", "reviews", "sessions", "test_protocols"] as const;
const TICKET_PATTERN = /^([A-Z]+-\d+)/;

type ScratchInfo = {
	project: string;
	root: string;
	plans: string;
	research: string;
	reviews: string;
	sessions: string;
	test_protocols: string;
	ticket: string | null;
	filenamePrefix: string;
};

function extractRepoName(remoteUrl: string): string | null {
	const trimmed = remoteUrl.trim().replace(/\.git$/, "");
	if (!trimmed) return null;

	const match = trimmed.match(/[:/]([^/:]+)$/);
	return match?.[1] ?? null;
}

function sanitizeSlug(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "project"
	);
}

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}_${month}_${day}`;
}

async function getBranchTicket(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<string | null> {
	const result = await pi.exec("git", ["branch", "--show-current"], { cwd, signal, timeout: 5000 });
	if (result.code !== 0) return null;

	return result.stdout.trim().match(TICKET_PATTERN)?.[1] ?? null;
}

async function deriveProjectSlug(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<string> {
	const result = await pi.exec("git", ["remote", "get-url", "origin"], { cwd, signal, timeout: 5000 });
	const repoName = result.code === 0 ? extractRepoName(result.stdout) : null;
	return sanitizeSlug(repoName ?? basename(cwd));
}

async function getScratchInfo(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<ScratchInfo> {
	const project = await deriveProjectSlug(pi, cwd, signal);
	const root = join(SCRATCH_BASE, project);
	const ticket = await getBranchTicket(pi, cwd, signal);
	const datePrefix = formatDate(new Date());

	return {
		project,
		root,
		plans: join(root, "plans"),
		research: join(root, "research"),
		reviews: join(root, "reviews"),
		sessions: join(root, "sessions"),
		test_protocols: join(root, "test_protocols"),
		ticket,
		filenamePrefix: ticket ? `${datePrefix}_${ticket}_` : `${datePrefix}_`,
	};
}

async function ensureScratchDirectories(info: ScratchInfo): Promise<void> {
	await Promise.all(SUBDIRECTORIES.map((directory) => mkdir(join(info.root, directory), { recursive: true })));
}

function formatScratchPrompt(info: ScratchInfo): string {
	const ticketHint = info.ticket
		? `Current branch ticket: ${info.ticket}`
		: "Current branch ticket: none inferred from /^([A-Z]+-\\d+)/";

	return `
## Project Scratch Workspace

Root: ${info.root}
Project slug: ${info.project}
${ticketHint}
Default org-mode filename prefix for new scratch files today: ${info.filenamePrefix}<slug>.org

Use these subdirectories:
- plans: ${info.plans}
- research: ${info.research}
- reviews: ${info.reviews}
- sessions: ${info.sessions}
- test_protocols: ${info.test_protocols} — showboat testing logs

All files written here must be org-mode files with a .org extension and date-prefixed filenames. Include the ticket number in the filename when one is inferable from the current git branch name.
`.trim();
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const info = await getScratchInfo(pi, ctx.cwd);
		await ensureScratchDirectories(info);

		if (ctx.hasUI) {
			ctx.ui.setStatus("scratch", `scratch:${info.project}`);
		}
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const info = await getScratchInfo(pi, ctx.cwd, ctx.signal);
		await ensureScratchDirectories(info);

		return {
			systemPrompt: event.systemPrompt + "\n\n" + formatScratchPrompt(info),
		};
	});

	pi.registerTool({
		name: "get_scratch_path",
		label: "Get Scratch Path",
		description: "Returns the project scratch root path and its subdirectory paths.",
		promptSnippet: "Get the project scratch workspace root and subdirectory paths",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
			const info = await getScratchInfo(pi, ctx.cwd, signal);
			await ensureScratchDirectories(info);

			return {
				content: [
					{
						type: "text",
						text: formatScratchPrompt(info),
					},
				],
				details: info,
			};
		},
	});
}
