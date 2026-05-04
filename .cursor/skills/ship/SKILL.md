---
name: ship
description: >-
  Pushes local work to GitHub and opens a pull request against mmlmike010/grafana:
  ensure a feature branch, commit if needed, push, and run gh pr create. Use when
  the user says ship, push and PR, open a PR, publish changes, or wants to land
  work on their fork.
---

# Ship

Pushes changes and opens a pull request against `mmlmike010/grafana`.

Follow the `github-fieldsphere-fork` skill for all `gh` operations and repo targeting.

## Workflow

### Step 1 — Check current branch

```bash
git branch --show-current
```

### Step 2 — If on `main`, create a feature branch first

Ask the user for a branch name, or auto-generate one from the staged diff summary (e.g. `feat/add-dark-mode-toggle`). Then:

```bash
git checkout -b <branch-name>
```

If not on `main`, skip to Step 3.

### Step 3 — Stage and commit any uncommitted changes

Check `git status`. If there are unstaged/uncommitted changes, ask the user for a commit message (or generate one from the diff), then:

```bash
git add -A
git commit -m "<message>"
```

If the working tree is clean and commits already exist, skip.

### Step 4 — Push branch

```bash
git push -u origin <branch-name>
```

### Step 5 — Open a PR against `mmlmike010/grafana`

Summarize the commits on the branch relative to `main` (`git log main..HEAD --oneline`), then run:

```bash
gh pr create --repo mmlmike010/grafana \
  --base main \
  --title "<concise title>" \
  --body "$(cat <<'EOF'
## Summary
<bullet points from commits>

## Test plan
- [ ] Manually tested locally
- [ ] Existing tests pass

EOF
)"
```

Always output `Target repo: mmlmike010/grafana` and the PR URL when done.

## Notes

- Never push directly to `main`.
- If the branch has already been pushed, `git push` without `-u` is fine.
