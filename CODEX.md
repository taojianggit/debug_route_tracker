# Codex Instructions

Use Debug Route Tracker so AI debugging does not lose context.

At the start of a debugging task, inspect the tracker when it exists:

```text
workspace_version_docs/debug_route_tracker/debug_route_events.jsonl
```

During the task, write tracker nodes for meaningful debugging decisions:

- baseline reproduction
- new route or branch
- failed trial
- evidence from logs, metrics, traces, screenshots, or tests
- candidate fix
- final fix and validation

Do not record every terminal command. Record decisions and evidence.

From the workspace root, use:

```bash
TRACKER=workspace_version_docs/debug_route_tracker
$TRACKER/debug-route add --tracker "$TRACKER" \
  --id trial-YYYYMMDD-short-name \
  --parent main-debug-objective \
  --title "Trial: concise branch title" \
  --status current \
  --route route-name \
  --summary "Hypothesis, result, conclusion" \
  --metric key=value \
  --code-ref source=src/path/to/file.ext \
  --log-ref run=logs/run-output.log
```

When new evidence changes a node, append a patch event:

```bash
TRACKER=workspace_version_docs/debug_route_tracker
$TRACKER/debug-route patch --tracker "$TRACKER" \
  --id trial-YYYYMMDD-short-name \
  --status candidate \
  --summary "Updated result and next validation step"
```

At the end of the session, leave a node that makes the next Codex run obvious: resume route, known failures, best evidence, and next action.
