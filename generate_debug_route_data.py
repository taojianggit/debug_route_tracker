#!/usr/bin/env python3
"""Build browser-loadable debug route data from JSONL events."""

from __future__ import annotations

import argparse
import json
from collections import OrderedDict
from datetime import datetime
from pathlib import Path

SCHEMA_VERSION = "2.0"

STATUS_STYLES = {
    "todo": {"label": "todo", "color": "#64748b"},
    "active": {"label": "active", "color": "#0f766e"},
    "current": {"label": "current", "color": "#b45309"},
    "candidate": {"label": "candidate", "color": "#2563eb"},
    "passed": {"label": "passed", "color": "#15803d"},
    "failed": {"label": "failed", "color": "#b91c1c"},
    "abandoned": {"label": "abandoned", "color": "#6b7280"},
    "mixed": {"label": "mixed", "color": "#9f1239"},
    "evidence": {"label": "evidence", "color": "#166534", "border": "dashed"},
    "baseline": {"label": "baseline", "color": "#111827", "border": "thick"},
    "side": {"label": "side", "color": "#475569"},
}


def read_events(events_path: Path) -> list[dict]:
    events: list[dict] = []
    with events_path.open(encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, 1):
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"{events_path}:{line_no}: invalid JSON: {exc}") from exc
            if "id" not in event:
                raise SystemExit(f"{events_path}:{line_no}: missing id")
            events.append(event)
    return events


def apply_events(events: list[dict]) -> list[dict]:
    nodes: OrderedDict[str, dict] = OrderedDict()
    for event in events:
        event = dict(event)
        node_id = event.pop("id")
        op = event.pop("op", "upsert")
        if op == "delete":
            nodes.pop(node_id, None)
            continue
        if op not in {"upsert", "patch"}:
            raise SystemExit(f"{node_id}: unsupported op {op!r}")

        previous = nodes.get(node_id, {})
        merged = dict(previous)
        merged.update(event)
        merged["id"] = node_id
        nodes[node_id] = merged

    known_ids = set(nodes)
    for node in nodes.values():
        parent_id = node.get("parent_id")
        if parent_id and parent_id not in known_ids:
            node["parent_missing"] = True
    return normalize_nodes(list(nodes.values()))


def normalize_nodes(nodes: list[dict]) -> list[dict]:
    normalized = []
    for index, node in enumerate(nodes):
        node = dict(node)
        node_id = str(node.get("id", "")).strip()
        if not node_id:
            raise SystemExit(f"node at index {index} has an empty id")

        parent_id = node.get("parent_id")
        if parent_id == "":
            parent_id = None

        node["id"] = node_id
        node["parent_id"] = parent_id
        node["title"] = str(node.get("title") or node_id)
        node["route"] = str(node.get("route") or "unclassified")
        node["status"] = str(node.get("status") or "todo")
        node["summary"] = str(node.get("summary") or "")
        node["links"] = normalize_refs(node.get("links", []))
        node["tags"] = [str(tag) for tag in node.get("tags", []) if str(tag)]
        node["metrics"] = normalize_mapping(node.get("metrics", {}))
        node["code_refs"] = normalize_refs(node.get("code_refs", []))
        node["log_refs"] = normalize_refs(node.get("log_refs", []))
        node["created_at"] = str(node.get("created_at") or "")
        node["_order"] = index
        normalized.append(node)

    add_tree_metadata(normalized)
    return normalized


def normalize_mapping(value: object) -> dict:
    if not isinstance(value, dict):
        return {}
    return {str(key): item for key, item in value.items()}


def normalize_refs(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    refs = []
    for item in value:
        if isinstance(item, str):
            label = Path(item).name or item
            refs.append({"label": label, "href": item})
            continue
        if not isinstance(item, dict):
            continue
        href = str(item.get("href") or item.get("path") or item.get("url") or "")
        if not href:
            continue
        label = str(item.get("label") or Path(href).name or href)
        refs.append({"label": label, "href": href})
    return refs


def add_tree_metadata(nodes: list[dict]) -> None:
    by_id = {node["id"]: node for node in nodes}
    child_counts = {node["id"]: 0 for node in nodes}
    for node in nodes:
        parent_id = node.get("parent_id")
        if parent_id in child_counts:
            child_counts[parent_id] += 1

    for node in nodes:
        node["child_count"] = child_counts[node["id"]]
        depth = 0
        seen = {node["id"]}
        parent_id = node.get("parent_id")
        while parent_id and parent_id in by_id and parent_id not in seen:
            depth += 1
            seen.add(parent_id)
            parent_id = by_id[parent_id].get("parent_id")
        node["depth"] = depth


def build_edges(nodes: list[dict]) -> list[dict]:
    by_id = {node["id"] for node in nodes}
    edges = []
    for node in nodes:
        parent_id = node.get("parent_id")
        if not parent_id or parent_id not in by_id:
            continue
        edges.append(
            {
                "id": f"{parent_id}->{node['id']}",
                "source": parent_id,
                "target": node["id"],
                "type": "parent",
            }
        )
    return edges


def summarize_counts(nodes: list[dict], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for node in nodes:
        value = str(node.get(key) or "unclassified")
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


def build_data(events_path: Path, output_path: Path | None, graph_output_path: Path | None = None) -> dict:
    events = read_events(events_path)
    nodes = apply_events(events)
    edges = build_edges(nodes)
    data = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "event_count": len(events),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "status_styles": STATUS_STYLES,
        "routes": sorted({node.get("route", "unclassified") for node in nodes}),
        "status_counts": summarize_counts(nodes, "status"),
        "route_counts": summarize_counts(nodes, "route"),
        "nodes": nodes,
        "edges": edges,
    }
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            "window.DEBUG_ROUTE_DATA = "
            + json.dumps(data, ensure_ascii=False, indent=2)
            + ";\n",
            encoding="utf-8",
        )
    if graph_output_path:
        graph_output_path.parent.mkdir(parents=True, exist_ok=True)
        graph_output_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return data


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", type=Path, default=script_dir / "debug_route_events.jsonl")
    parser.add_argument("--output", type=Path, default=script_dir / "debug_route_data.js")
    parser.add_argument("--graph-output", type=Path, default=script_dir / "debug_route_graph.json")
    args = parser.parse_args()

    data = build_data(args.events, args.output, args.graph_output)
    print(
        f"wrote {data['node_count']} nodes and {data['edge_count']} edges "
        f"from {data['event_count']} events to {args.output}"
    )
    if args.graph_output:
        print(f"wrote graph json to {args.graph_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
