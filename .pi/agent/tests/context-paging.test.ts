// Run with: bun test ~/.pi/agent/tests
//
// Pins how the context-paging extension behaves, driven through its handlers.
// Pi's two token functions are replaced by fakes, so sizes are plain numbers:
// a message weighs its `tokens` field, and a response reports `usage.tokens`.
// With the SMALL limits and the default sizes, one turn weighs 50 tokens.
import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { homedir } from "node:os";

process.env.TZ = "UTC";

mock.module("@earendil-works/pi-coding-agent", () => ({
	estimateTokens: (message: { tokens?: number }) => message.tokens ?? 0,
	calculateContextTokens: (usage: { tokens?: number }) => usage?.tokens ?? 0,
}));
const { default: contextPaging } = await import("../extensions/context-paging.ts");

type Message = { role: string; content: unknown; timestamp: number; tokens: number; [key: string]: unknown };
type Settings = { enabled?: boolean; maxSoftTokens?: number; maxTrimToTokens?: number };
type Pi = { window?: number; modelWindow?: number; piUsageTokens?: number };

const SMALL: Settings = { maxSoftTokens: 100, maxTrimToTokens: 60 };
const SCRATCH = "~/jcloud/org/_scratch/dev";

const prompt = (turn: number, tokens = 10, content: unknown = `prompt ${turn}`): Message => ({
	role: "user",
	content,
	timestamp: turn * 100,
	tokens,
});
const reply = (turn: number, tokens = 40, extra: Record<string, unknown> = {}): Message => ({
	role: "assistant",
	content: [{ type: "text", text: `reply ${turn}` }],
	timestamp: turn * 100 + 50,
	tokens,
	usage: { tokens: 0 },
	stopReason: "stop",
	...extra,
});
const turns = (count: number, replyTokens = 40): Message[] =>
	Array.from({ length: count }, (_, i) => [prompt(i + 1), reply(i + 1, replyTokens)]).flat();
const toolCall = (name: string, args: Record<string, unknown>) => ({ type: "toolCall", id: "call", name, arguments: args });

const isNotice = (m: Message) => m.role === "user" && m.timestamp === 0;
const label = (m: Message) => {
	if (isNotice(m)) return `notice: turns ${/Turns (\S+)/.exec(String(m.content))?.[1]}`;
	if (m.role === "user") return `prompt ${m.timestamp / 100}`;
	return m.role === "assistant" ? `reply ${Math.floor(m.timestamp / 100)}` : m.role;
};
const labels = (ms: Message[]) => ms.map(label);
const noticeLines = (ms: Message[]) => String(ms.find(isNotice)?.content).split("\n");

function startPi(settings: Settings = SMALL, { window, modelWindow, piUsageTokens }: Pi = {}) {
	const handlers: Record<string, (event: unknown, ctx: unknown) => unknown> = {};
	const commands: Record<string, (args: string, ctx: unknown) => unknown> = {};
	const notifications: string[] = [];
	const statuses: string[] = [];
	contextPaging({
		on: (name: string, handler: (event: unknown, ctx: unknown) => unknown) => (handlers[name] = handler),
		getSettings: () => ({ contextPaging: settings }),
		registerCommand: (name: string, command: { handler: (args: string, ctx: unknown) => unknown }) =>
			(commands[name] = command.handler),
	} as never);
	const ctx = {
		hasUI: true,
		ui: {
			notify: (text: string) => notifications.push(text),
			setStatus: (_key: string, text: string) => statuses.push(text),
		},
		getContextUsage: () =>
			window || piUsageTokens ? { contextWindow: window, tokens: piUsageTokens } : undefined,
		model: modelWindow ? { contextWindow: modelWindow } : undefined,
		sessionManager: { getSessionId: () => "session-1" },
	};
	// What the model is sent for this history. The request happens right after the last message.
	const request = (history: Message[]): Message[] => {
		setSystemTime(new Date(history.at(-1)!.timestamp + 1));
		const result = handlers.context({ messages: history }, ctx) as { messages: Message[] } | undefined;
		return result?.messages ?? history;
	};
	handlers.session_start({}, ctx);
	return {
		// The first request after the user sent a prompt.
		prompt: (history: Message[]) => {
			handlers.before_agent_start({ messageType: "user" }, ctx);
			return request(history);
		},
		// Any later request of the same turn, as in a tool loop.
		request,
		command: (name: string, args = "") => commands[name](args, ctx),
		emit: (name: string, event: unknown = {}) => handlers[name](event, ctx),
		notifications,
		status: () => statuses.at(-1),
	};
}

