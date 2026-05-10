---
name: reset-environment
description: Reset the Grafana repo working tree to match origin/main and remove untracked files. Use when the user asks to reset the environment, clean the repo, discard all local changes, or return to origin/main.
---

# Reset Environment

Use this skill to reset the current Grafana checkout to `origin/main` and remove untracked files.

This is destructive. It drops local commits, tracked edits, and untracked files that are not backed up elsewhere.

## Workflow

1. Confirm the user wants to discard local work unless their latest message already clearly authorizes a destructive reset.
2. Run the reset script from the repo root:

```sh
.cursor/skills/reset-environment/scripts/reset-environment.sh
```

If the user's latest message already clearly authorizes the destructive reset, pass `--yes`:

```sh
.cursor/skills/reset-environment/scripts/reset-environment.sh --yes
```

3. Summarize the result with:
- The commands that ran
- The final commit short SHA
- Whether `git status --short` is clean
- Any errors or files that could not be removed

## Do Not

- Do not run tests, builds, dev servers, or code generation as part of this reset.
- Do not preserve local work unless the user asks for a backup first.
- Do not use `git clean -fdx`; this skill removes ordinary untracked files only, not ignored dependency caches.
