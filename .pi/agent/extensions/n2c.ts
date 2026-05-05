import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const SCRATCH_BASE = join(homedir(), "icloud", "org", "_scratch");

type Finding = {
	file: string;
	line: number;
	column: number;
	text: string;
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

async function deriveProjectSlug(pi: ExtensionAPI, cwd: string): Promise<string> {
	const result = await pi.exec("git", ["remote", "get-url", "origin"], { cwd, timeout: 5000 });
	const repoName = result.code === 0 ? extractRepoName(result.stdout) : null;
	return sanitizeSlug(repoName ?? basename(cwd));
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

function parseVimgrep(output: string, root: string): Finding[] {
	return output
		.split("\n")
		.map((line) => line.match(/^(.*?):(\d+):(\d+):(.*)$/))
		.filter((match): match is RegExpMatchArray => Boolean(match))
		.map((match) => ({
			file: join(root, match[1] ?? ""),
			line: Number(match[2]),
			column: Number(match[3]),
			text: match[4] ?? "",
		}));
}

async function scanN2c(pi: ExtensionAPI, cwd: string, searchRoot: string): Promise<Finding[]> {
	const result = await pi.exec("rg", ["n2c:", "--vimgrep"], { cwd: searchRoot, timeout: 10000 });

	if (result.code === 0 || result.code === 1) {
		return parseVimgrep(result.stdout, searchRoot);
	}

	throw new Error(`rg failed in ${searchRoot}: ${result.stderr || result.stdout}`);
}

function groupFindings(findings: Finding[]): Map<string, Finding[]> {
	return findings.reduce((groups, finding) => {
		const current = groups.get(finding.file) ?? [];
		current.push(finding);
		groups.set(finding.file, current);
		return groups;
	}, new Map<string, Finding[]>());
}

function formatFindings(findings: Finding[]): string {
	const grouped = groupFindings(findings);
	const sections = Array.from(grouped.entries()).map(([file, fileFindings]) => {
		const lines = fileFindings.map((finding) => `- ${finding.line}:${finding.column} ${finding.text}`);
		return `** ${file}\n${lines.join("\n")}`;
	});

	return `
/n2c found these annotations:

${sections.join("\n\n")}

Address each n2c annotation one by one. For each: state your understanding, discuss, and propose resolution. Do not skip any.
`.trim();
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("n2c", {
		description: "Scan the working tree and scratch plans for n2c annotations",
		handler: async (_args, ctx) => {
			try {
				const project = await deriveProjectSlug(pi, ctx.cwd);
				const plansRoot = join(SCRATCH_BASE, project, "plans");

				const workingTreeFindings = await scanN2c(pi, ctx.cwd, ctx.cwd);
				const scratchFindings = (await pathExists(plansRoot)) ? await scanN2c(pi, ctx.cwd, plansRoot) : [];
				const findings = [...workingTreeFindings, ...scratchFindings];

				if (findings.length === 0) {
					ctx.ui.notify("No n2c annotations found", "info");
					return;
				}

				const message = formatFindings(findings);
				if (ctx.isIdle()) {
					pi.sendUserMessage(message);
				} else {
					pi.sendUserMessage(message, { deliverAs: "followUp" });
					ctx.ui.notify("Queued n2c annotations as a follow-up", "info");
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`n2c scan failed: ${message}`, "error");
			}
		},
	});
}
