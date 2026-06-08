# Claude Code Instructions

When using Claude Code on a workspace with Debug Route Tracker, treat the tracker as the durable debugging route map.

Claude should keep the route visible across long sessions:

- read the current tracker before major debugging work
- add a node for each meaningful branch, failed trial, evidence item, candidate fix, and final validation
- preserve failed attempts instead of overwriting them
- connect each node to a parent route with `--parent`
- include code references, log references, metrics, and links when available

The default tracker path is:

```text
workspace_version_docs/debug_route_tracker
```

Use this command shape from the workspace root:

```bash
TRACKER=workspace_version_docs/debug_route_tracker
$TRACKER/debug-route add --tracker "$TRACKER" \
  --id trial-YYYYMMDD-short-name \
  --parent main-debug-objective \
  --title "Trial: describe the branch" \
  --status current \
  --route route-name \
  --summary "Hypothesis, result, conclusion" \
  --code-ref source=src/path/to/file.ext \
  --log-ref run=logs/run-output.log
```

Use `patch` when a run changes the conclusion:

```bash
TRACKER=workspace_version_docs/debug_route_tracker
$TRACKER/debug-route patch --tracker "$TRACKER" \
  --id trial-YYYYMMDD-short-name \
  --status failed \
  --summary "Why this branch failed and should not be repeated"
```

Before the final response, if the session made debugging progress, ensure the tracker records the current route and next resume point.
