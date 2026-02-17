import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import {
	basename,
	delimiter,
	dirname,
	isAbsolute,
	join,
	resolve,
} from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const DIAGNOSTIC_SEVERITY = {
	ERROR: 1,
	WARNING: 2,
	INFO: 3,
	HINT: 4,
} as const;

const toolParams = Type.Object({
	path: Type.String({
		description:
			"Path to a Kotlin file (.kt/.kts). Relative paths are resolved from cwd.",
	}),
	workspace: Type.Optional(
		Type.String({
			description:
				"Optional workspace root. If omitted, the extension auto-detects it.",
		}),
	),
	includeWarnings: Type.Optional(
		Type.Boolean({
			description:
				"Whether warning diagnostics should be included in addition to errors.",
		}),
	),
	maxProblems: Type.Optional(
		Type.Integer({
			minimum: 1,
			maximum: 500,
			description: "Maximum number of diagnostics to include in the response.",
		}),
	),
});

type PendingRequest = {
	resolve: (value: any) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
	method: string;
};

type LspDiagnostic = {
	range?: {
		start?: { line?: number; character?: number };
		end?: { line?: number; character?: number };
	};
	severity?: number;
	code?: string | number | { value?: string | number };
	source?: string;
	message?: string;
};

const WORKSPACE_MARKERS = [
	"settings.gradle.kts",
	"settings.gradle",
	"build.gradle.kts",
	"build.gradle",
	"pom.xml",
	".git",
] as const;

const clients = new Map<string, KotlinLspClient>();

function sanitizePath(pathValue: string | undefined): string {
	if (!pathValue) return "";
	const entries = pathValue
		.split(delimiter)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0 && isAbsolute(entry));
	return entries.join(delimiter);
}

function normalizeToolPath(pathValue: string): string {
	return pathValue.startsWith("@") ? pathValue.slice(1) : pathValue;
}

function fileUri(pathValue: string): string {
	return pathToFileURL(pathValue).href;
}

function workspaceForFile(filePath: string, cwd: string): string {
	let current = dirname(filePath);
	let previous = "";
	while (current !== previous) {
		for (const marker of WORKSPACE_MARKERS) {
			const candidate = join(current, marker);
			try {
				accessSyncLike(candidate);
				return current;
			} catch {
				// Ignore
			}
		}
		previous = current;
		current = dirname(current);
	}
	return cwd;
}

function accessSyncLike(pathValue: string): void {
	// We intentionally use sync access checks during workspace detection because
	// the directory depth is tiny and this keeps the code simple.
	accessSync(pathValue, constants.F_OK);
}

function severityLabel(severity: number | undefined): string {
	switch (severity) {
		case DIAGNOSTIC_SEVERITY.ERROR:
			return "error";
		case DIAGNOSTIC_SEVERITY.WARNING:
			return "warning";
		case DIAGNOSTIC_SEVERITY.INFO:
			return "info";
		case DIAGNOSTIC_SEVERITY.HINT:
			return "hint";
		default:
			return "unknown";
	}
}

function codeLabel(code: LspDiagnostic["code"]): string {
	if (code === undefined || code === null) return "";
	if (typeof code === "object") {
		const value = code.value;
		return value === undefined || value === null ? "" : String(value);
	}
	return String(code);
}

function formatDiagnostic(diagnostic: LspDiagnostic): string {
	const start = diagnostic.range?.start;
	const line = (start?.line ?? 0) + 1;
	const column = (start?.character ?? 0) + 1;
	const severity = severityLabel(diagnostic.severity);
	const code = codeLabel(diagnostic.code);
	const source = diagnostic.source ? ` [${diagnostic.source}]` : "";
	const codePart = code ? ` (${code})` : "";
	const message = (diagnostic.message ?? "").replace(/\s+/g, " ").trim();
	return `- [${severity}] ${line}:${column}${codePart}${source} ${message}`.trim();
}

