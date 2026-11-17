/**
 * Context paging: keeps a long session inside a token budget without summarizing anything.
 *
 * Before every model request pi hands each extension the full history and sends whatever comes back.
 * This extension returns a view of that history. Once the history is larger than the soft limit, the
 * oldest turns are left out of the view and a short notice takes their place. The stored session is
 * never changed, so everything that left the view can still be found with `mem`.
 *
 * The mechanism:
 * - The cut. One cut marks the first turn that is still sent. It moves only on the first request after
 *   a prompt, or after /page, and never inside a tool loop. Every move invalidates the provider's
 *   prompt cache, so a move is large: from above the soft limit down to the trim target.
 * - Whole turns. A turn is a prompt and everything up to the next prompt. Only whole turns are paged
 *   out, so a tool call is never separated from its result, and the latest turn always stays.
 * - Measuring. The size of the view is the usage the provider last reported plus an estimate of what
 *   came after it, and never less than pi's estimate of the whole view. Usage from a failed or aborted
 *   response, or from before the current cut, describes a different view and is ignored. For the same
 *   reason `ctx.getContextUsage()` is not used: after a retry it reports the size of the full history.
 * - The notice. It says which turns left, names the scratch files written in them, points to the
 *   session in `mem`, and lists the first and the latest prompts that were paged out.
 * - Compaction. Pi's own threshold compaction is cancelled while paging is on. Any other compaction
 *   still runs, and it drops the cut because it rewrites the history.
 * - Lifetime. Every change of the cut is saved in the session and restored on session start, so a
 *   restart, reload or /resume continues with the same view.
 *
 * Settings: `contextPaging` in settings.json, see DEFAULTS. Commands: /paging on | off | status, /page.
 * Tests: `bun test ~/.pi/agent/tests`.
 */
import { homedir } from "node:os";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
	BeforeAgentStartEvent,
	ContextEvent,
	ContextEventResult,
	CustomEntry,
	ExtensionAPI,
	ExtensionContext,
	SessionBeforeCompactEvent,
	SessionBeforeCompactResult,
	SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { calculateContextTokens, estimateTokens } from "@earendil-works/pi-coding-agent";

// ── Settings and limits ──────────────────────────────────────────────────────────────────────────

type Config = { enabled: boolean; maxSoftTokens: number; maxTrimToTokens: number };
type Limits = { soft: number; trimTo: number };

// Overridable via `contextPaging` in settings.json.
// The two token values are ceilings: how much history is worth carrying, however large the model's window is.
const DEFAULTS: Config = {
	enabled: true,
	// Ceiling for the soft limit. A new prompt pages out old turns once the view is larger than the soft limit.
	maxSoftTokens: 180_000,
	// Ceiling for the trim target, the size a page aims for. Whole turns are dropped by estimate, so the result is approximate.
	maxTrimToTokens: 100_000,
};
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

// ── Messages ─────────────────────────────────────────────────────────────────────────────────────

type UserMessage = Extract<AgentMessage, { role: "user" }>;

const isPrompt = (m: AgentMessage): m is UserMessage => m.role === "user";
const sumTokens = (ms: AgentMessage[]) => ms.reduce((sum, m) => sum + estimateTokens(m), 0);
/** The index of each prompt. Turn n, counted from 1, starts at `turnStarts(ms)[n - 1]`. */
const turnStarts = (ms: AgentMessage[]) => ms.flatMap((m, i) => (isPrompt(m) ? [i] : []));

// ── The cut ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Where the view of the history starts.
 *
 * - `keepFrom`: timestamp of the first prompt that is still sent
 * - `turnsPagedOut`: how many turns, counted from the first, are left out
 * - `notice`: the message that takes their place
 * - `madeAt`: when the cut was made; usage reported earlier describes a larger view
 */
type Cut = { keepFrom: number; turnsPagedOut: number; notice: AgentMessage; madeAt: number };

const firstKeptIndex = (ms: AgentMessage[], cut: Cut) =>
	ms.findIndex((m) => isPrompt(m) && m.timestamp === cut.keepFrom);

