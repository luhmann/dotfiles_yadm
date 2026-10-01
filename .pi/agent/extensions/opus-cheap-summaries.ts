/**
 * `jfd/opus`: Opus 5.5 for the conversation, GPT-6.1 Sol for side requests (compaction and
 * branch summaries, extension calls through `ctx.modelRegistry.streamSimple()`).
 *
 * Side requests fall back to Opus when Sol is unavailable or the conversation is too large for
 * Sol's 272K window: compaction does not chunk its input, and Opus sessions grow towards 1M.
 */

import type { Message } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, ModelRoute, ModelRouteRequest } from "@earendil-works/pi-coding-agent";
import { estimateTokens } from "@earendil-works/pi-coding-agent";

const MAIN = { provider: "anthropic", id: "claude-opus-5-5" } as const;
const SIDE = { provider: "openai-codex", id: "gpt-6.1-sol" } as const;
const SIDE_THINKING = "medium";
/** Headroom below Sol's context window for instructions and the summary itself. */
const SIDE_MAX_INPUT_TOKENS = 200_000;

const conversationTokens = (messages: readonly Message[]): number =>
	messages.reduce((sum, message) => sum + estimateTokens(message), 0);

const findAvailable = (ctx: ExtensionContext, ref: { provider: string; id: string }) => {
	const model = ctx.modelRegistry.find(ref.provider, ref.id);
	return model && ctx.modelRegistry.hasConfiguredAuth(model) ? model : undefined;
};

const routeMain = (request: ModelRouteRequest, ctx: ExtensionContext): ModelRoute => {
	const model = ctx.modelRegistry.find(MAIN.provider, MAIN.id);
	if (!model) throw new Error(`jfd/opus: ${MAIN.provider}/${MAIN.id} is not in the model catalog`);
	return { model, thinkingLevel: request.thinkingLevel };
};

const routeSide = (request: ModelRouteRequest, ctx: ExtensionContext): ModelRoute => {
	const side = findAvailable(ctx, SIDE);
	const fits = conversationTokens(request.messages) <= SIDE_MAX_INPUT_TOKENS;
	return side && fits ? { model: side, thinkingLevel: SIDE_THINKING } : routeMain(request, ctx);
};

export default function (pi: ExtensionAPI) {
	pi.registerVirtualModel({
		provider: "jfd",
		id: "opus",
		name: "Opus (Sol summaries)",
		thinkingLevels: ["off", "low", "medium", "high", "xhigh"],
		contextWindow: 1_000_000,
		maxTokens: 128_000,
		route: (request, ctx) => (request.reason === "direct" ? routeSide(request, ctx) : routeMain(request, ctx)),
	});
}
