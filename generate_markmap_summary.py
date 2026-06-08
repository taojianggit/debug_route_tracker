#!/usr/bin/env python3
"""Generate a Markmap-compatible Markdown summary from debug route events."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from generate_debug_route_data import apply_events, read_events  # noqa: E402


def build_children(nodes: list[dict]) -> dict[str, list[dict]]:
    by_id = {node["id"]: node for node in nodes}
    children: dict[str, list[dict]] = {"__root__": []}
    for node in nodes:
        parent_id = node.get("parent_id")
        key = parent_id if parent_id in by_id else "__root__"
        children.setdefault(key, []).append(node)
    for items in children.values():
        items.sort(key=lambda node: node.get("_order", 0))
    return children


def as_text(value: object) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def clean(value: object) -> str:
    return as_text(value).replace("\n", " ").strip()


def link_line(ref: dict) -> str:
    label = clean(ref.get("label") or ref.get("href") or "link")
    href = clean(ref.get("href") or "")
    return f"[{label}]({href})" if href else label


def render_node(node: dict, children: dict[str, list[dict]], depth: int, lines: list[str]) -> None:
    indent = "  " * depth
    title = clean(node.get("title") or node["id"])
    lines.append(f"{indent}- {title}")
    meta = f"`{clean(node.get('status') or 'todo')}` / `{clean(node.get('route') or 'unclassified')}`"
    if node.get("created_at"):
        meta += f" / {clean(node['created_at'])}"
    lines.append(f"{indent}  - {meta}")
    if node.get("summary"):
        lines.append(f"{indent}  - {clean(node['summary'])}")
    if node.get("metrics"):
        lines.append(f"{indent}  - metrics")
        for key, value in sorted(node["metrics"].items()):
            lines.append(f"{indent}    - `{clean(key)}`: {clean(value)}")
    if node.get("links"):
        lines.append(f"{indent}  - links")
        for ref in node["links"]:
            lines.append(f"{indent}    - {link_line(ref)}")
    if node.get("code_refs"):
        lines.append(f"{indent}  - code_refs")
        for ref in node["code_refs"]:
            lines.append(f"{indent}    - {link_line(ref)}")
    if node.get("log_refs"):
        lines.append(f"{indent}  - log_refs")
        for ref in node["log_refs"]:
            lines.append(f"{indent}    - {link_line(ref)}")
    for child in children.get(node["id"], []):
        render_node(child, children, depth + 1, lines)


def generate_markmap(events_path: Path, output_path: Path) -> int:
    nodes = apply_events(read_events(events_path))
    children = build_children(nodes)
    try:
        source_display = events_path.resolve().relative_to(output_path.resolve().parent)
    except ValueError:
        source_display = events_path
    lines = [
        "# Debug Route Tracker V1.0",
        "",
        f"- source: `{source_display}`",
        f"- nodes: {len(nodes)}",
    ]
    for root in children.get("__root__", []):
        render_node(root, children, 0, lines)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(nodes)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", type=Path, default=SCRIPT_DIR / "debug_route_events.jsonl")
    parser.add_argument("--output", type=Path, default=SCRIPT_DIR / "debug_route_markmap.md")
    args = parser.parse_args()
    node_count = generate_markmap(args.events, args.output)
    print(f"wrote markmap summary with {node_count} nodes to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