class KotlinLspClient {
	private workspaceRoot: string;
	private workspaceUri: string;
	private child: ChildProcessWithoutNullStreams | undefined;
	private pending = new Map<number, PendingRequest>();
	private buffer = Buffer.alloc(0);
	private nextId = 1;
	private initializePromise: Promise<void> | undefined;
	private lastDiagnostics = new Map<string, LspDiagnostic[]>();
	private operationQueue: Promise<void> = Promise.resolve();
	private stderrRing: string[] = [];

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot;
		this.workspaceUri = fileUri(workspaceRoot);
	}

	status(): string {
		const running = this.child && !this.child.killed ? "running" : "stopped";
		return `${this.workspaceRoot} (${running})`;
	}

	async diagnose(filePath: string, text: string): Promise<LspDiagnostic[]> {
		return this.runExclusive(async () => {
			await this.ensureInitialized();
			const uri = fileUri(filePath);
			const document = {
				uri,
				languageId: "kotlin",
				version: Date.now(),
				text,
			};

			this.notify("textDocument/didOpen", { textDocument: document });
			try {
				const report = await this.request("textDocument/diagnostic", {
					textDocument: { uri },
				});

				if (report?.kind === "full" && Array.isArray(report.items)) {
					this.lastDiagnostics.set(uri, report.items as LspDiagnostic[]);
					return report.items as LspDiagnostic[];
				}

				if (report?.kind === "unchanged") {
					return this.lastDiagnostics.get(uri) ?? [];
				}

				return [];
			} finally {
				this.notify("textDocument/didClose", { textDocument: { uri } });
			}
		});
	}

	async dispose(): Promise<void> {
		if (!this.child) return;

		const child = this.child;

		try {
			await this.request("shutdown", null, 1500);
		} catch {
			// Ignore
		}

		try {
			this.notify("exit", null);
		} catch {
			// Ignore
		}

		if (!child.killed) {
			child.kill("SIGTERM");
		}

		setTimeout(() => {
			if (!child.killed) {
				child.kill("SIGKILL");
			}
		}, 500);

		for (const pending of this.pending.values()) {
			clearTimeout(pending.timeout);
			pending.reject(new Error("kotlin-lsp client is shutting down"));
		}
		this.pending.clear();
		this.child = undefined;
		this.initializePromise = undefined;
	}

	private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
		const next = this.operationQueue.then(fn, fn);
		this.operationQueue = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initializePromise) {
			await this.initializePromise;
			return;
		}

		this.initializePromise = (async () => {
			await this.start();
			await this.request("initialize", {
				processId: process.pid,
				clientInfo: { name: "pi-kotlin-lsp-extension", version: "0.1" },
				rootUri: this.workspaceUri,
				workspaceFolders: [{ uri: this.workspaceUri, name: basename(this.workspaceRoot) }],
				capabilities: {
					workspace: {
						workspaceFolders: true,
						configuration: true,
						diagnostic: { refreshSupport: true },
					},
					textDocument: {
						diagnostic: { dynamicRegistration: false },
					},
				},
				initializationOptions: {},
			});
			this.notify("initialized", {});
		})();

		try {
			await this.initializePromise;
		} catch (error) {
			this.initializePromise = undefined;
			throw error;
		}
	}

	private async start(): Promise<void> {
		if (this.child && !this.child.killed) return;

		const env = {
			...process.env,
			PATH: sanitizePath(process.env.PATH),
		};

		this.child = spawn("kotlin-lsp", ["--stdio"], {
			cwd: this.workspaceRoot,
			env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		this.child.stdout.on("data", (chunk: Buffer) => {
			this.consumeStdout(chunk);
		});

		this.child.stderr.on("data", (chunk: Buffer) => {
			for (const line of chunk.toString("utf8").split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				if (trimmed.startsWith("WARNING: package ")) continue;
				this.stderrRing.push(trimmed);
				if (this.stderrRing.length > 40) {
					this.stderrRing.shift();
				}
			}
		});

		this.child.on("exit", (code, signal) => {
			const message = `kotlin-lsp exited (code=${code ?? "null"}, signal=${signal ?? "null"})`;
			for (const pending of this.pending.values()) {
				clearTimeout(pending.timeout);
				pending.reject(new Error(message));
			}
			this.pending.clear();
			this.child = undefined;
			this.initializePromise = undefined;
		});

		this.child.on("error", (error) => {
			for (const pending of this.pending.values()) {
				clearTimeout(pending.timeout);
				pending.reject(error instanceof Error ? error : new Error(String(error)));
			}
			this.pending.clear();
		});
	}

	private consumeStdout(chunk: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		while (true) {
			const separator = this.buffer.indexOf("\r\n\r\n");
			if (separator === -1) return;

			const header = this.buffer.slice(0, separator).toString("utf8");
			const match = header.match(/Content-Length:\s*(\d+)/i);
			if (!match) {
				throw new Error(`Invalid LSP header from kotlin-lsp: ${header}`);
			}

			const length = Number(match[1]);
			const totalLength = separator + 4 + length;
			if (this.buffer.length < totalLength) return;

			const payload = this.buffer.slice(separator + 4, totalLength).toString("utf8");
			this.buffer = this.buffer.slice(totalLength);

			let message: any;
			try {
				message = JSON.parse(payload);
			} catch {
				continue;
			}

			this.handleMessage(message);
		}
	}

	private handleMessage(message: any): void {
		if (message.id !== undefined && message.method && !message.result && !message.error) {
			this.handleServerRequest(message);
			return;
		}

		if (message.id !== undefined) {
			const pending = this.pending.get(Number(message.id));
			if (!pending) return;
			this.pending.delete(Number(message.id));
			clearTimeout(pending.timeout);
			if (message.error) {
				pending.reject(
					new Error(
						`${pending.method} failed: ${JSON.stringify(message.error)}${this.errorSuffix()}`,
					),
				);
				return;
			}
			pending.resolve(message.result);
			return;
		}

		if (message.method === "textDocument/publishDiagnostics") {
			const uri = message.params?.uri;
			const diagnostics = message.params?.diagnostics;
			if (typeof uri === "string" && Array.isArray(diagnostics)) {
				this.lastDiagnostics.set(uri, diagnostics as LspDiagnostic[]);
			}
		}
	}

	private handleServerRequest(message: any): void {
		const id = message.id;
		const method = message.method;

		if (method === "workspace/configuration") {
			this.send({ jsonrpc: "2.0", id, result: [] });
			return;
		}

		if (method === "window/workDoneProgress/create") {
			this.send({ jsonrpc: "2.0", id, result: null });
			return;
		}

		if (method === "workspace/workspaceFolders") {
			this.send({
				jsonrpc: "2.0",
				id,
				result: [{ uri: this.workspaceUri, name: basename(this.workspaceRoot) }],
			});
			return;
		}

		this.send({
			jsonrpc: "2.0",
			id,
			error: {
				code: -32601,
				message: `Method not implemented in pi kotlin-lsp bridge: ${String(method)}`,
			},
		});
	}

	private request(method: string, params: any, timeoutMs = 120000): Promise<any> {
		const id = this.nextId++;
		this.send({ jsonrpc: "2.0", id, method, params });

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(
					new Error(`Timeout waiting for ${method} (${timeoutMs}ms)${this.errorSuffix()}`),
				);
			}, timeoutMs);

			this.pending.set(id, { resolve, reject, timeout, method });
		});
	}

	private notify(method: string, params: any): void {
		this.send({ jsonrpc: "2.0", method, params });
	}

	private send(message: any): void {
		if (!this.child || this.child.killed) {
			throw new Error(`kotlin-lsp is not running${this.errorSuffix()}`);
		}
		const payload = Buffer.from(JSON.stringify(message), "utf8");
		const header = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, "utf8");
		this.child.stdin.write(Buffer.concat([header, payload]));
	}

	private errorSuffix(): string {
		if (this.stderrRing.length === 0) return "";
		const joined = this.stderrRing.slice(-8).join("\n");
		return `\nRecent kotlin-lsp stderr:\n${joined}`;
	}
}

