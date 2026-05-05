---
name: tech-debt-linear
description: Identifies, documents, and files technical debt found in the Grafana repository. Use when auditing tech debt, writing tech debt reports, or creating Linear tickets labeled tech-debt for repo cleanup, refactor, or maintenance work.
---

# Tech Debt Linear

## Purpose

Find real technical debt in this repository, document it with concrete evidence, post the report, and create a Linear issue labeled `tech-debt`.

Fail loudly if Linear is unavailable, the Linear team cannot be determined, the `tech-debt` label cannot be found or created, or the evidence is too weak to justify a ticket.

## Workflow

1. Define the scope.
   - If the user names files, packages, or features, focus there.
   - If the user does not name a scope, audit the current branch diff first; if there is no diff, ask what area to inspect.
   - Read any applicable `AGENTS.md` before auditing files under that directory.

2. Investigate before writing.
   - Use `rg`, `Glob`, `SemanticSearch`, and `ReadFile` to gather evidence.
   - Look for repeated logic, unstable ownership boundaries, stale TODO/FIXME comments with nearby proof, brittle tests, ignored errors, risky coupling, missing tests around fragile behavior, deprecated patterns, or cleanup explicitly called out by maintainers.
   - Do not file tickets for style nits, speculative rewrites, isolated TODOs without impact, or broad "make this better" ideas.

3. Write the report in Markdown.
   - Keep it concise and evidence-backed.
   - Prefer one focused debt item per ticket. If the audit finds unrelated debt, propose separate tickets instead of bundling them.
   - Include paths, symbols, impact, proposed direction, and validation.

Use this report template:

```markdown
## Summary
[One or two sentences describing the debt and why it matters.]

## Evidence
- `[path]`: [specific observation tied to code behavior or maintenance cost]
- `[path]`: [specific observation tied to code behavior or maintenance cost]

## Impact
[What gets harder, riskier, slower, or more error-prone if this stays as-is.]

## Proposed Direction
[Concrete cleanup/refactor direction. Avoid prescribing a giant rewrite.]

## Validation
- [ ] [Focused test, lint, build, or manual check that would prove the cleanup]
```

4. Create or reuse the Linear label.
   - Before calling any Linear MCP tool, read that tool's descriptor/schema.
   - Use the `plugin-linear-linear` MCP server.
   - Call `list_issue_labels` with `name: "tech-debt"`.
   - If no label exists, call `create_issue_label` with `name: "tech-debt"` and a short description such as `Technical debt cleanup or refactor work`.

5. Create the Linear issue.
   - Determine the Linear team from the user's request when possible.
   - If the team is not obvious, call `list_teams`. If there is still more than one plausible team, ask the user to choose instead of guessing.
   - Call `save_issue` with:
     - `title`: `Tech debt: [short specific title]`
     - `description`: the full report Markdown
     - `team`: the chosen team name or ID
     - `labels`: `["tech-debt"]`
     - `priority`: `4` unless the evidence shows user-visible risk or active development blockage

6. Post the report.
   - The Linear issue description is the report by default.
   - If the report is long or the user asks for a separate document, call `save_document` after issue creation and attach it to the issue.
   - Return the issue identifier/URL and a short summary of what was filed.

## Quality Bar

- Every finding must cite concrete repository evidence.
- The ticket must describe a bounded cleanup path.
- The validation section must name at least one realistic check.
- If no meaningful debt is found, say so and do not create a Linear issue.