const ENTRY_TYPE = "context-paging";
type SavedCut = { cut: Cut | null };

const isSavedCut = (entry: SessionEntry): entry is CustomEntry<SavedCut> =>
	entry.type === "custom" && entry.customType === ENTRY_TYPE;

/** The cut saved last on the current branch; undefined when there is none or paging dropped it. */
const savedCut = (ctx: ExtensionContext) => ctx.sessionManager.getBranch().findLast(isSavedCut)?.data?.cut ?? undefined;

/** A cut is stale when its first kept prompt is not in the history, as after a switch to another branch. */
const isStale = (ms: AgentMessage[], cut: Cut) => firstKeptIndex(ms, cut) < 0;

/** The view: whatever precedes the first prompt, the notice, then everything from the first kept prompt on. */
function applyCut(ms: AgentMessage[], cut: Cut): AgentMessage[] {
	return [...ms.slice(0, ms.findIndex(isPrompt)), cut.notice, ...ms.slice(firstKeptIndex(ms, cut))];
}

/**
 * How many turns to page out in total, so that at least `excess` estimated tokens leave beyond the
 * turns that are paged out already. The latest turn always stays, even if that is not enough.
 *
 * @returns undefined when only the latest turn is left
 */
function turnsToPageOut(ms: AgentMessage[], starts: number[], alreadyOut: number, excess: number): number | undefined {
	const latest = starts.length - 1;
	let dropped = 0;
	for (let turns = alreadyOut + 1; turns <= latest; turns++) {
		dropped += sumTokens(ms.slice(starts[turns - 1], starts[turns]));
		if (dropped >= excess) return turns;
	}
	return alreadyOut < latest ? latest : undefined;
}

/** The cut that follows a cut of `alreadyOut` turns, or undefined when no further turn can be paged out. */
function newCut(ms: AgentMessage[], alreadyOut: number, excess: number, sessionId: string): Cut | undefined {
	const starts = turnStarts(ms);
	const turns = turnsToPageOut(ms, starts, alreadyOut, excess);
	if (turns === undefined) return undefined;
	return {
		keepFrom: ms[starts[turns]].timestamp,
		turnsPagedOut: turns,
		notice: buildNotice(ms.slice(starts[0], starts[turns]), sessionId),
		madeAt: Date.now(),
	};
}

// ── Measuring ────────────────────────────────────────────────────────────────────────────────────

/** Size of the view: `tokens` as the provider counts, `estimated` as pi's estimator counts. */
type Load = { tokens: number; estimated: number };

const reportsUsageSince = (since: number) => (m: AgentMessage) =>
	m.role === "assistant" &&
	m.timestamp >= since &&
	m.stopReason !== "error" &&
	m.stopReason !== "aborted" &&
	calculateContextTokens(m.usage) > 0;

/** The usage of the latest successful response since `since`, plus an estimate of what came after it. 0 if there is none. */
function usageSince(ms: AgentMessage[], since: number): number {
	const i = ms.findLastIndex(reportsUsageSince(since));
	const m = ms[i];
	return m?.role === "assistant" ? calculateContextTokens(m.usage) + sumTokens(ms.slice(i + 1)) : 0;
}

/** How full the window is: the usage the provider reported, never less than the estimate. */
function measure(ms: AgentMessage[], cut: Cut | undefined): Load {
	const estimated = sumTokens(cut ? applyCut(ms, cut) : ms);
	return { estimated, tokens: Math.max(usageSince(ms, cut?.madeAt ?? 0), estimated) };
}

/** What has to go to reach `trimTo`, converted to estimated tokens, the unit turns are counted in. */
const excessOver = (trimTo: number, { tokens, estimated }: Load) =>
	(tokens - trimTo) * (estimated > 0 ? estimated / tokens : 1);

// ── The notice ───────────────────────────────────────────────────────────────────────────────────

