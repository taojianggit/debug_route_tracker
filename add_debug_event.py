#!/usr/bin/env python3
"""Append one debug-route event and regenerate the browser data file."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from generate_debug_route_data import build_data  # noqa: E402


def parse_link(value: str) -> dict[str, str]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("link must be LABEL=HREF")
    label, href = value.split("=", 1)
    if not label or not href:
        raise argparse.ArgumentTypeError("link label and href must be non-empty")
    return {"label": label, "href": href}


def parse_key_value(value: str) -> tuple[str, object]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("value must be KEY=VALUE")
    key, raw_value = value.split("=", 1)
    if not key:
        raise argparse.ArgumentTypeError("key must be non-empty")
    try:
        parsed_value = json.loads(raw_value)
    except json.JSONDecodeError:
        parsed_value = raw_value
    return key, parsed_value


def add_if_present(event: dict, key: str, value: object) -> None:
    if value is None:
        return
    if value == [] or value == {}:
        return
    event[key] = value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True)
    parser.add_argument("--op", choices=["upsert", "patch", "delete"], default="upsert")
    parser.add_argument("--parent", dest="parent_id", default=None)
    parser.add_argument("--title", default=None)
    parser.add_argument("--route", default=None)
    parser.add_argument("--status", default=None)
    parser.add_argument("--summary", default=None)
    parser.add_argument("--tag", action="append", default=[])
    parser.add_argument("--link", action="append", type=parse_link, default=[])
    parser.add_argument("--metric", action="append", type=parse_key_value, default=[])
    parser.add_argument("--code-ref", action="append", type=parse_link, default=[])
    parser.add_argument("--log-ref", action="append", type=parse_link, default=[])
    parser.add_argument("--created-at", default=None)
    parser.add_argument("--no-regenerate", action="store_true")
    parser.add_argument("--events", type=Path, default=SCRIPT_DIR / "debug_route_events.jsonl")
    parser.add_argument("--output", type=Path, default=SCRIPT_DIR / "debug_route_data.js")
    parser.add_argument("--graph-output", type=Path, default=SCRIPT_DIR / "debug_route_graph.json")
    args = parser.parse_args()

    metrics = {key: value for key, value in args.metric}
    event = {"id": args.id}
    if args.op != "upsert":
        event["op"] = args.op

    if args.op != "delete":
        add_if_present(event, "parent_id", args.parent_id)
        add_if_present(event, "title", args.title)
        add_if_present(event, "route", args.route)
        add_if_present(event, "status", args.status)
        add_if_present(event, "summary", args.summary)
        add_if_present(event, "links", args.link)
        add_if_present(event, "tags", args.tag)
        add_if_present(event, "metrics", metrics)
        add_if_present(event, "code_refs", args.code_ref)
        add_if_present(event, "log_refs", args.log_ref)

    event["created_at"] = args.created_at or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    args.events.parent.mkdir(parents=True, exist_ok=True)
    with args.events.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")

    if args.no_regenerate:
        print(f"appended {args.id}; skipped regeneration")
        return 0

    data = build_data(args.events, args.output, args.graph_output)
    print(f"appended {args.id}; generated {data['node_count']} nodes and {data['edge_count']} edges")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
