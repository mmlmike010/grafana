#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s [--yes]\n' "$0"
  printf '\n'
  printf 'Resets the current git repo to origin/main and removes untracked files.\n'
  printf 'This drops local commits, tracked edits, and untracked files.\n'
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