// How many of the latest paged-out prompts the notice lists, besides the very first one.
const RECENT_PROMPTS = 4;
// Each prompt listed in the notice is clipped to this many characters.
const PROMPT_CHARS = 500;
// How many of the latest scratch files written in paged-out turns the notice lists.
const RECENT_NOTES = 6;
// A written file counts as a scratch file when its path contains this segment.
const SCRATCH_SEGMENT = "/_scratch/";
const HOME = homedir();

/** A prompt on one line, clipped. */
const promptText = (m: UserMessage) => {
	const text =
		typeof m.content === "string"
			? m.content
			: m.content.map((b) => (b.type === "text" ? b.text : "[image]")).join(" ");
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > PROMPT_CHARS ? `${flat.slice(0, PROMPT_CHARS)}...` : flat;
};

/** The paths a response wrote with the `write` and `edit` tools. Files written through `bash` are not seen. */
const writtenPaths = (m: AgentMessage): string[] =>
	m.role === "assistant"
		? m.content.flatMap((b) =>
				b.type === "toolCall" && (b.name === "write" || b.name === "edit") && typeof b.arguments.path === "string"
					? [b.arguments.path]
					: [],
			)
		: [];

const fromHome = (path: string) => (path.startsWith(`${HOME}/`) ? `~${path.slice(HOME.length)}` : path);

/** The scratch files the messages wrote: each once, ordered by its latest write, at most the latest RECENT_NOTES. */
const scratchNotes = (ms: AgentMessage[]) =>
	[...new Set(ms.flatMap(writtenPaths).map(fromHome).filter((p) => p.includes(SCRATCH_SEGMENT)).reverse())]
		.slice(0, RECENT_NOTES)
		.reverse();

function notesHint(pagedOut: AgentMessage[]): string[] {
	const notes = scratchNotes(pagedOut);
	return notes.length
		? [
				"Scratch files written in those turns; read them first if a decision or constraint seems missing:",
				...notes.map((path) => `- ${path}`),
			]
		: ["If a decision or constraint seems missing, check the scratch plan/research files first."];
}

/**
 * The message that takes the place of the paged-out turns.
 * It is not part of the stored session and carries timestamp 0, which no stored message has.
 *
 * @param pagedOut the messages of the paged-out turns, starting with the first prompt
 */
function buildNotice(pagedOut: AgentMessage[], sessionId: string): AgentMessage {
	const prompts = pagedOut.filter(isPrompt);
	const listed = [...new Set([prompts[0], ...prompts.slice(-RECENT_PROMPTS)])];
	const text = [
		`[context paging] Turns 1-${prompts.length} left the context window. Nothing was summarized.`,
		...notesHint(pagedOut),
		`Full history: session ${sessionId}; \`mem search --session ${sessionId} <terms> --json\` if explicitly asked to look back.`,
		"",
		"Earlier user requests (clipped):",
		...listed.map((m) => `- turn ${prompts.indexOf(m) + 1}: ${promptText(m)}`),
	].join("\n");
	return { role: "user", content: text, timestamp: 0 };
}

// ── The extension ────────────────────────────────────────────────────────────────────────────────

const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 5);
const paged = ({ turnsPagedOut: turns, madeAt }: Cut) =>
	`paged ${turns} ${turns === 1 ? "turn" : "turns"} at ${clock(madeAt)}`;

