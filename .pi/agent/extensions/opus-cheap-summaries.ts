/**
 * `jfd/opus`: Opus 5.5 for the conversation, Haiku 5.5 without thinking for side requests
 * (compaction and branch summaries, extension calls through `ctx.modelRegistry.streamSimple()`).
 *
 * Measured on a ~124K-input compaction, Haiku/off took 15-21s versus 37-46s for Sonnet/off at ~1/4
 * the cost and kept the same facts. Side requests fall back to Opus when Haiku is unavailable.
 */

import type { ExtensionAPI, ExtensionContext, ModelRoute, ModelRouteRequest } from "@earendil-works/pi-coding-agent";

const MAIN = { provider: "anthropic", id: "claude-opus-5-5" } as const;
const SIDE = { provider: "anthropic", id: "claude-haiku-5-5" } as const;
const SIDE_THINKING = "off";

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
	return side ? { model: side, thinkingLevel: SIDE_THINKING } : routeMain(request, ctx);
};

export default function (pi: ExtensionAPI) {
	pi.registerVirtualModel({
		provider: "jfd",
		id: "opus",
		name: "Opus (Haiku summaries)",
		thinkingLevels: ["off", "low", "medium", "high", "xhigh"],
		contextWindow: 1_000_000,
		maxTokens: 128_000,
		route: (request, ctx) => (request.reason === "direct" ? routeSide(request, ctx) : routeMain(request, ctx)),
	});
}
