import { homedir } from "node:os";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { calculateContextTokens, estimateTokens } from "@earendil-works/pi-coding-agent";

type Config = { enabled: boolean; maxSoftTokens: number; maxTrimToTokens: number };
type Limits = { soft: number; trimTo: number };
type Cut = { keepFrom: number; evictedTurns: number; notice: AgentMessage; madeAt: number };

// Overridable via `contextPaging` in settings.json.
// The two token values are ceilings: how much history is worth carrying, however large the model's window is.
const DEFAULTS: Config = {
	enabled: true,
	// Ceiling for the soft limit. A new prompt pages out old turns once the window is larger than the soft limit.
	maxSoftTokens: 180_000,
	// Ceiling for the trim target, the window size a page aims for. Whole turns are dropped by estimate, so the result is approximate.
	maxTrimToTokens: 100_000,
};
// How many of the latest paged-out prompts the notice lists, besides the very first one.
const RECENT_PROMPTS = 4;
// Each prompt listed in the notice is clipped to this many characters.
const PROMPT_CHARS = 500;
// How many of the latest scratch files written in paged-out turns the notice lists.
const RECENT_NOTES = 6;
// A written file counts as a scratch file when its path contains this segment.
const SCRATCH_SEGMENT = "/_scratch/";
// On small models the ceilings would leave a run too little room to grow, so each limit is also capped at a share of the context window.
const SOFT_WINDOW_SHARE = 0.5;
const TRIM_WINDOW_SHARE = 0.3;

const readConfig = (pi: ExtensionAPI): Config => ({
	...DEFAULTS,
	...((pi.getSettings() as { contextPaging?: Partial<Config> }).contextPaging ?? {}),
});

const share = (window: number | undefined, part: number) => (window ? Math.floor(window * part) : Infinity);
/**
 * Resolves the limits that apply for a given context window.
 * Each limit is the smaller of its ceiling and its share of the window.
 *
 * @param cfg ceilings from the settings
 * @param window context window of the active model in tokens; without it only the ceilings apply
 *
 * @example
 * // 1M window: the ceilings win
 * // soft   = min(180k, 0.5 x 1M) = 180k
 * // trimTo = min(100k, 0.3 x 1M) = 100k
 *
 * @example
 * // 272k window: the shares win
 * // soft   = min(180k, 0.5 x 272k) = 136k
 * // trimTo = min(100k, 0.3 x 272k) = 81.6k
 */
const limitsFor = (cfg: Config, window: number | undefined): Limits => ({
	soft: Math.min(cfg.maxSoftTokens, share(window, SOFT_WINDOW_SHARE)),
	trimTo: Math.min(cfg.maxTrimToTokens, share(window, TRIM_WINDOW_SHARE)),
});

const turns = (n: number) => `paged ${n} ${n === 1 ? "turn" : "turns"}`;
const sumTokens = (ms: AgentMessage[]) => ms.reduce((sum, m) => sum + estimateTokens(m), 0);
const userIndexes = (ms: AgentMessage[]) => ms.flatMap((m, i) => (m.role === "user" ? [i] : []));

const reportsUsageSince = (since: number) => (m: AgentMessage) =>
	m.role === "assistant" &&
	m.timestamp >= since &&
	m.stopReason !== "error" &&
	m.stopReason !== "aborted" &&
	calculateContextTokens(m.usage) > 0;

function usageSince(ms: AgentMessage[], since: number): number {
	const i = ms.findLastIndex(reportsUsageSince(since));
	const m = ms[i];
	return m?.role === "assistant" ? calculateContextTokens(m.usage) + sumTokens(ms.slice(i + 1)) : 0;
}

const promptText = (m: AgentMessage) => {
	if (m.role !== "user") return "";
	const text =
		typeof m.content === "string"
			? m.content
			: m.content.map((b) => (b.type === "text" ? b.text : "[image]")).join(" ");
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > PROMPT_CHARS ? `${flat.slice(0, PROMPT_CHARS)}...` : flat;
};

const writtenPaths = (m: AgentMessage): string[] =>
	m.role === "assistant"
		? m.content.flatMap((b) =>
				b.type === "toolCall" && (b.name === "write" || b.name === "edit") && typeof b.arguments.path === "string"
					? [b.arguments.path]
					: [],
			)
		: [];

const fromHome = (path: string) => (path.startsWith(`${homedir()}/`) ? `~${path.slice(homedir().length)}` : path);

// Each scratch file the messages wrote, once, ordered by its latest write.
const scratchNotes = (ms: AgentMessage[]) =>
	[...new Set(ms.flatMap(writtenPaths).map(fromHome).filter((p) => p.includes(SCRATCH_SEGMENT)).reverse())]
		.slice(0, RECENT_NOTES)
		.reverse();

function notesHint(evicted: AgentMessage[]): string[] {
	const notes = scratchNotes(evicted);
	return notes.length
		? [
				"Scratch files written in those turns; read them first if a decision or constraint seems missing:",
				...notes.map((path) => `- ${path}`),
			]
		: ["If a decision or constraint seems missing, check the scratch plan/research files first."];
}

