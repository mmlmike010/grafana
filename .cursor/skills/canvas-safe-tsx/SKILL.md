---
name: canvas-safe-tsx
description: >-
  Create and edit Cursor canvas files with TSX-safe syntax, visualization-first
  layout, and current SDK usage. Use when the user asks for /canvas output,
  asks to create or modify a .canvas.tsx file, prefers visual presentation, or
  reports canvas build/parse errors.
---

# Canvas TSX Safety + Visual-First Guardrails

Use this skill whenever working on `.canvas.tsx` files to prevent common compile errors, prefer visual communication, and keep output aligned with the current `cursor/canvas` SDK.

## Workflow

1. Read current SDK typings before editing:
   - `~/.cursor/skills-cursor/canvas/sdk/index.d.ts`
   - `~/.cursor/skills-cursor/canvas/sdk/ui-primitives.d.ts`
2. Only import from `cursor/canvas`.
3. Create exactly one new `.canvas.tsx` artifact for the requested deliverable. Do not reuse or overwrite an existing canvas unless the user explicitly asks to modify that specific canvas.
4. Run lint diagnostics on the edited canvas file and fix issues before finishing.

## Visualization-First Rules

- Prefer a visual artifact over long prose blocks.
- Default structure for analytical outputs:
  1. `H1` title + one sentence context
  2. `Stat` strip in `Grid` for top metrics
  3. `Table` for structured facts
  4. Optional charts (`BarChart`, `LineChart`, `PieChart`) when trends/comparisons help
  5. `Callout` for caveats or recommended next step
- For dependency-heavy content, represent relationships as:
  - concise edge tables (`source`, `depends on`, `purpose`), and/or
  - DAG-style visual sections using SDK DAG utilities when helpful.
- Avoid wall-of-text sections; keep explanatory `Text` short and adjacent to visuals.

## TSX Safety Rules (Critical)

- Do not place raw `>` characters inside JSX text nodes.
  - Use `-&gt;` for arrows in prose.
  - Or use `{'>'}` when a literal symbol is required.
- Avoid markdown backticks inside plain JSX text when a component is clearer.
  - Prefer `<Code>pkg/api</Code>` over inline backticks in JSX children.
- Use valid HTML entities for special characters in JSX text (`&gt;`, `&lt;`, `&amp;`).
- Keep string content simple in table cells; if you need rich formatting, use explicit components.

## SDK Compatibility Rules

- Use only exports verified in current SDK declarations.
- Prefer built-in primitives (`Stack`, `Grid`, `Table`, `Stat`, `Callout`, `Code`, `Pill`, charts, DAG helpers) over custom markup.
- Do not assume undocumented components exist.
- If unsure about a prop, verify it in `.d.ts` first.

## Pre-Delivery Checklist

- [ ] File is under the workspace canvases directory and ends with `.canvas.tsx`.
- [ ] Imports come only from `cursor/canvas`.
- [ ] No raw `->` in JSX text; arrows are escaped.
- [ ] Inline code references in prose use `<Code>` where appropriate.
- [ ] Visual-first hierarchy exists (stats/table/chart/graph before long prose).
- [ ] `ReadLints` returns clean diagnostics for the canvas file.

## Quick Fix Patterns

- Arrow parse error:
  - Before: `A -> B -> C`
  - After: `A -&gt; B -&gt; C`
- Inline code in JSX prose:
  - Before: ``Use `pkg/api` handler``
  - After: `Use <Code>pkg/api</Code> handler`
