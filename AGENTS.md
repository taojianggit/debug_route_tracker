# Debug Route Tracker Agent Instructions

Use Debug Route Tracker as the shared memory for long debugging work.

The goal is not to log every shell command. The goal is to preserve the route: what was tried, why it was tried, what evidence was collected, which branch failed, and where the next session should resume.

## Tracker Location

For a workspace initialized with this tool, the tracker normally lives at:

```text
workspace_version_docs/debug_route_tracker
```

If the tracker is elsewhere, use the path provided by the user or `DEBUG_ROUTE_TRACKER_HOME`.

## When To Write A Node

Append or patch a tracker node when you:

- establish or update the main debugging objective
- create a new investigation route
- try a meaningful code/config/data change
- finish a test run, replay, benchmark, or log inspection that provides evidence
- abandon a branch because it failed or became irrelevant
- identify a candidate or final fix

Do not delete failed attempts. Failed branches are useful context.

## Node Rules

- Every non-root node should have a `--parent` that explains which route it belongs to.
- Use `baseline` for the reproducible starting point.
- Use `current` for the active route.
- Use `candidate` for a promising but unconfirmed fix.
- Use `failed` for attempts that should not be repeated.
- Use `evidence` for logs, metrics, traces, screenshots, or analysis that support a conclusion.
- Use `passed` for confirmed fixes or completed validation.
- Put the hypothesis, result, and conclusion in `--summary`.
- Add `--code-ref`, `--log-ref`, `--metric`, and `--link` whenever they make the node reproducible.

## Command Pattern

From the workspace root:

```bash
TRACKER=workspace_version_docs/debug_route_tracker
$TRACKER/debug-route add --tracker "$TRACKER" \
  --id trial-YYYYMMDD-short-name \
  --parent main-debug-objective \
  --title "Trial: short human-readable title" \
  --status current \
  --route route-name \
  --summary "Hypothesis, result, and conclusion" \
  --metric fail_rate=0.37 \
  --code-ref source=src/path/to/file.ext \
  --log-ref run=logs/run-output.log
```

Patch an existing node instead of rewriting history:

```bash
TRACKER=workspace_version_docs/debug_route_tracker
$TRACKER/debug-route patch --tracker "$TRACKER" \
  --id trial-YYYYMMDD-short-name \
  --status failed \
  --summary "Updated conclusion after the validation run"
```

Before finishing a debugging session, make sure the tracker says where the next agent should resume.
