/**
 * `jfd/opus`: Opus 5.5 for the conversation, Sonnet 5.5 without thinking for side requests
 * (compaction and branch summaries, extension calls through `ctx.modelRegistry.streamSimple()`).
 *
 * Measured on a ~160K-token session, Sonnet/off compacted in 37s versus 44s for Opus/medium and
 * kept the same facts. Side requests fall back to Opus when Sonnet is unavailable.
 */

import type { ExtensionAPI, ExtensionContext, ModelRoute, ModelRouteRequest } from "@earendil-works/pi-coding-agent";

const MAIN = { provider: "anthropic", id: "claude-opus-5-5" } as const;
const SIDE = { provider: "anthropic", id: "claude-sonnet-5-5" } as const;
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
		name: "Opus (Sonnet summaries)",
		thinkingLevels: ["off", "low", "medium", "high", "xhigh"],
		contextWindow: 1_000_000,
		maxTokens: 128_000,
		route: (request, ctx) => (request.reason === "direct" ? routeSide(request, ctx) : routeMain(request, ctx)),
	});
}
