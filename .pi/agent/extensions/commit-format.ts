/**
 * Commit Message Format Extension
 *
 * Enforces a uniform commit message style across all projects:
 * - Simple imperative subject line (capitalized, no period, max 72 chars)
 * - Required body with Why, What, and Modules sections
 * - Footer with ticket reference (inferred from branch) and optional breaking change
 *
 * Works by:
 * 1. Providing a tool to get the current branch's ticket reference
 * 2. Intercepting git commit commands to validate format; on violations
 *    the full format guidelines are returned so the agent can self-correct
 *
 * The guidelines themselves live in the commit skill
 * (~/.agents/skills/commit/SKILL.md) and are loaded on demand — they are
 * intentionally NOT injected into every system prompt.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const TICKET_PATTERN = /^([A-Z]+-\d+)/;

const COMMIT_FORMAT_GUIDELINES = `
## Commit Message Format

When writing git commit messages, ALWAYS follow this exact format:

\`\`\`
<Imperative subject line, capitalized, no period, max 72 chars>

**Why**

<Context and reasoning for future decision-making by agents and humans.
Wrap lines at 72 characters. Explain the motivation and background.>

**What**

- <High level bullet point describing a change>
- <Another bullet point>

**Modules:** <comma-separated list of affected high-level modules>

Refs: <TICKET-ID>
BREAKING CHANGE: <description, ONLY if this is a breaking change>
\`\`\`

**Rules:**
1. Subject line: Imperative mood ("Add" not "Added"), capitalized, no trailing period, max 72 chars
2. Blank line after subject
3. "**Why**" section: Required. Bold inline label on its own line, followed by a blank line and a paragraph. Provide context that aids future decisions for both agents and human developers
4. "**What**" section: Required. Bold inline label on its own line, followed by a blank line and bullet points of what changed
5. "**Modules:**" line: Required. Bold inline label followed by a comma-separated list (e.g., \`**Modules:** auth, api, config\`)
6. Blank lines between sections
7. "Refs:" footer: Include ticket reference. Use \`get_branch_ticket\` tool to get it from the branch name
8. "BREAKING CHANGE:" footer: Only include if there are breaking changes. Omit entirely otherwise
9. All body lines wrap at 72 characters

**Example:**
\`\`\`
Add OAuth2 login flow for external providers

**Why**

Users need to authenticate via external identity providers like Google
and GitHub. This enables enterprise SSO requirements and reduces
password management burden for end users.

**What**

- Implement OAuth2 authorization code flow
- Add provider configuration for Google and GitHub
- Create callback handling and token exchange

**Modules:** auth, api, config

Refs: NOR-456
\`\`\`
`.trim();

function validateCommitMessage(message: string): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	const lines = message.split("\n");

	// Check subject line
	const subject = lines[0] || "";

	if (!subject) {
		errors.push("Missing subject line");
		return { valid: false, errors };
	}

	if (subject.length > 72) {
		errors.push(`Subject line too long: ${subject.length} chars (max 72)`);
	}

	if (subject[0] && subject[0] !== subject[0].toUpperCase()) {
		errors.push("Subject line must start with a capital letter");
	}

	if (subject.endsWith(".")) {
		errors.push("Subject line should not end with a period");
	}

	// Check for required sections
	const fullMessage = message.toLowerCase();

	if (!fullMessage.includes("**why**")) {
		errors.push('Missing required "**Why**" section');
	}

	if (!fullMessage.includes("**what**")) {
		errors.push('Missing required "**What**" section');
	}

	if (!fullMessage.includes("**modules:**")) {
		errors.push('Missing required "**Modules:**" line');
	}

	if (!message.includes("Refs:")) {
		errors.push('Missing "Refs:" footer with ticket reference');
	}

	return { valid: errors.length === 0, errors };
}

function extractMessageFromCommand(command: string): string | null {
	// Heredoc first: -m "$(cat <<'EOF' ... EOF)" — the generic quoted
	// patterns below would otherwise capture the $(cat <<'EOF' scaffolding
	// as part of the message, producing bogus validation errors
	const heredoc = command.match(/-m\s+"\$\(cat\s+<<\s*'?(\w+)'?\n([\s\S]*?)\n\1\s*\n?\s*\)"/);
	if (heredoc && heredoc[2]) {
		return heredoc[2];
	}

	// Match -m "message" or -m 'message' patterns
	const patterns = [
		/-m\s+"([^"]+)"/,
		/-m\s+'([^']+)'/,
		/--message[=\s]+"([^"]+)"/,
		/--message[=\s]+'([^']+)'/,
	];

	for (const pattern of patterns) {
		const match = command.match(pattern);
		if (match && match[1]) {
			return match[1];
		}
	}

	// Check for heredoc or multi-line -m with $'...' syntax
	const dollarQuote = command.match(/-m\s+\$'([^']+)'/);
	if (dollarQuote && dollarQuote[1]) {
		return dollarQuote[1].replace(/\\n/g, "\n");
	}

	return null;
}

export default function (pi: ExtensionAPI) {
	// Register tool to get ticket reference from branch name
	pi.registerTool({
		name: "get_branch_ticket",
		label: "Get Branch Ticket",
		description:
			"Gets the ticket reference (e.g., PROJ-123) from the current git branch name. Use this before writing commit messages to get the correct Refs: value.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, signal, _onUpdate, _ctx) {
			const { stdout: branch, code } = await pi.exec("git", ["branch", "--show-current"], { signal });

			if (code !== 0) {
				return {
					content: [{ type: "text", text: "Error: Not in a git repository or git command failed" }],
					details: { error: true },
				};
			}

			const branchName = branch.trim();
			const match = branchName.match(TICKET_PATTERN);

			if (match && match[1]) {
				return {
					content: [{ type: "text", text: `Ticket: ${match[1]}\nBranch: ${branchName}` }],
					details: { ticket: match[1], branch: branchName },
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `No ticket reference found in branch name: ${branchName}\nExpected pattern: PROJ-123-description\nYou may need to ask the user for the ticket reference.`,
					},
				],
				details: { ticket: null, branch: branchName },
			};
		},
	});

	// Intercept git commit commands to validate format
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const command = event.input.command;

		// Check if this is a git commit command
		if (!command.includes("git commit")) {
			return;
		}

		// Skip if it's an amend or fixup (different workflow)
		if (command.includes("--amend") || command.includes("--fixup")) {
			return;
		}

		// Try to extract the commit message; editor/-F workflows can't be
		// validated — let them through silently
		const message = extractMessageFromCommand(command);
		if (!message) {
			return;
		}

		// Validate the message
		const { valid, errors } = validateCommitMessage(message);

		if (!valid) {
			const errorList = errors.map((e) => `• ${e}`).join("\n");
			const blockReason = `Commit blocked due to format issues:\n${errorList}\n\nRewrite the commit message to follow this format:\n\n${COMMIT_FORMAT_GUIDELINES}`;

			if (ctx.hasUI) {
				const proceed = await ctx.ui.confirm(
					"Commit Format Issues",
					`The commit message has format issues:\n\n${errorList}\n\nProceed anyway?`
				);

				if (!proceed) {
					return { block: true, reason: blockReason };
				}
			} else {
				return { block: true, reason: blockReason };
			}
		}
	});

	// Notify on load
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI) {
			ctx.ui.setStatus("commit-format", "📝");
		}
	});
}
