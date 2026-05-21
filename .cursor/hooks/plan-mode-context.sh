#!/bin/bash
# Injects Plan mode research instructions when a composer session starts in Plan mode.
input=$(cat)
mode=$(echo "$input" | jq -r '.composer_mode // empty')

if [ "$mode" = "plan" ]; then
  echo '{
    "additional_context": "Plan mode active. Before CreatePlan, fan out parallel codebase-reader subagents (Task: subagent_type=codebase-reader, model=composer-2.5-fast, readonly=true) to research the codebase. Ground the plan in their findings."
  }'
else
  echo '{}'
fi
exit 0
