#!/usr/bin/env bash
# Fails if a diff adds desktop/Electron surface to the Go server under pkg/.
#
# Usage: desktop/scripts/check-no-pkg-desktop.sh [--any-pkg-change] [BASE_REF] [HEAD_REF]
#   BASE_REF          defaults to origin/main; the diff is BASE_REF...HEAD_REF (merge-base, like a PR diff)
#   HEAD_REF          defaults to HEAD
#   --any-pkg-change  fail on ANY change under pkg/ (use for desktop-labelled PRs)
#
# Default mode fails when a changed path under pkg/ has a desktop/electron-looking name, or when an added line
# under pkg/ mentions electron or a /desktop path segment (e.g. a route like "/api/desktop/...").
# Exit codes: 0 clean, 1 violation, 2 usage or git error.
set -euo pipefail

any_pkg_change=false
args=()
for arg in "$@"; do
  case "$arg" in
    --any-pkg-change) any_pkg_change=true ;;
    -h | --help)
      sed -n '2,11p' "$0"
      exit 0
      ;;
    -*)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
    *) args+=("$arg") ;;
  esac
done

base_ref="${args[0]:-origin/main}"
head_ref="${args[1]:-HEAD}"

if ! repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "not inside a git repository" >&2
  exit 2
fi
cd "$repo_root"

for ref in "$base_ref" "$head_ref"; do
  if ! git rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
    echo "unknown git ref: $ref (fetch it first, e.g. git fetch origin main)" >&2
    exit 2
  fi
done

range="$base_ref...$head_ref"
changed_files="$(git diff --name-only --diff-filter=ACMR "$range" -- pkg/)"

if [[ -z "$changed_files" ]]; then
  echo "check-no-pkg-desktop: no changes under pkg/ in $range"
  exit 0
fi

if [[ "$any_pkg_change" == true ]]; then
  echo "check-no-pkg-desktop: desktop PRs must not change pkg/, but $range touches:" >&2
  sed 's/^/  /' <<<"$changed_files" >&2
  exit 1
fi

status=0

bad_paths="$(grep -iE '(^|[/_.-])(desktop|electron)' <<<"$changed_files" || true)"
if [[ -n "$bad_paths" ]]; then
  echo "check-no-pkg-desktop: desktop/electron-named files under pkg/:" >&2
  sed 's/^/  /' <<<"$bad_paths" >&2
  status=1
fi

added_lines="$(git diff --unified=0 --no-color "$range" -- pkg/ |
  awk '/^\+\+\+ /{file=substr($0, 7); next} /^\+/{print file ": " substr($0, 2)}')"
bad_lines="$(grep -iE 'electron|/desktop([^[:alnum:]_-]|$)' <<<"$added_lines" || true)"
if [[ -n "$bad_lines" ]]; then
  echo "check-no-pkg-desktop: added lines under pkg/ reference electron or a /desktop route:" >&2
  sed 's/^/  /' <<<"$bad_lines" >&2
  status=1
fi

if [[ "$status" -eq 0 ]]; then
  echo "check-no-pkg-desktop: pkg/ changes in $range have no desktop surface"
fi
exit "$status"
