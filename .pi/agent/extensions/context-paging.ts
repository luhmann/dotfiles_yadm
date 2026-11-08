import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { estimateTokens } from "@earendil-works/pi-coding-agent";

type Config = { enabled: boolean; softTokens: number; hardTokens: number; trimToTokens: number };
type Cut = { keepFrom: number; evictedTurns: number; notice: AgentMessage };

const DEFAULTS: Config = { enabled: true, softTokens: 180_000, hardTokens: 200_000, trimToTokens: 100_000 };
const RECENT_PROMPTS = 4;
const PROMPT_CHARS = 500;
const WINDOW_SHARE = 0.9;

const readConfig = (pi: ExtensionAPI): Config => ({
	...DEFAULTS,
	...((pi.getSettings() as { contextPaging?: Partial<Config> }).contextPaging ?? {}),
});

const turns = (n: number) => `paged ${n} ${n === 1 ? "turn" : "turns"}`;
const sumTokens = (ms: AgentMessage[]) => ms.reduce((sum, m) => sum + estimateTokens(m), 0);
const userIndexes = (ms: AgentMessage[]) => ms.flatMap((m, i) => (m.role === "user" ? [i] : []));

const promptText = (m: AgentMessage) => {
	if (m.role !== "user") return "";
	const text =
		typeof m.content === "string"
			? m.content
			: m.content.map((b) => (b.type === "text" ? b.text : "[image]")).join(" ");
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > PROMPT_CHARS ? `${flat.slice(0, PROMPT_CHARS)}...` : flat;
};

function buildNotice(evicted: AgentMessage[], turns: number, sessionId: string): AgentMessage {
	const prompts = evicted.filter((m) => m.role === "user");
	const shown = [...new Set([prompts[0], ...prompts.slice(-RECENT_PROMPTS)])].filter(Boolean);
	const text = [
		`[context paging] Turns 1-${turns} left the context window. Nothing was summarized.`,
		"If a decision or constraint seems missing, check the scratch plan/research files first.",
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
			return { keepFrom: ms[starts[t]].timestamp, evictedTurns: t, notice: buildNotice(evicted, t, sessionId) };
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
	const capped = (tokens: number, ctx: ExtensionContext) => {
		const window = ctx.getContextUsage()?.contextWindow ?? ctx.model?.contextWindow;
		return window ? Math.min(tokens, Math.floor(window * WINDOW_SHARE)) : tokens;
	};

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
		const threshold = forceCut ? 0 : capped(userTurnPending ? cfg.softTokens : cfg.hardTokens, ctx);
		forceCut = false;
		userTurnPending = false;

		const full = event.messages;
		if (cut && keepIndex(full, cut) < 0) reset(ctx);
		const current = cut ? applyCut(full, cut) : full;
		const tokens = Math.max(ctx.getContextUsage()?.tokens ?? 0, sumTokens(current));

		if (tokens > threshold) {
			const excess = tokens - cfg.trimToTokens;
			const next = newCut(full, cut?.evictedTurns ?? 0, excess, ctx.sessionManager.getSessionId());
			if (next) {
				cut = next;
				showStatus(ctx);
				ctx.ui.notify(`context paging: ${turns(next.evictedTurns)}`, "info");
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
