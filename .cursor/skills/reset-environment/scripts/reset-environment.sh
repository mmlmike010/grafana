#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s [--yes]\n' "$0"
  printf '\n'
  printf 'Resets the current git repo to origin/main, removes extra worktrees, and removes untracked files.\n'
  printf 'This drops local commits, tracked edits, untracked files, and linked worktree checkouts.\n'
}

remove_extra_worktrees() {
  local repo_root="$1"
  local wt_path="" wt_branch=""

  flush_worktree() {
    if [[ -z "$wt_path" || "$wt_path" == "$repo_root" ]]; then
      wt_path=""
      wt_branch=""
      return
    fi

    if [[ -n "$wt_branch" ]]; then
      printf 'Removing worktree: %s [%s]\n' "$wt_path" "$wt_branch"
    else
      printf 'Removing worktree: %s\n' "$wt_path"
    fi

    git worktree remove --force "$wt_path"

    if [[ -n "$wt_branch" && "$wt_branch" != "main" && "$wt_branch" != "master" ]]; then
      git branch -D "$wt_branch" 2>/dev/null || true
    fi

    wt_path=""
    wt_branch=""
  }

  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      worktree\ *)
        flush_worktree
        wt_path="${line#worktree }"
        ;;
      branch\ refs/heads/*)
        wt_branch="${line#branch refs/heads/}"
        ;;
    esac
  done < <(git worktree list --porcelain)

  flush_worktree
  git worktree prune
}

yes=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      yes=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

printf 'Repo: %s\n' "$repo_root"
printf 'Current branch: %s\n' "$(git branch --show-current)"
printf '\n'
printf 'This will run:\n'
printf '  remove extra git worktrees (keep current repo checkout)\n'
printf '  git fetch origin main\n'
printf '  git checkout main\n'
printf '  git reset --hard origin/main\n'
printf '  git clean -fd\n'
printf '\n'

if [[ "$yes" != true ]]; then
  printf 'Type RESET to discard local changes and untracked files: '
  read -r confirmation
  if [[ "$confirmation" != "RESET" ]]; then
    printf 'Aborted. No changes were made.\n'
    exit 1
  fi
fi

remove_extra_worktrees "$repo_root"

git fetch origin main
git checkout main
git reset --hard origin/main
git clean -fd

commit="$(git rev-parse --short HEAD)"
printf '\n'
printf 'Reset complete. HEAD is %s.\n' "$commit"

status="$(git status --short)"
if [[ -z "$status" ]]; then
  printf 'Working tree is clean.\n'
else
  printf 'Working tree still has changes:\n%s\n' "$status"
fi
