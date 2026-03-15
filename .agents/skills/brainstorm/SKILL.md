---
name: brainstorm
description: >
  Guided ideation and design session. Use when the user asks to "brainstorm",
  wants to talk through an idea, or needs help turning a rough concept into a
  fully formed design, spec, or implementation plan.
---

# Brainstorm — Guided Design Session

## Phase 1: Understand the landscape

Before asking anything, study the current project in the working directory:

- Read key config files, entry points, and directory structure
- Identify the tech stack, patterns, and conventions in use
- Note any relevant existing features or domain concepts

Use this context to ask informed questions — never ask something the codebase
already answers.

## Phase 2: Discovery — one question at a time

Ask the user questions to refine the idea. Rules:

1. **One question per message.** Never batch questions.
2. **Prefer multiple-choice.** Offer 2–5 concrete options when possible,
   labelled a), b), c), etc. Include an "other / none of these" escape hatch.
3. Open-ended questions are acceptable when the answer space is too wide for
   useful options.
4. Start broad (goals, users, constraints) and progressively narrow
   (behaviour, edge cases, integration points).
5. Build on previous answers — don't re-ask what's already been established.
6. When you believe you have enough information to describe the design, tell
   the user you're ready to move to the design phase and ask for confirmation.

## Phase 3: Incremental design presentation

Present the design in sections of roughly 200–300 words each:

1. After each section, stop and ask: *"Does this look right so far?"*
2. Incorporate feedback before moving to the next section.
3. Typical section order (adapt as needed):
   - Problem statement & goals
   - High-level approach / architecture
   - Key data models or interfaces
   - Behaviour & flow
   - Edge cases & error handling
   - Integration points & dependencies
4. Once all sections are confirmed, present the full design as a consolidated
   summary.

## Phase 4: Implementation plan

After the design is accepted, produce a step-by-step implementation plan:

- Ordered, incremental steps — each should compile and pass tests
- Reference specific files, modules, and patterns from the existing codebase
- Call out risks, open questions, or decisions deferred to implementation time
- Ask the user whether they'd like to proceed with implementation
