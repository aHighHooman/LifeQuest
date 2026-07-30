#!/usr/bin/env python3
"""Validate the dashboard's physical overlays against the 390 px tabletop render."""

from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw
except ModuleNotFoundError as error:
    print(
        "Missing validator dependency. Run "
        "`python -m pip install -r tools/requirements-dashboard-validator.txt`.",
        file=sys.stderr,
    )
    raise SystemExit(2) from error


ROOT = Path(__file__).resolve().parents[1]
REFERENCE_WIDTH = 540
REFERENCE_HEIGHT = 1200
VALIDATION_WIDTH = 390
VALIDATION_HEIGHT = round(VALIDATION_WIDTH * REFERENCE_HEIGHT / REFERENCE_WIDTH)
MAX_CENTER_ERROR_PX = 2.0

# These are the last user-approved overlay coordinates on the former dashboard
# perspective render. Image registration transfers those approved centers onto
# the current wide tabletop asset instead of trusting the current CSS values.
APPROVED_BASELINE = {
    "health": {
        "hotspot": {
            "leftPercent": 47.4,
            "topPercent": 22.5,
            "widthPercent": 27.0,
            "heightPercent": 3.8,
        },
        "templateBox": (215, 185, 410, 365),
        "searchRadius": (70, 100),
        "minimumConfidence": 0.5,
        "rotationDegrees": 30.0,
    },
    "coins": {
        "hotspot": {
            "leftPercent": 16.5,
            "topPercent": 73.24,
            "widthPercent": 8.8,
            "heightPercent": 4.0,
        },
        "templateBox": (65, 840, 155, 945),
        "searchRadius": (100, 100),
        "minimumConfidence": 0.4,
        "rotationDegrees": 0.0,
    },
}