afterEach(() => setSystemTime());

describe("when it pages", () => {
	test("a history at the soft limit is left untouched", () => {
		const pi = startPi(SMALL);
		const history = [...turns(1), prompt(2, 50)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["prompt 1", "reply 1", "prompt 2"]);
		expect(pi.notifications).toEqual([]);
		expect(pi.status()).toBe("paging on");
	});

	test("the first request after a prompt pages out old turns once the history is over the soft limit", () => {
		const pi = startPi(SMALL);
		const history = [...turns(2), prompt(3)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-1", "prompt 2", "reply 2", "prompt 3"]);
		expect(pi.notifications).toEqual(["context paging: 0 -> 1 turns"]);
		expect(pi.status()).toBe("paged 1 turn at 00:00");
	});

	test("the status tells the time it last paged", () => {
		const pi = startPi(SMALL);
		const at1042 = Date.UTC(2026, 10, 17, 10, 42);
		const history = [...turns(2), prompt(3)].map((m) => ({ ...m, timestamp: m.timestamp + at1042 }));

		pi.prompt(history);

		expect(pi.status()).toBe("paged 1 turn at 10:42");
	});

	test("a request inside a tool loop never pages, however large the history has grown", () => {
		const pi = startPi(SMALL);
		const history = [...turns(1), prompt(2)];
		pi.prompt(history);

		const seen = pi.request([...history, reply(2, 400)]);

		expect(labels(seen)).toEqual(["prompt 1", "reply 1", "prompt 2", "reply 2"]);
		expect(pi.notifications).toEqual([]);
	});

	test("paging disabled in the settings leaves every history untouched", () => {
		const pi = startPi({ ...SMALL, enabled: false });
		const history = [...turns(4), prompt(5)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(labels(history));
		expect(pi.status()).toBe("paging off");
	});
});

describe("where it cuts", () => {
	test("it pages out as many whole turns as it takes to reach the trim target", () => {
		const pi = startPi(SMALL);
		const history = [...turns(4), prompt(5)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-3", "prompt 4", "reply 4", "prompt 5"]);
		expect(pi.status()).toBe("paged 3 turns at 00:00");
	});

	test("the latest turn is kept even when it alone is over the trim target", () => {
		const pi = startPi(SMALL);
		const history = [...turns(1), prompt(2, 500)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-1", "prompt 2"]);
	});

	test("a history of a single turn is never paged", () => {
		const pi = startPi(SMALL);
		const history = [prompt(1, 500)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["prompt 1"]);
		expect(pi.notifications).toEqual([]);
	});

	test("the cut stays applied to the later requests of the turn", () => {
		const pi = startPi(SMALL);
		const history = [...turns(2), prompt(3)];
		pi.prompt(history);

		const seen = pi.request([...history, reply(3)]);

		expect(labels(seen)).toEqual(["notice: turns 1-1", "prompt 2", "reply 2", "prompt 3", "reply 3"]);
	});

	test("a later prompt moves the cut forward and keeps counting turns from the start", () => {
		const pi = startPi(SMALL);
		pi.prompt([...turns(2), prompt(3)]);

		const seen = pi.prompt([...turns(3), prompt(4)]);

		expect(labels(seen)).toEqual(["notice: turns 1-2", "prompt 3", "reply 3", "prompt 4"]);
		expect(pi.notifications).toEqual(["context paging: 0 -> 1 turns", "context paging: 1 -> 2 turns"]);
	});

	test("messages before the first prompt stay in front of the notice", () => {
		const pi = startPi(SMALL);
		const preamble: Message = { role: "custom", content: "session info", timestamp: 1, tokens: 0 };

		const seen = pi.prompt([preamble, ...turns(2), prompt(3)]);

		expect(labels(seen)).toEqual(["custom", "notice: turns 1-1", "prompt 2", "reply 2", "prompt 3"]);
	});
});

describe("how it measures the history", () => {
	test("usage reported by the provider counts when it is higher than the estimate", () => {
		const pi = startPi(SMALL);
		const history = [prompt(1), reply(1, 40, { usage: { tokens: 200 } }), prompt(2)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-1", "prompt 2"]);
	});

	test("the estimate counts when it is higher than the reported usage", () => {
		const pi = startPi(SMALL);
		const history = [prompt(1), reply(1, 40, { usage: { tokens: 20 } }), prompt(2, 80)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-1", "prompt 2"]);
	});

	test("when the provider counts twice what the estimate does, it drops just enough turns for the reported size to reach the trim target", () => {
		const pi = startPi({ maxSoftTokens: 300, maxTrimToTokens: 200 });
		const history = [...turns(5), prompt(6), reply(6, 40, { usage: { tokens: 600 } }), prompt(7)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-5", "prompt 6", "reply 6", "prompt 7"]);
	});

	test.each(["error", "aborted"])("usage on a response that ended with %s is ignored", (stopReason) => {
		const pi = startPi(SMALL);
		const failed = reply(2, 0, { usage: { tokens: 5000 }, stopReason });
		const history = [...turns(1), prompt(2), failed, prompt(3)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["prompt 1", "reply 1", "prompt 2", "reply 2", "prompt 3"]);
	});

	test("the context usage pi itself reports is ignored", () => {
		const pi = startPi(SMALL, { piUsageTokens: 1_000_000 });
		const history = [...turns(1), prompt(2)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["prompt 1", "reply 1", "prompt 2"]);
	});

	test("usage reported before the cut was made no longer counts", () => {
		const pi = startPi(SMALL);
		const history = [prompt(1), reply(1, 40, { usage: { tokens: 200 } }), prompt(2)];
		pi.prompt(history);

		const seen = pi.prompt([...history, reply(2), prompt(3)]);

		expect(labels(seen)).toEqual(["notice: turns 1-1", "prompt 2", "reply 2", "prompt 3"]);
		expect(pi.notifications).toEqual(["context paging: 0 -> 1 turns"]);
	});

	test("usage reported after the cut was made counts", () => {
		const pi = startPi(SMALL);
		const history = [...turns(2), prompt(3)];
		pi.prompt(history);

		const seen = pi.prompt([...history, reply(3, 40, { usage: { tokens: 300 } }), prompt(4)]);

		expect(labels(seen)).toEqual(["notice: turns 1-3", "prompt 4"]);
	});
});

describe("which limits apply", () => {
	test("on a large window the ceilings of 180k and 100k tokens apply", () => {
		const pi = startPi({}, { window: 1_000_000 });
		const history = [...turns(3, 59_990), prompt(4)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-2", "prompt 3", "reply 3", "prompt 4"]);
	});

	test("on a small window it pages above half the window, down to 30% of it", () => {
		const pi = startPi({}, { window: 1000 });
		const history = [...turns(3, 160), prompt(4)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-2", "prompt 3", "reply 3", "prompt 4"]);
	});

	test("a history of exactly half a small window is left untouched", () => {
		const pi = startPi({}, { window: 1000 });
		const history = [...turns(2, 190), prompt(3, 100)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(labels(history));
	});

	test("the model's window is used when pi reports no context usage", () => {
		const pi = startPi({}, { modelWindow: 1000 });
		const history = [...turns(3, 160), prompt(4)];

		const seen = pi.prompt(history);

		expect(labels(seen)).toEqual(["notice: turns 1-2", "prompt 3", "reply 3", "prompt 4"]);
	});
});

describe("commands and resets", () => {
	test("/page pages out on the next request, even below the soft limit", () => {
		const pi = startPi(SMALL);
		const history = [...turns(1), prompt(2)];
		pi.prompt(history);
		pi.command("page");

		const seen = pi.request(history);

		expect(labels(seen)).toEqual(["notice: turns 1-1", "prompt 2"]);
		expect(pi.notifications).toEqual(["Next request pages out old turns", "context paging: 0 -> 1 turns"]);
	});

	test("/page pages out once, not again on the requests that follow", () => {
		const pi = startPi(SMALL);
		const history = [...turns(1), prompt(2)];
		pi.command("page");
		pi.request(history);

		const seen = pi.request([...history, reply(2), prompt(3)]);

		expect(labels(seen)).toEqual(["notice: turns 1-1", "prompt 2", "reply 2", "prompt 3"]);
	});

	test("/page is refused while paging is off", () => {
		const pi = startPi({ ...SMALL, enabled: false });

		pi.command("page");

		expect(pi.notifications).toEqual(["Context paging is off. Run /paging on first"]);
	});

	test("/paging off restores the full history", () => {
		const pi = startPi(SMALL);
		const history = [...turns(2), prompt(3)];
		pi.prompt(history);

		pi.command("paging", "off");

		expect(labels(pi.prompt(history))).toEqual(labels(history));
		expect(pi.status()).toBe("paging off");
	});

	test("/paging on starts again without the earlier cut", () => {
		const pi = startPi(SMALL);
		const history = [...turns(2), prompt(3)];
		pi.prompt(history);
		pi.command("paging", "off");

		pi.command("paging", "on");

		expect(labels(pi.request(history))).toEqual(labels(history));
		expect(pi.status()).toBe("paging on");
	});

	test("/paging reports whether it is on and how much is paged out", () => {
		const pi = startPi(SMALL);
		pi.prompt([...turns(2), prompt(3)]);

		pi.command("paging");

		expect(pi.notifications.at(-1)).toBe("paging on, paged 1 turn at 00:00, usage unknown tokens");
	});

	test("/paging reports the context usage pi knows, and that nothing is paged out", () => {
		const pi = startPi(SMALL, { piUsageTokens: 1234 });

		pi.command("paging", "status");

		expect(pi.notifications).toEqual(["paging on, no cut, usage 1234 tokens"]);
	});

	test("/paging off reports the new state", () => {
		const pi = startPi(SMALL);

		pi.command("paging", " off ");

		expect(pi.notifications).toEqual(["paging off, no cut, usage unknown tokens"]);
	});

	test("/paging with an unknown argument is refused and changes nothing", () => {
		const pi = startPi(SMALL);
		const history = [...turns(2), prompt(3)];
		pi.prompt(history);

		pi.command("paging", "pause");

		expect(pi.notifications.at(-1)).toBe('Unknown argument "pause". Use on | off | status');
		expect(labels(pi.request(history))).toEqual(["notice: turns 1-1", "prompt 2", "reply 2", "prompt 3"]);
	});

	test("/paging on cancels a pending /page", () => {
		const pi = startPi(SMALL);
		const history = [...turns(1), prompt(2)];
		pi.command("page");

		pi.command("paging", "on");

		expect(labels(pi.request(history))).toEqual(["prompt 1", "reply 1", "prompt 2"]);
	});

	test.each(["session_compact", "session_tree"])("%s drops the cut", (event) => {
		const pi = startPi(SMALL);
		const history = [...turns(2), prompt(3)];
		pi.prompt(history);

		pi.emit(event);

		expect(labels(pi.request(history))).toEqual(labels(history));
		expect(pi.status()).toBe("paging on");
	});

	test("a cut whose first kept prompt is no longer in the history is dropped", () => {
		const pi = startPi(SMALL);
		pi.prompt([...turns(2), prompt(3)]);
		const otherBranch = [prompt(7), reply(7), prompt(8)];

		const seen = pi.request(otherBranch);

		expect(labels(seen)).toEqual(["prompt 7", "reply 7", "prompt 8"]);
		expect(pi.status()).toBe("paging on");
	});

	test.each([
		{ enabled: true, reason: "threshold", expected: { cancel: true } },
		{ enabled: true, reason: "manual", expected: undefined },
		{ enabled: false, reason: "threshold", expected: undefined },
	])("compaction for reason $reason with paging enabled=$enabled returns $expected", ({ enabled, reason, expected }) => {
		const pi = startPi({ ...SMALL, enabled });

		const answer = pi.emit("session_before_compact", { reason });

		expect(answer).toEqual(expected);
	});
});

describe("the notice", () => {
	test("it says what left, where the full history is, and what was asked", () => {
		const pi = startPi(SMALL);

		const seen = pi.prompt([...turns(2), prompt(3)]);

		expect(noticeLines(seen)).toEqual([
			"[context paging] Turns 1-1 left the context window. Nothing was summarized.",
			"If a decision or constraint seems missing, check the scratch plan/research files first.",
			"Full history: session session-1; `mem search --session session-1 <terms> --json` if explicitly asked to look back.",
			"",
			"Earlier user requests (clipped):",
			"- turn 1: prompt 1",
		]);
	});

	test("it lists the first and the latest four of the paged-out prompts", () => {
		const pi = startPi(SMALL);

		const seen = pi.prompt([...turns(7), prompt(8)]);

		expect(noticeLines(seen).slice(0, 1)).toEqual([
			"[context paging] Turns 1-6 left the context window. Nothing was summarized.",
		]);
		expect(noticeLines(seen).slice(5)).toEqual([
			"- turn 1: prompt 1",
			"- turn 3: prompt 3",
			"- turn 4: prompt 4",
			"- turn 5: prompt 5",
			"- turn 6: prompt 6",
		]);
	});

	test("a long prompt is put on one line and clipped to 500 characters", () => {
		const pi = startPi(SMALL);
		const long = prompt(1, 10, `first  line\nsecond ${"x".repeat(600)}`);

		const seen = pi.prompt([long, reply(1), ...turns(2).slice(2), prompt(3)]);

		expect(noticeLines(seen).at(-1)).toBe(`- turn 1: first line second ${"x".repeat(482)}...`);
	});

	test("an image in a prompt is shown as a placeholder", () => {
		const pi = startPi(SMALL);
		const withImage = prompt(1, 10, [{ type: "text", text: "what is this" }, { type: "image", data: "…" }]);

		const seen = pi.prompt([withImage, reply(1), ...turns(2).slice(2), prompt(3)]);

		expect(noticeLines(seen).at(-1)).toBe("- turn 1: what is this [image]");
	});

	test("it names the scratch files written or edited in the paged-out turns, each once, latest write last", () => {
		const pi = startPi(SMALL);
		const wrote = reply(1, 40, {
			content: [
				toolCall("write", { path: `${homedir()}/jcloud/org/_scratch/dev/plans/plan.md`, content: "v1" }),
				toolCall("edit", { path: `${SCRATCH}/research/notes.md`, edits: [] }),
				toolCall("write", { path: `${homedir()}/jcloud/org/_scratch/dev/plans/plan.md`, content: "v2" }),
				toolCall("write", { path: `${homedir()}/dev/app/src/main.ts`, content: "code" }),
				toolCall("read", { path: `${SCRATCH}/research/only-read.md` }),
				toolCall("bash", { command: `cat ${SCRATCH}/research/only-mentioned.md` }),
			],
		});

		const seen = pi.prompt([prompt(1), wrote, ...turns(2).slice(2), prompt(3)]);

		expect(noticeLines(seen).slice(1, 5)).toEqual([
			"Scratch files written in those turns; read them first if a decision or constraint seems missing:",
			`- ${SCRATCH}/research/notes.md`,
			`- ${SCRATCH}/plans/plan.md`,
			"Full history: session session-1; `mem search --session session-1 <terms> --json` if explicitly asked to look back.",
		]);
	});

	test("it lists at most the six most recently written scratch files", () => {
		const pi = startPi(SMALL);
		const wrote = reply(1, 40, {
			content: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => toolCall("write", { path: `${SCRATCH}/plans/${n}.md` })),
		});

		const seen = pi.prompt([prompt(1), wrote, ...turns(2).slice(2), prompt(3)]);

		expect(noticeLines(seen).slice(2, 9)).toEqual([
			`- ${SCRATCH}/plans/3.md`,
			`- ${SCRATCH}/plans/4.md`,
			`- ${SCRATCH}/plans/5.md`,
			`- ${SCRATCH}/plans/6.md`,
			`- ${SCRATCH}/plans/7.md`,
			`- ${SCRATCH}/plans/8.md`,
			"Full history: session session-1; `mem search --session session-1 <terms> --json` if explicitly asked to look back.",
		]);
	});

	test("a scratch file written in a turn that is still visible is not listed", () => {
		const pi = startPi(SMALL);
		const wrote = reply(2, 40, { content: [toolCall("write", { path: `${SCRATCH}/plans/plan.md` })] });

		const seen = pi.prompt([...turns(1), prompt(2), wrote, prompt(3)]);

		expect(noticeLines(seen)[1]).toBe(
			"If a decision or constraint seems missing, check the scratch plan/research files first.",
		);
	});
});
