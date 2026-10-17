/**
 * Tool Gate Extension
 *
 * Keeps heavy optional tools (and their prompt rules/sections) out of the
 * model's context until a prompt explicitly asks for them. A gate unlocks when
 * the prompt contains `tool_<gate>` or via `/unlock <gate>`, and stays open for
 * the session.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface Gate {
	name: string;
	tools: string[];
	lockedPattern?: RegExp;
	group?: string;
}

const GATES: Gate[] = [
	{ name: "todo", tools: ["todo"] },
	{
		name: "agent_browser",
		tools: ["agent_browser", "agent_browser_code", "agent_browser_tools", "agent_browser_web_search"],
		lockedPattern: /^agent_browser/,
		group: "browser",
	},
	{ name: "web_search", tools: ["web_search", "fetch_content", "get_search_content", "source_check"] },
	{ name: "heartbeat", tools: ["heartbeat"] },
];

const ENTRY_TYPE = "tool-gate";

type Instructions = (ctx: ExtensionContext) => string;

const triggerOf = (gate: Gate) => new RegExp(`\\btool_${gate.name}\\b`, "i");

const isGateTool = (gate: Gate, tool: string) => gate.lockedPattern?.test(tool) ?? gate.tools.includes(tool);

function unlockedFromBranch(ctx: ExtensionContext): Set<string> {
	const unlocked = new Set<string>();
	for (const entry of ctx.sessionManager.getBranch() as Array<{ type?: string; customType?: string; data?: { gate?: string } }>) {
		if (entry.type === "custom" && entry.customType === ENTRY_TYPE && entry.data?.gate) unlocked.add(entry.data.gate);
	}
	return unlocked;
}

export default function (pi: ExtensionAPI) {
	const instructionGroups = new Map<string, Instructions>();
	let unlocked = new Set<string>();

	const unlock = (gate: Gate) => {
		unlocked.add(gate.name);
		pi.appendEntry(ENTRY_TYPE, { gate: gate.name });
	};

	const applyLoadout = () => {
		const registered = new Set(pi.getAllTools().map((tool) => tool.name));
		const active = pi.getActiveTools();
		const locked = GATES.filter((gate) => !unlocked.has(gate.name));
		const opened = GATES.filter((gate) => unlocked.has(gate.name)).flatMap((gate) => gate.tools);
		const next = [...new Set([
			...active.filter((tool) => !locked.some((gate) => isGateTool(gate, tool))),
			...opened.filter((tool) => registered.has(tool)),
		])];
		const changed = next.length !== active.length || next.some((tool) => !active.includes(tool));
		if (changed) pi.setActiveTools(next);
	};

	pi.on("session_start", async (_event, ctx) => {
		pi.events.emit("pi:instruction-groups", {
			register: (group: { name: string; instructions: Instructions }) => instructionGroups.set(group.name, group.instructions),
			isManaged: () => true,
		});
		unlocked = unlockedFromBranch(ctx);
		applyLoadout();
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (event.messageType === "user") {
			GATES.filter((gate) => !unlocked.has(gate.name) && triggerOf(gate).test(event.prompt)).forEach((gate) => {
				unlock(gate);
				if (ctx.hasUI) ctx.ui.notify(`tool-gate: unlocked ${gate.name}`, "info");
			});
		}
		applyLoadout();
		for (const gate of GATES) {
			const instructions = gate.group && unlocked.has(gate.name) ? instructionGroups.get(gate.group) : undefined;
			if (instructions) event.systemPromptOptions.sections[gate.group!] = instructions(ctx);
		}
	});

	pi.registerCommand("unlock", {
		description: "Unlock a gated tool set for this session (no argument lists gates)",
		getArgumentCompletions: (prefix) =>
			GATES.filter((gate) => gate.name.startsWith(prefix)).map((gate) => ({ value: gate.name, label: gate.name })),
		handler: async (args, ctx) => {
			const gate = GATES.find((g) => g.name === args.trim());
			if (!gate) {
				const status = GATES.map((g) => `${g.name}: ${unlocked.has(g.name) ? "unlocked" : "locked"}`).join("\n");
				ctx.ui.notify(args.trim() ? `Unknown gate "${args.trim()}"\n${status}` : status, "info");
				return;
			}
			if (!unlocked.has(gate.name)) unlock(gate);
			applyLoadout();
			ctx.ui.notify(`tool-gate: unlocked ${gate.name}`, "info");
		},
	});
}