export default function contextPaging(pi: ExtensionAPI) {
	// State. The cut is also saved in the session, see savedCut.
	let cfg = DEFAULTS;
	let enabled = cfg.enabled;
	let cut: Cut | undefined;
	// The user sent a prompt and no request has gone out for it yet.
	let userTurnPending = false;
	// /page was run and no request has gone out since.
	let forceCut = false;

	// Reading the state.
	const limits = (ctx: ExtensionContext) =>
		limitsFor(cfg, ctx.getContextUsage()?.contextWindow ?? ctx.model?.contextWindow);
	const statusText = () => {
		if (!enabled) return "paging off";
		return cut ? paged(cut) : "paging on";
	};
	const showStatus = (ctx: ExtensionContext) => {
		if (ctx.hasUI) ctx.ui.setStatus("paging", statusText());
	};
	const report = (ctx: ExtensionContext) =>
		`paging ${enabled ? "on" : "off"}, ${cut ? paged(cut) : "no cut"}, usage ${ctx.getContextUsage()?.tokens ?? "unknown"} tokens`;

	// Changing the state.
	const forgetCut = (ctx: ExtensionContext) => {
		if (cut) pi.appendEntry<SavedCut>(ENTRY_TYPE, { cut: null });
		cut = undefined;
		showStatus(ctx);
	};
	const adopt = (next: Cut, ctx: ExtensionContext) => {
		const before = cut?.turnsPagedOut ?? 0;
		cut = next;
		pi.appendEntry<SavedCut>(ENTRY_TYPE, { cut: next });
		showStatus(ctx);
		ctx.ui.notify(`context paging: ${before} -> ${next.turnsPagedOut} turns`, "info");
	};
	const setEnabled = (on: boolean, ctx: ExtensionContext) => {
		enabled = on;
		forceCut = false;
		forgetCut(ctx);
	};
	const requestCut = () => {
		forceCut = true;
	};
	/**
	 * The size above which this request pages out. Only the first request after a prompt, or one
	 * after /page, may do so; any other request gets Infinity. Reading the triggers clears them.
	 */
	const takeThreshold = (soft: number) => {
		const threshold = forceCut ? 0 : userTurnPending ? soft : Infinity;
		forceCut = false;
		userTurnPending = false;
		return threshold;
	};

	// Handlers.
	const loadSettings = (_event: unknown, ctx: ExtensionContext) => {
		cfg = readConfig(pi);
		enabled = cfg.enabled;
		cut = savedCut(ctx);
		showStatus(ctx);
	};
	const notePrompt = (event: BeforeAgentStartEvent) => {
		userTurnPending = event.messageType === "user";
	};
	const onHistoryRewritten = (_event: unknown, ctx: ExtensionContext) => forgetCut(ctx);
	const cancelThresholdCompaction = (event: SessionBeforeCompactEvent): SessionBeforeCompactResult | undefined =>
		enabled && event.reason === "threshold" ? { cancel: true } : undefined;

	/** Runs before every request: moves the cut if this request may and the view is too large, then returns the view. */
	const pageOut = (event: ContextEvent, ctx: ExtensionContext): ContextEventResult | undefined => {
		if (!enabled) return undefined;
		const { soft, trimTo } = limits(ctx);
		const threshold = takeThreshold(soft);
		const history = event.messages;
		if (cut && isStale(history, cut)) forgetCut(ctx);

		const load = measure(history, cut);
		const next =
			load.tokens > threshold
				? newCut(history, cut?.turnsPagedOut ?? 0, excessOver(trimTo, load), ctx.sessionManager.getSessionId())
				: undefined;
		if (next) adopt(next, ctx);
		return cut ? { messages: applyCut(history, cut) } : undefined;
	};

	const pagingCommand = async (args: string, ctx: ExtensionContext) => {
		const action = args.trim() || "status";
		if (!["on", "off", "status"].includes(action)) {
			ctx.ui.notify(`Unknown argument "${action}". Use on | off | status`, "error");
			return;
		}
		if (action !== "status") setEnabled(action === "on", ctx);
		ctx.ui.notify(report(ctx), "info");
	};
	const pageCommand = async (_args: string, ctx: ExtensionContext) => {
		if (!enabled) {
			ctx.ui.notify("Context paging is off. Run /paging on first", "error");
			return;
		}
		requestCut();
		ctx.ui.notify("Next request pages out old turns", "info");
	};

	pi.on("session_start", loadSettings);
	pi.on("before_agent_start", notePrompt);
	pi.on("context", pageOut);
	pi.on("session_compact", onHistoryRewritten);
	pi.on("session_tree", onHistoryRewritten);
	pi.on("session_before_compact", cancelThresholdCompaction);
	pi.registerCommand("paging", { description: "Context paging: on | off | status", handler: pagingCommand });
	pi.registerCommand("page", { description: "Page out old turns on the next request", handler: pageCommand });
}
