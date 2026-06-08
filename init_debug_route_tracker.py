#!/usr/bin/env python3
"""Initialize a project-local Debug Route Tracker V1.0 directory."""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from generate_debug_route_data import build_data  # noqa: E402
from generate_markmap_summary import generate_markmap  # noqa: E402

ASSET_FILES = [
    "README.md",
    "VERSION",
    "debug-route",
    "upgrade_plan.md",
    "index.html",
    "debug_route.css",
    "debug_route_app.js",
    "init_debug_route_tracker.py",
    "generate_debug_route_data.py",
    "generate_markmap_summary.py",
    "add_debug_event.py",
    "summarize_feature_statistics.py",
]

LEDGER_FIELDS = [
    "trial_id",
    "parent_trial",
    "date_time",
    "module_route",
    "hypothesis",
    "code_state",
    "config_path",
    "bag_or_input",
    "replay_window",
    "build_result",
    "run_output",
    "primary_metric",
    "secondary_metrics",
    "verdict",
    "next_action",
    "notes",
]


def copy_file(source: Path, target: Path, force: bool) -> None:
    if target.exists() and not force:
        return
    if source.resolve() == target.resolve():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def copy_assets(target_dir: Path, force: bool) -> None:
    for name in ASSET_FILES:
        copy_file(SCRIPT_DIR / name, target_dir / name, force)
    source_view = SCRIPT_DIR / "react_flow_view"
    target_view = target_dir / "react_flow_view"
    target_view.mkdir(parents=True, exist_ok=True)
    for source in source_view.iterdir():
        if source.is_file():
            copy_file(source, target_view / source.name, force)


def ensure_starter_files(target_dir: Path) -> Path:
    events_path = target_dir / "debug_route_events.jsonl"
    if not events_path.exists():
        event = {
            "id": "main-debug-objective",
            "parent_id": None,
            "title": "Main debug objective",
            "route": "mainline",
            "status": "current",
            "summary": "Replace this node with the current workspace debug objective.",
            "links": [],
            "tags": ["mainline"],
            "metrics": {},
            "code_refs": [],
            "log_refs": [],
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        events_path.write_text(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    ledger_path = target_dir / "run_ledger.csv"
    if not ledger_path.exists():
        with ledger_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=LEDGER_FIELDS)
            writer.writeheader()

    feature_summary_path = target_dir / "feature_run_summary.csv"
    if not feature_summary_path.exists():
        feature_summary_path.write_text("run_id,relative_path,frames,verdict\n", encoding="utf-8")

    return events_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=Path, required=True, help="Target tracker directory for a workspace")
    parser.add_argument("--force", action="store_true", help="Overwrite fixed V1.0 assets")
    args = parser.parse_args()

    target_dir = args.target.resolve()
    target_dir.mkdir(parents=True, exist_ok=True)
    copy_assets(target_dir, args.force)
    events_path = ensure_starter_files(target_dir)
    data = build_data(events_path, target_dir / "debug_route_data.js", target_dir / "debug_route_graph.json")
    generate_markmap(events_path, target_dir / "debug_route_markmap.md")
    print(f"initialized Debug Route Tracker V1.0 at {target_dir}")
    print(f"generated {data['node_count']} nodes from {events_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