def load_hotspots() -> dict[str, dict[str, float]]:
    script = (
        "import { DASHBOARD_HOTSPOTS } from "
        "'./src/utils/tabletopLayout.js';"
        "process.stdout.write(JSON.stringify(DASHBOARD_HOTSPOTS));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def gradient_magnitude(image: np.ndarray) -> np.ndarray:
    gradient_x = np.zeros_like(image, dtype=np.float32)
    gradient_y = np.zeros_like(image, dtype=np.float32)
    gradient_x[:, 1:-1] = image[:, 2:] - image[:, :-2]
    gradient_y[1:-1] = image[2:] - image[:-2]
    return np.hypot(gradient_x, gradient_y)


def find_translation(
    reference: np.ndarray,
    candidate: np.ndarray,
    template_box: tuple[int, int, int, int],
    search_radius: tuple[int, int],
) -> tuple[int, int, float]:
    left, top, right, bottom = template_box
    radius_x, radius_y = search_radius
    template = reference[top:bottom, left:right]
    template = template - template.mean()
    template_norm = math.sqrt(float(np.sum(template * template)))
    best_score = -1.0
    best_shift = (0, 0)

    for shift_y in range(-radius_y, radius_y + 1):
        for shift_x in range(-radius_x, radius_x + 1):
            candidate_left = left + shift_x
            candidate_top = top + shift_y
            candidate_right = right + shift_x
            candidate_bottom = bottom + shift_y
            if (
                candidate_left < 0
                or candidate_top < 0
                or candidate_right > candidate.shape[1]
                or candidate_bottom > candidate.shape[0]
            ):
                continue

            patch = candidate[
                candidate_top:candidate_bottom,
                candidate_left:candidate_right,
            ]
            patch = patch - patch.mean()
            denominator = template_norm * math.sqrt(float(np.sum(patch * patch)))
            score = float(np.sum(template * patch) / denominator) if denominator else -1.0
            if score > best_score:
                best_score = score
                best_shift = (shift_x, shift_y)

    return (*best_shift, best_score)


def hotspot_center(hotspot: dict[str, float]) -> tuple[float, float]:
    return (
        REFERENCE_WIDTH
        * (hotspot["leftPercent"] + hotspot["widthPercent"] / 2)
        / 100,
        REFERENCE_HEIGHT
        * (hotspot["topPercent"] + hotspot["heightPercent"] / 2)
        / 100,
    )


def rotated_rectangle(
    center: tuple[float, float],
    width: float,
    height: float,
    degrees: float,
) -> list[tuple[float, float]]:
    center_x, center_y = center
    radians = math.radians(degrees)
    cosine = math.cos(radians)
    sine = math.sin(radians)
    corners = [
        (-width / 2, -height / 2),
        (width / 2, -height / 2),
        (width / 2, height / 2),
        (-width / 2, height / 2),
    ]
    return [
        (
            center_x + (x * cosine) - (y * sine),
            center_y + (x * sine) + (y * cosine),
        )
        for x, y in corners
    ]


def main() -> int:
    old_path = ROOT / "src/assets/tabletop/lifequest-dashboard-perspective.webp"
    wide_path = ROOT / "src/assets/tabletop/lifequest-tabletop-wide.webp"
    output_directory = ROOT / "test-results"
    output_directory.mkdir(parents=True, exist_ok=True)

    old_image = Image.open(old_path).convert("L")
    wide_image = Image.open(wide_path).convert("L")
    dashboard_image = wide_image.crop(
        (wide_image.width // 2, 0, wide_image.width, wide_image.height)
    ).resize((REFERENCE_WIDTH, REFERENCE_HEIGHT), Image.Resampling.LANCZOS)

    old_edges = gradient_magnitude(np.asarray(old_image, dtype=np.float32))
    dashboard_edges = gradient_magnitude(np.asarray(dashboard_image, dtype=np.float32))
    current_hotspots = load_hotspots()
    scale = VALIDATION_WIDTH / REFERENCE_WIDTH
    results: dict[str, dict[str, object]] = {}
    passed = True

    annotated = Image.open(wide_path).convert("RGB").crop(
        (wide_image.width // 2, 0, wide_image.width, wide_image.height)
    ).resize((VALIDATION_WIDTH, VALIDATION_HEIGHT), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(annotated)

    for name, approved in APPROVED_BASELINE.items():
        shift_x, shift_y, confidence = find_translation(
            old_edges,
            dashboard_edges,
            approved["templateBox"],
            approved["searchRadius"],
        )
        baseline_center = hotspot_center(approved["hotspot"])
        expected_center = (
            baseline_center[0] + shift_x,
            baseline_center[1] + shift_y,
        )
        actual_hotspot = current_hotspots[name]
        actual_center = hotspot_center(actual_hotspot)
        error = (
            (actual_center[0] - expected_center[0]) * scale,
            (actual_center[1] - expected_center[1]) * scale,
        )
        distance = math.hypot(*error)
        target_passed = (
            confidence >= approved["minimumConfidence"]
            and distance <= MAX_CENTER_ERROR_PX
        )
        passed = passed and target_passed

        expected_390 = (
            expected_center[0] * scale,
            expected_center[1] * scale,
        )
        actual_390 = (
            actual_center[0] * scale,
            actual_center[1] * scale,
        )
        hotspot_width = REFERENCE_WIDTH * actual_hotspot["widthPercent"] / 100 * scale
        hotspot_height = REFERENCE_HEIGHT * actual_hotspot["heightPercent"] / 100 * scale
        polygon = rotated_rectangle(
            actual_390,
            hotspot_width,
            hotspot_height,
            approved["rotationDegrees"],
        )

        draw.polygon(polygon, outline=(255, 80, 210), width=2)
        radius = 5
        draw.ellipse(
            (
                expected_390[0] - radius,
                expected_390[1] - radius,
                expected_390[0] + radius,
                expected_390[1] + radius,
            ),
            outline=(80, 255, 130),
            width=2,
        )
        draw.line((expected_390, actual_390), fill=(255, 215, 70), width=2)
        draw.text(
            (actual_390[0] + 8, actual_390[1] + 6),
            f"{name}: {distance:.2f}px",
            fill=(255, 255, 255),
            stroke_width=2,
            stroke_fill=(0, 0, 0),
        )

        results[name] = {
            "status": "PASS" if target_passed else "FAIL",
            "registrationConfidence": round(confidence, 4),
            "assetShiftAt540": {"x": shift_x, "y": shift_y},
            "expectedCenterAt390": {
                "x": round(expected_390[0], 2),
                "y": round(expected_390[1], 2),
            },
            "actualCenterAt390": {
                "x": round(actual_390[0], 2),
                "y": round(actual_390[1], 2),
            },
            "centerErrorAt390": {
                "x": round(error[0], 2),
                "y": round(error[1], 2),
                "distance": round(distance, 2),
            },
        }

    image_output = output_directory / "dashboard-alignment-390.png"
    json_output = output_directory / "dashboard-alignment-390.json"
    annotated.save(image_output)
    json_output.write_text(
        json.dumps(
            {
                "status": "PASS" if passed else "FAIL",
                "viewport": {"width": VALIDATION_WIDTH, "height": 844},
                "coordinatePlane": {
                    "width": VALIDATION_WIDTH,
                    "height": VALIDATION_HEIGHT,
                },
                "maximumCenterErrorPixels": MAX_CENTER_ERROR_PX,
                "targets": results,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Dashboard alignment at {VALIDATION_WIDTH}px: {'PASS' if passed else 'FAIL'}")
    for name, result in results.items():
        error = result["centerErrorAt390"]
        print(
            f"  {name}: {result['status']} "
            f"(dx={error['x']:+.2f}px, dy={error['y']:+.2f}px, "
            f"distance={error['distance']:.2f}px, "
            f"confidence={result['registrationConfidence']:.4f})"
        )
    print(f"  annotated image: {image_output.relative_to(ROOT)}")
    print(f"  measurements: {json_output.relative_to(ROOT)}")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
