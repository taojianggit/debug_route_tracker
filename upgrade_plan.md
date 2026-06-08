# Debug Route Tracker Upgrade Plan

This plan keeps the current tree view as a stable fallback and upgrades the tracker in stages. The core rule is: keep one data source, add better views around it.

## Upgrade Goal

Keep the current files:

- `debug_route_events.jsonl`
- `debug_route_data.js`
- `index.html`
- `run_ledger.csv`
- `feature_run_summary.csv`

Add new optional views:

- React Flow main debug route graph
- Markmap summary view
- Cytoscape.js global review graph
- codegraph-based source relationship enrichment

## Phase 1: Stabilize Data Contract

Fix `debug_route_events.jsonl` as the long-term source of truth.

Minimum node shape:

```json
{
  "id": "trial-YYYYMMDD-topic",
  "parent_id": "main-debug-objective",
  "title": "Debug trial title",
  "route": "module-or-topic",
  "status": "current",
  "summary": "Hypothesis, result, and conclusion",
  "links": [],
  "tags": [],
  "metrics": {},
  "code_refs": [],
  "log_refs": [],
  "created_at": "2026-06-08 21:00"
}
```

Recommended statuses:

```text
todo
current
candidate
passed
failed
abandoned
mixed
evidence
baseline
side
```

This phase should only update data tooling. Do not touch algorithm code.

## Phase 2: Keep Current Tree View As Fallback

Keep:

```text
workspace_version_docs/debug_route_tracker/index.html
```

Its purpose:

- Opens directly in a browser.
- Does not require React, Vite, npm, or a server.
- Verifies that data generation still works.
- Provides a stable fallback if the richer view breaks.

This page should remain a lightweight backup view, not the long-term primary UI.

## Phase 3: Add React Flow Main View

Create:

```text
workspace_version_docs/debug_route_tracker/react_flow_view/
```

Initial features:

- Draggable nodes
- Zoom and pan
- MiniMap
- Controls
- Fixed right-side detail panel
- Search
- Status filter
- Route filter
- Show selected path only
- Show one module subtree only
- Node links to source files, logs, reports, HTML, Markdown, and CSV

React Flow should read the same generated data, either:

- `debug_route_data.js`, or
- a new generated `debug_route_graph.json`

Do not maintain a second manual data source.

Recommended node colors:

| Status | Style |
| --- | --- |
| `current` | orange |
| `candidate` | blue |
| `passed` | green |
| `failed` | red |
| `abandoned` | gray |
| `mixed` | dark red |
| `evidence` | green dashed border |
| `baseline` | thick black border |

## Phase 4: Add Layout Modes

The first React Flow version should use a tree layout:

```text
main objective
  route
    sub-route
      trial
        result/evidence
```

Later layout modes:

```text
Tree Layout       parent-child debug route structure
Module Layout     group by algorithm module
Timeline Layout   order by debug time
```

Only implement Tree Layout first.

## Phase 5: Keep Markmap As Summary, Not Main UI

Markmap is optional. Use it only as a generated summary for reports:

```text
debug_route_markmap.md
```

Generation flow:

```text
debug_route_events.jsonl
        ->
generate_markmap_summary.py
        ->
debug_route_markmap.md
```

Use cases:

- Stage review
- Quick hierarchy overview
- Report embedding

Do not use Markmap as the primary debug tracker.

## Phase 6: Add Cytoscape.js Global Review Graph Later

Add this only after the node count becomes large enough to need graph-level review.

Use cases:

- Show all debug routes and code modules together.
- See which files appear repeatedly in failed trials.
- See which config files affect many routes.
- Review the full history around one module.

Potential relation types:

```text
trial -> touches_file
trial -> uses_config
trial -> produced_log
trial -> validates_route
trial -> failed_because
```

## Phase 7: Add codegraph As Pre-Processing

codegraph should not replace the route tracker. It should enrich nodes with source structure.

Example flow:

```text
selected debug node
        ->
code_refs
        ->
codegraph callers/callees/impact
        ->
related functions, files, and impact radius
```

For example, a node touching `src/module/file.cpp` can show:

- Changed functions
- Called functions
- Affected module paths
- Source file links

## Phase 8: Normalize Debug Workflow

Each new debugging attempt should follow this flow:

1. Choose one parent route node.
2. Add a trial node with `add_debug_event.py`.
3. Compile and replay.
4. Add log paths, config path, and result metrics to the same node.
5. If the conclusion changes, append a patch event with the same `id`.
6. Regenerate data.
7. Refresh the tracker view.

## Suggested Implementation Order

1. Extend the JSONL data fields.
2. Extend `add_debug_event.py` to accept `metrics`, `code_refs`, and `log_refs`.
3. Add a read-only React Flow view.
4. Add automatic tree layout and filters.
5. Add generated Markmap summary.
6. Add Cytoscape.js global review only if the graph becomes too large.
7. Add codegraph enrichment after the React Flow view is stable.

Short-term priority: get React Flow read-only view working while keeping the current tree view and Markmap summary as auxiliary tools.
