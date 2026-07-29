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
PREVIEW_DIR = OUTPUT_DIR / "_transition_preview"
ANIMATION_BLEND_PATH = OUTPUT_DIR / "lifequest-tabletop-transition.blend"
DASHBOARD_STILL = OUTPUT_DIR / "lifequest-dashboard-perspective.webp"
QUEST_STILL = OUTPUT_DIR / "lifequest-quests-perspective.webp"

PANEL_CENTER = 4.95
FRAME_END = 30
FPS = 30


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


def configure_animation():
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
    set_camera_key(
        camera, 1,
        observer_location,
        (PANEL_CENTER, 0.7, 0.15),
        47.0,
    )
    set_camera_key(
        camera, 8,
        observer_location,
        (2.8, 0.9, 0.2),
        47.0,
    )
    set_camera_key(
        camera, 16,
        observer_location,
        (0.0, 1.0, 0.2),
        47.0,
    )
    set_camera_key(
        camera, 23,
        observer_location,
        (-3.2, 0.9, 0.2),
        47.0,
    )
    set_camera_key(
        camera, FRAME_END,
        observer_location,
        (-5.8, 0.7, 0.15),
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
    bpy.ops.wm.save_as_mainfile(filepath=str(ANIMATION_BLEND_PATH))
    return scene


def render_preview(scene):
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    for frame in (1, 8, 16, 23, FRAME_END):
        scene.frame_set(frame)
        scene.render.filepath = str(PREVIEW_DIR / f"transition-{frame:03d}.png")
        bpy.ops.render.render(write_still=True)


def render_animation(scene):
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(FRAME_DIR / "frame-")
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
    configured_scene = configure_animation()
    if mode == "animation":
        render_rest_stills(configured_scene)
        render_animation(configured_scene)
    else:
        render_preview(configured_scene)