function buildNotice(evicted: AgentMessage[], turns: number, sessionId: string): AgentMessage {
	const prompts = evicted.filter((m) => m.role === "user");
	const shown = [...new Set([prompts[0], ...prompts.slice(-RECENT_PROMPTS)])].filter(Boolean);
	const text = [
		`[context paging] Turns 1-${turns} left the context window. Nothing was summarized.`,
		...notesHint(evicted),
		`Full history: session ${sessionId}; \`mem search --session ${sessionId} <terms> --json\` if explicitly asked to look back.`,
		"",
		"Earlier user requests (clipped):",
		...shown.map((m) => `- turn ${prompts.indexOf(m) + 1}: ${promptText(m)}`),
	].join("\n");
	return { role: "user", content: text, timestamp: 0 };
}

function newCut(ms: AgentMessage[], fromTurn: number, excess: number, sessionId: string): Cut | undefined {
	const starts = userIndexes(ms);
	let dropped = 0;
	for (let t = fromTurn + 1; t < starts.length; t++) {
		dropped += sumTokens(ms.slice(starts[t - 1], starts[t]));
		if (dropped >= excess || t === starts.length - 1) {
			const evicted = ms.slice(starts[0], starts[t]);
			return { keepFrom: ms[starts[t]].timestamp, evictedTurns: t, notice: buildNotice(evicted, t, sessionId), madeAt: Date.now() };
		}
	}
	return undefined;
}

const keepIndex = (ms: AgentMessage[], cut: Cut) =>
	ms.findIndex((m) => m.role === "user" && m.timestamp === cut.keepFrom);

function applyCut(ms: AgentMessage[], cut: Cut): AgentMessage[] {
	const firstUser = ms.findIndex((m) => m.role === "user");
	return [...ms.slice(0, firstUser), cut.notice, ...ms.slice(keepIndex(ms, cut))];
}

export default function (pi: ExtensionAPI) {
	let cfg = DEFAULTS;
	let enabled = cfg.enabled;
	let cut: Cut | undefined;
	let userTurnPending = false;
	let forceCut = false;

	const statusText = () => {
		if (!enabled) return "paging off";
		return cut ? turns(cut.evictedTurns) : "paging on";
	};
	const showStatus = (ctx: ExtensionContext) => {
		if (ctx.hasUI) ctx.ui.setStatus("paging", statusText());
	};
	const reset = (ctx: ExtensionContext) => {
		cut = undefined;
		showStatus(ctx);
	};
	const limits = (ctx: ExtensionContext) =>
		limitsFor(cfg, ctx.getContextUsage()?.contextWindow ?? ctx.model?.contextWindow);

	pi.on("session_start", (_event, ctx) => {
		cfg = readConfig(pi);
		enabled = cfg.enabled;
		showStatus(ctx);
	});
	pi.on("before_agent_start", (event) => {
		userTurnPending = event.messageType === "user";
	});
	pi.on("session_compact", (_event, ctx) => reset(ctx));
	pi.on("session_tree", (_event, ctx) => reset(ctx));

	pi.on("context", (event, ctx) => {
		if (!enabled) return;
		const { soft, trimTo } = limits(ctx);
		const mayCut = forceCut || userTurnPending;
		const threshold = forceCut ? 0 : soft;
		forceCut = false;
		userTurnPending = false;

		const full = event.messages;
		if (cut && keepIndex(full, cut) < 0) reset(ctx);
		const current = cut ? applyCut(full, cut) : full;
		const estimated = sumTokens(current);
		const tokens = Math.max(usageSince(full, cut?.madeAt ?? 0), estimated);

		if (mayCut && tokens > threshold) {
			const usagePerEstimatedToken = estimated > 0 ? tokens / estimated : 1;
			const excess = (tokens - trimTo) / usagePerEstimatedToken;
			const previousTurns = cut?.evictedTurns ?? 0;
			const next = newCut(full, previousTurns, excess, ctx.sessionManager.getSessionId());
			if (next) {
				cut = next;
				showStatus(ctx);
				ctx.ui.notify(`context paging: ${previousTurns} -> ${next.evictedTurns} turns`, "info");
				return { messages: applyCut(full, next) };
			}
		}
		return cut ? { messages: current } : undefined;
	});

	pi.on("session_before_compact", (event) =>
		enabled && event.reason === "threshold" ? { cancel: true } : undefined,
	);

	pi.registerCommand("paging", {
		description: "Context paging: on | off | status",
		handler: async (args, ctx) => {
			const action = args.trim() || "status";
			if (action === "on" || action === "off") {
				enabled = action === "on";
				forceCut = false;
				reset(ctx);
			} else if (action !== "status") {
				ctx.ui.notify(`Unknown argument "${action}". Use on | off | status`, "error");
				return;
			}
			const tokens = ctx.getContextUsage()?.tokens;
			const state = cut ? turns(cut.evictedTurns) : "no cut";
			ctx.ui.notify(`paging ${enabled ? "on" : "off"}, ${state}, usage ${tokens ?? "unknown"} tokens`, "info");
		},
	});

	pi.registerCommand("page", {
		description: "Page out old turns on the next request",
		handler: async (_args, ctx) => {
			if (!enabled) {
				ctx.ui.notify("Context paging is off. Run /paging on first", "error");
				return;
			}
			forceCut = true;
			ctx.ui.notify("Next request pages out old turns", "info");
		},
	});
}
