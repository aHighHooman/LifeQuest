"""Render the physical Dashboard <-> Quest camera move.

This uses the assembled wide tabletop scene, but replaces its orthographic
camera with a perspective camera on a shallow, human-scale body-turn arc.
Because the lights and props stay in world space, the injector glass, metal
edges, coins, and table grain all change their reflections naturally.
"""

from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = ROOT / "src" / "assets" / "tabletop" / "lifequest-tabletop-wide.blend"
OUTPUT_DIR = ROOT / "src" / "assets" / "tabletop"
FRAME_DIR = OUTPUT_DIR / "_transition_frames"
REVERSE_FRAME_DIR = OUTPUT_DIR / "_transition_frames_reverse"
PREVIEW_DIR = OUTPUT_DIR / "_transition_preview"
ANIMATION_BLEND_PATH = OUTPUT_DIR / "lifequest-tabletop-transition.blend"
DASHBOARD_STILL = OUTPUT_DIR / "lifequest-dashboard-perspective.webp"
QUEST_STILL = OUTPUT_DIR / "lifequest-quests-perspective.webp"

PANEL_CENTER = 4.95
FRAME_END = 30
FPS = 30
INTERFACE_EASE = (0.45, 0.0, 0.2, 1.0)
START_HOLD_FRAMES = 1


def cubic_bezier_progress(progress, control_points=INTERFACE_EASE):
    """Return CSS cubic-bezier progress for a normalized point in time."""
    x1, y1, x2, y2 = control_points

    def sample_curve(t, point1, point2):
        inverse = 1.0 - t
        return (
            3.0 * inverse * inverse * t * point1
            + 3.0 * inverse * t * t * point2
            + t * t * t
        )

    low = 0.0
    high = 1.0
    for _ in range(18):
        midpoint = (low + high) * 0.5
        if sample_curve(midpoint, x1, x2) < progress:
            low = midpoint
        else:
            high = midpoint

    curve_time = (low + high) * 0.5
    return sample_curve(curve_time, y1, y2)


def camera_rotation(location, target):
    forward = (Vector(target) - Vector(location)).normalized()
    table_up = Vector((0.0, 1.0, 0.0))
    right = forward.cross(table_up).normalized()
    up = right.cross(forward).normalized()
    return Matrix((right, up, -forward)).transposed().to_quaternion()


def set_camera_key(camera, frame, location, target, lens):
    camera.location = location
    camera.rotation_quaternion = camera_rotation(location, target)
    camera.data.lens = lens
    camera.keyframe_insert(data_path="location", frame=frame)
    camera.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    camera.data.keyframe_insert(data_path="lens", frame=frame)


def configure_animation(reverse=False):
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
    scene = bpy.context.scene
    camera = scene.camera

    camera.name = "LifeQuest perspective body-turn camera"
    camera.data.type = "PERSP"
    camera.data.lens = 47.0
    camera.data.sensor_fit = "VERTICAL"
    camera.data.dof.use_dof = False
    camera.rotation_mode = "QUATERNION"
    camera.animation_data_clear()
    camera.data.animation_data_clear()

    # The observer stays planted at the center of the table and turns their
    # gaze between workspaces. There is deliberately no lateral dolly, height
    # bob, lens breathing, roll, or depth-of-field flourish.
    observer_location = (0.0, -0.35, 45.0)
    # Match the live tabletop strip exactly: both use the same normalized
    # cubic-bezier curve and one-second timeline. Keying every rendered frame
    # avoids Blender's independent automatic handle timing and keeps the
    # physical camera turn subordinate to the interface motion.
    dashboard_target = Vector((PANEL_CENTER, 0.7, 0.15))
    quest_target = Vector((-5.8, 0.7, 0.15))
    start_target, end_target = (
        (quest_target, dashboard_target)
        if reverse
        else (dashboard_target, quest_target)
    )
    for frame in range(1, FRAME_END + 1):
        moving_frame_count = FRAME_END - 1 - START_HOLD_FRAMES
        normalized_time = max(
            0.0,
            (frame - 1 - START_HOLD_FRAMES) / moving_frame_count,
        )
        interface_progress = cubic_bezier_progress(normalized_time)
        target = start_target.lerp(end_target, interface_progress)
        set_camera_key(
            camera,
            frame,
            observer_location,
            target,
            47.0,
        )

    scene.frame_start = 1
    scene.frame_end = FRAME_END
    scene.render.fps = FPS
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 540
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False

    bpy.context.preferences.filepaths.save_version = 0
    if not reverse:
        bpy.ops.wm.save_as_mainfile(filepath=str(ANIMATION_BLEND_PATH))
    return scene


def render_preview(scene):
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    for frame in (1, 8, 16, 23, FRAME_END):
        scene.frame_set(frame)
        scene.render.filepath = str(PREVIEW_DIR / f"transition-{frame:03d}.png")
        bpy.ops.render.render(write_still=True)


def render_animation(scene, frame_dir=FRAME_DIR):
    frame_dir.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(frame_dir / "frame-")
    bpy.ops.render.render(animation=True)


def render_rest_stills(scene):
    original_format = scene.render.image_settings.file_format
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 92
    for frame, path in ((1, DASHBOARD_STILL), (FRAME_END, QUEST_STILL)):
        scene.frame_set(frame)
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
    scene.render.image_settings.file_format = original_format


if __name__ == "__main__":
    mode = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "preview"
    configured_scene = configure_animation(reverse=mode == "animation-reverse")
    if mode == "animation":
        render_rest_stills(configured_scene)
        render_animation(configured_scene)
    elif mode == "animation-reverse":
        render_animation(configured_scene, REVERSE_FRAME_DIR)
    else:
        render_preview(configured_scene)
