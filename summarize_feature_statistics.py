#!/usr/bin/env python3
"""Summarize feature_statistics.csv runs into one comparison table."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from statistics import mean


def percentile(values: list[float], ratio: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = int(round((len(ordered) - 1) * ratio))
    return ordered[max(0, min(index, len(ordered) - 1))]


def read_float(row: dict[str, str], key: str) -> float:
    try:
        return float(row.get(key, "0") or "0")
    except ValueError:
        return 0.0


def summarize_file(path: Path, log_root: Path) -> dict[str, object] | None:
    rows: list[dict[str, str]] = []
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(row)

    if not rows:
        return {
            "run_id": path.parent.name,
            "relative_path": str(path.relative_to(log_root.parent)),
            "frames": 0,
            "duration_s": "0.000",
            "mean_tracked": "0.000",
            "p10_tracked": "0.000",
            "min_tracked": "0.000",
            "mean_total": "0.000",
            "mean_inlier": "0.000000",
            "mean_reproj": "0.000000",
            "mean_quality": "0.000000",
            "dropout_frames": 0,
            "low_inlier_frames": 0,
            "score": "-9999.000",
            "verdict": "no_data",
        }

    tracked = [read_float(row, "tracked_features") for row in rows]
    total = [read_float(row, "total_features") for row in rows]
    valid_rows = [row for row in rows if read_float(row, "tracked_features") > 0]
    quality_rows = valid_rows or rows

    timestamps = [read_float(row, "timestamp") for row in rows]
    duration = max(timestamps) - min(timestamps) if len(timestamps) > 1 else 0.0
    mean_inlier = mean(read_float(row, "inlier_ratio") for row in quality_rows)
    mean_reproj = mean(read_float(row, "reproj_error") for row in quality_rows)
    mean_quality = mean(read_float(row, "quality_score") for row in quality_rows)
    mean_tracked = mean(tracked)
    mean_total = mean(total)

    dropout_frames = sum(1 for value in tracked if value < 30)
    low_inlier_frames = sum(1 for row in quality_rows if read_float(row, "inlier_ratio") < 0.7)
    score = mean_quality * 100.0 + mean_tracked * 0.1 - mean_reproj * 20.0 - dropout_frames * 0.5

    if len(rows) < 30:
        verdict = "too_short"
    elif dropout_frames > len(rows) * 0.1:
        verdict = "unstable_tracking"
    elif mean_inlier < 0.8:
        verdict = "low_inlier"
    else:
        verdict = "feature_candidate"

    return {
        "run_id": path.parent.name,
        "relative_path": str(path.relative_to(log_root.parent)),
        "frames": len(rows),
        "duration_s": f"{duration:.3f}",
        "mean_tracked": f"{mean_tracked:.3f}",
        "p10_tracked": f"{percentile(tracked, 0.10):.3f}",
        "min_tracked": f"{min(tracked):.3f}",
        "mean_total": f"{mean_total:.3f}",
        "mean_inlier": f"{mean_inlier:.6f}",
        "mean_reproj": f"{mean_reproj:.6f}",
        "mean_quality": f"{mean_quality:.6f}",
        "dropout_frames": dropout_frames,
        "low_inlier_frames": low_inlier_frames,
        "score": f"{score:.3f}",
        "verdict": verdict,
    }


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    workspace = script_dir.parents[1]

    parser = argparse.ArgumentParser()
    parser.add_argument("--log-root", type=Path, default=workspace / "src" / "log")
    parser.add_argument("--output", type=Path, default=script_dir / "feature_run_summary.csv")
    args = parser.parse_args()

    summaries = []
    for path in sorted(args.log_root.glob("*/feature_statistics.csv")):
        summary = summarize_file(path, args.log_root)
        if summary:
            summaries.append(summary)

    summaries.sort(key=lambda row: float(row["score"]), reverse=True)

    fields = [
        "run_id",
        "relative_path",
        "frames",
        "duration_s",
        "mean_tracked",
        "p10_tracked",
        "min_tracked",
        "mean_total",
        "mean_inlier",
        "mean_reproj",
        "mean_quality",
        "dropout_frames",
        "low_inlier_frames",
        "score",
        "verdict",
    ]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(summaries)

    print(f"wrote {len(summaries)} summaries to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