async function getClient(workspaceRoot: string): Promise<KotlinLspClient> {
	const existing = clients.get(workspaceRoot);
	if (existing) return existing;
	const client = new KotlinLspClient(workspaceRoot);
	clients.set(workspaceRoot, client);
	return client;
}

async function stopAllClients(): Promise<void> {
	for (const client of clients.values()) {
		await client.dispose();
	}
	clients.clear();
}

export default function (pi: ExtensionAPI) {
	pi.on("session_shutdown", async () => {
		await stopAllClients();
	});

	pi.registerCommand("kotlin-lsp-status", {
		description: "Show active kotlin-lsp workspaces",
		handler: async (_args, ctx) => {
			if (clients.size === 0) {
				ctx.ui.notify("kotlin-lsp: no active clients", "info");
				return;
			}
			const status = [...clients.values()].map((client) => client.status()).join("\n");
			ctx.ui.notify(`kotlin-lsp clients:\n${status}`, "info");
		},
	});

	pi.registerCommand("kotlin-lsp-restart", {
		description: "Restart all kotlin-lsp clients",
		handler: async (_args, ctx) => {
			await stopAllClients();
			ctx.ui.notify("kotlin-lsp clients restarted", "info");
		},
	});

	pi.registerTool({
		name: "kotlin_lsp_diagnostics",
		label: "Kotlin LSP Diagnostics",
		description:
			"Get Kotlin diagnostics from kotlin-lsp (pull diagnostics via textDocument/diagnostic). Use this after editing Kotlin files to validate errors/warnings quickly. Output is truncated to 2000 lines or 50KB.",
		parameters: toolParams,
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const includeWarnings = params.includeWarnings ?? true;
			const maxProblems = params.maxProblems ?? 200;

			const pathInput = normalizeToolPath(params.path);
			const filePath = resolve(ctx.cwd, pathInput);
			await access(filePath, constants.R_OK);

			const workspaceRoot = params.workspace
				? resolve(ctx.cwd, normalizeToolPath(params.workspace))
				: workspaceForFile(filePath, ctx.cwd);

			onUpdate?.({
				content: [
					{ type: "text", text: `Running kotlin-lsp diagnostics for ${filePath}...` },
				],
			});

			const source = await readFile(filePath, "utf8");
			const client = await getClient(workspaceRoot);
			const diagnostics = await client.diagnose(filePath, source);

			const filtered = diagnostics.filter((diagnostic) => {
				if (!includeWarnings) {
					return diagnostic.severity === DIAGNOSTIC_SEVERITY.ERROR;
				}
				return (
					diagnostic.severity === DIAGNOSTIC_SEVERITY.ERROR ||
					diagnostic.severity === DIAGNOSTIC_SEVERITY.WARNING
				);
			});

			const counts = {
				errors: diagnostics.filter(
					(diagnostic) => diagnostic.severity === DIAGNOSTIC_SEVERITY.ERROR,
				).length,
				warnings: diagnostics.filter(
					(diagnostic) => diagnostic.severity === DIAGNOSTIC_SEVERITY.WARNING,
				).length,
			};

			const shownDiagnostics = filtered.slice(0, maxProblems);
			let response = "";
			response += `Workspace: ${workspaceRoot}\n`;
			response += `File: ${filePath}\n`;
			response += `Diagnostics: ${diagnostics.length} total (${counts.errors} errors, ${counts.warnings} warnings)\n`;

			if (shownDiagnostics.length === 0) {
				response += "\nNo matching diagnostics.";
			} else {
				response += "\n";
				response += shownDiagnostics.map(formatDiagnostic).join("\n");
			}

			if (filtered.length > shownDiagnostics.length) {
				response += `\n\nShowing ${shownDiagnostics.length} of ${filtered.length} matching diagnostics (maxProblems=${maxProblems}).`;
			}

			const truncation = truncateHead(response, {
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			});

			let finalText = truncation.content;
			let fullOutputPath: string | undefined;
			if (truncation.truncated) {
				const tempDir = await mkdtemp(join(tmpdir(), "pi-kotlin-lsp-"));
				fullOutputPath = join(tempDir, "diagnostics.txt");
				await writeFile(fullOutputPath, response, "utf8");
				finalText += `\n\n[Output truncated: showing ${truncation.outputLines}/${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}). Full output saved to ${fullOutputPath}]`;
			}

			return {
				content: [{ type: "text", text: finalText }],
				details: {
					workspaceRoot,
					filePath,
					includeWarnings,
					maxProblems,
					diagnosticsTotal: diagnostics.length,
					errors: counts.errors,
					warnings: counts.warnings,
					shown: shownDiagnostics.length,
					fullOutputPath,
				},
			};
		},
	});
}
