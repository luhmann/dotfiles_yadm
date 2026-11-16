// Run with: bun test ~/.pi/agent/tests
//
// Pins what context-paging assumes about the installed pi. A failure here means
// pi changed, not the extension: its limits are calibrated against these numbers,
// and the fakes in context-paging.test.ts stand in for these two functions.
import { describe, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";

const cli = Bun.which("pi");
if (!cli) throw new Error("pi is not on the PATH, so its token functions cannot be checked");
const packageRoot = join(dirname(realpathSync(cli)), "..", "..");
const { estimateTokens, calculateContextTokens } = await import(join(packageRoot, "dist/index.js"));

describe("estimateTokens", () => {
	test("a prompt weighs a quarter of its characters, rounded up", () => {
		const prompt = { role: "user", content: "x".repeat(4001), timestamp: 1 };

		expect(estimateTokens(prompt)).toBe(1001);
	});

	test("the paging notice, a prompt with timestamp 0, weighs like any other prompt", () => {
		const notice = { role: "user", content: "x".repeat(400), timestamp: 0 };

		expect(estimateTokens(notice)).toBe(100);
	});

	test("a prompt made of blocks weighs its text plus 1,200 tokens per image", () => {
		const prompt = {
			role: "user",
			content: [
				{ type: "text", text: "x".repeat(400) },
				{ type: "image", data: "AAAA", mimeType: "image/png" },
			],
			timestamp: 1,
		};

		expect(estimateTokens(prompt)).toBe(1300);
	});

	test("a response weighs its text, its thinking, and the name and arguments of its tool calls", () => {
		const response = {
			role: "assistant",
			content: [
				{ type: "text", text: "x".repeat(400) },
				{ type: "thinking", thinking: "y".repeat(200) },
				{ type: "toolCall", id: "call", name: "edit", arguments: { path: "a.md" } },
			],
		};

		expect(estimateTokens(response)).toBe(155);
	});

	test("a tool result weighs a quarter of its text", () => {
		const result = { role: "toolResult", content: [{ type: "text", text: "x".repeat(800) }] };

		expect(estimateTokens(result)).toBe(200);
	});
});

describe("calculateContextTokens", () => {
	test("the total the provider reports is taken as it is", () => {
		const usage = { input: 1, output: 1, cacheRead: 1, cacheWrite: 1, totalTokens: 1234 };

		expect(calculateContextTokens(usage)).toBe(1234);
	});

	test("without a total it adds input, output, cache reads and cache writes", () => {
		const usage = { input: 100, output: 20, cacheRead: 300, cacheWrite: 50, totalTokens: 0 };

		expect(calculateContextTokens(usage)).toBe(470);
	});

	test("a response that reports no usage counts as zero", () => {
		const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 };

		expect(calculateContextTokens(usage)).toBe(0);
	});
});
