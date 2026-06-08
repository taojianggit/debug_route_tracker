# Debug Route Tracker V1.0

A local-first map of what you tried, why, and what failed.

Stop losing context across long debugging sessions.

## Project Overview

Debug Route Tracker is a route map for AI-assisted coding and complex debugging. It records each attempt, branch, failure, evidence item, and conclusion so long Codex, Claude Code, Cursor, or other agent sessions do not lose the debugging path.

V1.0 keeps `debug_route_events.jsonl` as the only manual debug-route data source. Browser data, graph JSON, and Markmap Markdown are generated artifacts.

The main view is `react_flow_view/index.html`. It is a local graph-style view implemented with plain browser JavaScript; it does not bundle or import the React Flow package.

## Installation

Clone or copy this repository:

```bash
git clone https://github.com/taojianggit/debug_route_tracker.git
cd debug_route_tracker
```

No package installation is required. Keep the repository as a reusable tool directory, then initialize one tracker directory per workspace.

## Dependencies

- Python 3.8+ for data generation and CLI scripts.
- A modern browser for `index.html` and `react_flow_view/index.html`.
- No npm packages, pip packages, build step, dev server, or network access are required.

## Quick Use Steps

1. Initialize one independent tracker for a workspace:

```bash
git clone https://github.com/taojianggit/debug_route_tracker.git
cd debug_route_tracker
./debug-route init /path/to/YOUR_WORKSPACE
```

2. Open the main graph page:

```text
/path/to/YOUR_WORKSPACE/workspace_version_docs/debug_route_tracker/react_flow_view/index.html
```

3. Add new debug nodes from that tracker directory:

```bash
cd /path/to/YOUR_WORKSPACE/workspace_version_docs/debug_route_tracker
./debug-route add --id trial-YYYYMMDD-name --parent main-debug-objective --title "New trial" --status current --route route-name --summary "Purpose, result, conclusion"
```

Each workspace has its own tracker page and data directory, so different workspaces do not overlap.

## AI Agent Integration

The selling point is not the static page. The point is that AI debugging keeps its route memory.

This repository includes instruction examples that can be copied into a workspace root:

- `AGENTS.md`: generic AI agent instructions.
- `CLAUDE.md`: Claude Code instructions.
- `CODEX.md`: Codex instructions.

Agents should not log every shell command. They should write meaningful route nodes: baseline, branch attempt, failed trial, evidence, candidate fix, final fix, and next resume point.

## Static Walkthrough

This walkthrough starts with the full route, then breaks down the same route: baseline first, failed branches kept visible, candidate fix marked after several rounds, and a final validation node left as the resume point.

![Debug Route Tracker static walkthrough](assets/debug_route_walkthrough.png)

## Open Views

- `react.html`: standalone 12-node complex bug case showing baseline, failed trials, evidence, candidate fix, final fix, and validation. It does not read or modify your real `debug_route_events.jsonl`.
- `react_flow_view/index.html`: V1.0 graph view with drag, zoom, MiniMap, filters, selected path, subtree focus, and detail panel.
- `index.html`: lightweight fallback tree view that opens directly in a browser.
- `debug_route_markmap.md`: generated Markmap-compatible hierarchy summary.

## Regenerate Data

```bash
./debug-route regen
```

## Add Or Patch A Node

```bash
./debug-route add \
  --id trial-YYYYMMDD-name \
  --parent main-debug-objective \
  --title "New trial title" \
  --status current \
  --route module-or-topic \
  --summary "Hypothesis, result, conclusion" \
  --metric replay_s=120 \
  --code-ref source=../../src/path/to/file.cpp \
  --log-ref run=../../logs/run-output
```

Append a patch event without rewriting old JSONL lines:

```bash
./debug-route patch \
  --id trial-YYYYMMDD-name \
  --status failed \
  --summary "Updated conclusion"
```

## Use In Another Workspace

Copy this directory or run:

```bash
python3 init_debug_route_tracker.py --target /path/to/workspace/debug_route_tracker
```

Then keep that workspace's route events in its own `debug_route_events.jsonl`. The short command also accepts explicit tracker paths:

```bash
./debug-route regen --tracker /path/to/workspace/debug_route_tracker
```

If `debug-route` is copied outside the repository, set `DEBUG_ROUTE_TRACKER_HOME=/path/to/debug_route_tracker`.

## Relationship With Git / GitHub

Git and GitHub mainly record code history: what changed, which branch it is on, which commit fixed the state, and how to revert or merge it.

Debug Route Tracker mainly records debugging decision history: why a trial was made, which route it belongs to, which config and logs were used, how the metrics changed, and whether the node is a candidate, failure, baseline, or evidence.

Core difference:

```text
Git records code history.
Debug Route Tracker records debugging decision history.
```

They should work together rather than replace each other. Use Git branches and commits to pin code states, and use tracker nodes to record debug routes, conclusions, logs, and metrics. Add GitHub commit, branch, issue, or PR URLs to node `links`.

## TODO

- Add optional module and timeline layout modes after the tree layout starts to feel limiting.
- Add a Cytoscape.js global review graph only when the node count is large enough to need file/module-level history review.
- Add optional codegraph enrichment for `code_refs`, such as callers, callees, impact radius, and related source files.
- Add Git/GitHub link fields or CLI shortcuts such as `--commit`, `--branch`, `--issue`, and `--pr`.
- Add Git state snapshots, including current branch, HEAD commit, dirty state, and changed files.
- Support creating or completing tracker nodes from GitHub issue, PR, or commit URLs.
- Consider a real React Flow implementation only if npm-based development becomes acceptable for the project.
- Add richer impact highlighting, such as repeatedly failed source files, configs used by many runs, and changed modules.

## Third-Party And Copyright Risk

This repository currently uses only Python standard-library modules and browser-native HTML/CSS/JavaScript. It does not bundle third-party JavaScript, React Flow, Markmap, Cytoscape.js, or npm/pip dependencies.

`debug_route_markmap.md` is only Markdown output compatible with external Markmap viewers. If you later bundle Markmap, React Flow, Cytoscape.js, or other open-source packages, add their license notices and verify their licenses before publishing.

This project is released under the MIT License. See `LICENSE`.
