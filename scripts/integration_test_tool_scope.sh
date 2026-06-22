#!/usr/bin/env bash
set -euo pipefail

# Tool-scope integration matrix for stdio MCP discovery.
# Usage: set -a && source .env.local && set +a && pnpm integration:tool-scope

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

if [[ -z "${HULY_URL:-}" ]]; then
  echo "ERROR: HULY_URL must be set; source .env.local first" >&2
  exit 1
fi

TOOL_TIMEOUT="${TOOL_TIMEOUT:-30}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

json_string() {
  jq -Rn --arg value "$1" '$value'
}

run_case() {
  local case_name="$1"
  local client_name="$2"
  local toolsets="$3"
  local tools="$4"
  local input_file="$TMP_DIR/$case_name.input.jsonl"
  local raw_file="$TMP_DIR/$case_name.raw"
  local output_file="$TMP_DIR/$case_name.jsonl"
  local client_json
  client_json="$(json_string "$client_name")"

  cat >"$input_file" <<EOF
{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":$client_json,"version":"1.0"}},"id":1}
{"jsonrpc":"2.0","method":"tools/list","id":2}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_huly_context","arguments":{}},"id":3}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{}},"id":4}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_teamspaces","arguments":{}},"id":5}
EOF

  env \
    TOOLSETS="$toolsets" \
    TOOLS="$tools" \
    MCP_AUTO_EXIT=true \
    timeout "$TOOL_TIMEOUT" node dist/index.cjs <"$input_file" >"$raw_file"

  grep '^{' "$raw_file" >"$output_file"
  printf '%s\n' "$output_file"
}

response_by_id() {
  local output_file="$1"
  local id="$2"
  jq -c "select(.id == $id)" "$output_file" | tail -n 1
}

assert_tool_present() {
  local output_file="$1"
  local tool_name="$2"
  response_by_id "$output_file" 2 | jq -e --arg tool "$tool_name" '.result.tools | any(.name == $tool)' >/dev/null
}

assert_tool_absent() {
  local output_file="$1"
  local tool_name="$2"
  response_by_id "$output_file" 2 | jq -e --arg tool "$tool_name" '.result.tools | all(.name != $tool)' >/dev/null
}

assert_tool_names_exact() {
  local output_file="$1"
  shift
  local expected_json
  expected_json="$(printf '%s\n' "$@" | jq -R . | jq -s .)"
  response_by_id "$output_file" 2 \
    | jq -e --argjson expected "$expected_json" '[.result.tools[].name] == $expected' >/dev/null
}

assert_context() {
  local output_file="$1"
  local jq_expression="$2"
  response_by_id "$output_file" 3 \
    | jq -e ".result.structuredContent.result | $jq_expression" >/dev/null
}

assert_call_success() {
  local output_file="$1"
  local id="$2"
  response_by_id "$output_file" "$id" | jq -e '.result.isError != true' >/dev/null
}

assert_call_error() {
  local output_file="$1"
  local id="$2"
  response_by_id "$output_file" "$id" | jq -e '.result.isError == true' >/dev/null
}

echo "Running tool-scope integration matrix..."

default_output="$(run_case "default" "claude-code" "" "")"
assert_tool_present "$default_output" "list_projects"
assert_tool_present "$default_output" "list_teamspaces"
assert_context "$default_output" '.toolScope.active == false'
assert_call_success "$default_output" 4
assert_call_success "$default_output" 5

projects_output="$(run_case "toolsets-projects" "claude-ai (via mcp-remote)" "projects" "")"
assert_tool_present "$projects_output" "list_projects"
assert_tool_absent "$projects_output" "list_teamspaces"
assert_context "$projects_output" '.toolScope.active == true'
assert_context "$projects_output" '.toolScope.enabledToolsets == ["projects"]'
assert_call_success "$projects_output" 4
assert_call_error "$projects_output" 5

documents_output="$(run_case "tools-documents" "cursor-vscode" "" "list_teamspaces")"
assert_tool_present "$documents_output" "list_teamspaces"
assert_tool_absent "$documents_output" "list_projects"
assert_context "$documents_output" '.toolScope.enabledTools == ["list_teamspaces"]'
assert_call_error "$documents_output" 4
assert_call_success "$documents_output" 5

union_output="$(run_case "union" "codex-cli" "issues" "list_teamspaces")"
assert_tool_present "$union_output" "list_issues"
assert_tool_present "$union_output" "list_teamspaces"
assert_tool_absent "$union_output" "list_projects"
assert_context "$union_output" '.toolScope.enabledToolsets == ["issues"]'
assert_context "$union_output" '.toolScope.enabledTools == ["list_teamspaces"]'
assert_call_error "$union_output" 4
assert_call_success "$union_output" 5

invalid_output="$(run_case "invalid" "opencode" "missing_category" "missing_tool")"
assert_tool_names_exact "$invalid_output" "get_version" "get_huly_context"
assert_context "$invalid_output" '.toolScope.active == true'
assert_context "$invalid_output" '.toolScope.ignoredToolsets == ["missing_category"]'
assert_context "$invalid_output" '.toolScope.ignoredTools == ["missing_tool"]'
assert_call_error "$invalid_output" 4
assert_call_error "$invalid_output" 5

echo "Tool-scope integration matrix passed."
