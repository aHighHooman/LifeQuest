"""Build the shared two-column LifeQuest tabletop.

The left 900 px column is the Quest workspace and the right 900 px column is
the Dashboard workspace. Both are lit and rendered together so the application
can pan one physical plate instead of dissolving between unrelated images.
"""

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
DASHBOARD_BLEND = ROOT / "src" / "assets" / "dashboard" / "health-injector-tabletop.blend"
OUTPUT_DIR = ROOT / "src" / "assets" / "tabletop"
BLEND_PATH = OUTPUT_DIR / "lifequest-tabletop-wide.blend"
RENDER_PATH = OUTPUT_DIR / "lifequest-tabletop-wide.webp"
SURFACE_RENDER_PATH = OUTPUT_DIR / "lifequest-tabletop-surface-wide.webp"
PROPS_RENDER_PATH = OUTPUT_DIR / "lifequest-dashboard-props-wide.webp"

PANEL_WORLD_WIDTH = 9.9
PANEL_OFFSET = PANEL_WORLD_WIDTH / 2


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_shared_table_material():
    material = bpy.data.materials.new("Shared navy to green LifeQuest tabletop")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    coordinates = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")

    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 10.0
    grain.inputs["Detail"].default_value = 6.0
    grain.inputs["Roughness"].default_value = 0.72

    quest_color = nodes.new("ShaderNodeValToRGB")
    quest_color.color_ramp.elements[0].color = (0.006, 0.021, 0.012, 1.0)
    quest_color.color_ramp.elements[1].color = (0.025, 0.082, 0.048, 1.0)

    dashboard_color = nodes.new("ShaderNodeValToRGB")
    dashboard_color.color_ramp.elements[0].color = (0.001, 0.004, 0.012, 1.0)
    dashboard_color.color_ramp.elements[1].color = (0.020, 0.040, 0.082, 1.0)

    quest_mask = nodes.new("ShaderNodeValToRGB")
    quest_mask.color_ramp.interpolation = "EASE"
    quest_mask.color_ramp.elements[0].position = 0.38
    quest_mask.color_ramp.elements[0].color = (1.0, 1.0, 1.0, 1.0)
    quest_mask.color_ramp.elements[1].position = 0.48
    quest_mask.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)

    dashboard_mask = nodes.new("ShaderNodeValToRGB")
    dashboard_mask.color_ramp.interpolation = "EASE"
    dashboard_mask.color_ramp.elements[0].position = 0.52
    dashboard_mask.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    dashboard_mask.color_ramp.elements[1].position = 0.62
    dashboard_mask.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)

    quest_mix = nodes.new("ShaderNodeMixRGB")
    quest_mix.blend_type = "MIX"
    quest_mix.inputs[1].default_value = (0.0025, 0.006, 0.009, 1.0)

    dashboard_mix = nodes.new("ShaderNodeMixRGB")
    dashboard_mix.blend_type = "MIX"

    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.11
    bump.inputs["Distance"].default_value = 0.05

    shader.inputs["Metallic"].default_value = 0.04
    shader.inputs["Roughness"].default_value = 0.80

    links.new(coordinates.outputs["Generated"], separate.inputs["Vector"])
    links.new(coordinates.outputs["Generated"], grain.inputs["Vector"])
    links.new(grain.outputs["Fac"], quest_color.inputs["Fac"])
    links.new(grain.outputs["Fac"], dashboard_color.inputs["Fac"])
    links.new(separate.outputs["X"], quest_mask.inputs["Fac"])
    links.new(separate.outputs["X"], dashboard_mask.inputs["Fac"])
    links.new(quest_mask.outputs["Color"], quest_mix.inputs["Fac"])
    links.new(quest_color.outputs["Color"], quest_mix.inputs[2])
    links.new(dashboard_mask.outputs["Color"], dashboard_mix.inputs["Fac"])
    links.new(quest_mix.outputs["Color"], dashboard_mix.inputs[1])
    links.new(dashboard_color.outputs["Color"], dashboard_mix.inputs[2])
    links.new(dashboard_mix.outputs["Color"], shader.inputs["Base Color"])
    links.new(grain.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def add_area_light(name, location, energy, color, size, target):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = energy
    light_data.color = color
    light_data.shape = "DISK"
    light_data.size = size
    light = bpy.data.objects.new(name, light_data)
    bpy.context.collection.objects.link(light)
    light.location = location
    point_at(light, target)
    return light


def build_scene():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(DASHBOARD_BLEND))
    scene = bpy.context.scene

    table = scene.objects["Workbench surface"]
    camera = scene.objects["Dashboard tabletop camera"]

    # Dashboard geometry becomes the right-hand workspace. Child objects inherit
    # the translation from their existing physical roots.
    for obj in scene.objects:
        if obj.parent is not None or obj in {table, camera}:
            continue
        if obj.name in {"Large soft overhead source", "Warm tabletop softbox"}:
            continue
        obj.location.x += PANEL_OFFSET

    table.data.materials.clear()
    table.data.materials.append(build_shared_table_material())

    # Dashboard keeps its own cool overhead and warm coin light.
    overhead = scene.objects["Large soft overhead source"]
    overhead.location = (PANEL_OFFSET - 4.5, 2.0, 10.5)
    overhead.data.energy = 925.0
    overhead.data.size = 5.5
    point_at(overhead, (PANEL_OFFSET, 6.0, 0.5))

    warm = scene.objects["Warm tabletop softbox"]
    warm.location = (PANEL_OFFSET - 4.5, -5.5, 11.5)
    warm.data.energy = 90.0
    warm.data.size = 5.5
    point_at(warm, (PANEL_OFFSET - 2.8, -4.7, 0.0))

    violet = scene.objects["Restrained violet fill"]
    point_at(violet, (PANEL_OFFSET + 1.0, 6.0, 0.5))

    crimson = scene.objects["Crimson reservoir spill"]
    point_at(crimson, (crimson.location.x, crimson.location.y - 0.2, 0.0))

    # Quest receives a separate matching rig rather than borrowing Dashboard's
    # light. The narrow unlit interval between rigs becomes a natural corridor.
    add_area_light(
        "Quest cool overhead source",
        (-PANEL_OFFSET - 4.5, 2.0, 10.5),
        925.0,
        (0.68, 0.76, 1.0),
        5.5,
        (-PANEL_OFFSET, 6.0, 0.5),
    )
    add_area_light(
        "Restrained green Quest fill",
        (-PANEL_OFFSET + 5.0, 8.5, 5.0),
        95.0,
        (0.12, 0.42, 0.23),
        4.0,
        (-PANEL_OFFSET + 1.0, 6.0, 0.5),
    )
    add_area_light(
        "Quest warm edge source",
        (-PANEL_OFFSET - 4.5, -5.5, 11.5),
        90.0,
        (1.0, 0.72, 0.40),
        5.5,
        (-PANEL_OFFSET, 5.8, 0.0),
    )

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 2000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 92

    camera.name = "LifeQuest shared tabletop camera"
    camera.location = (0.0, 0.0, 24.0)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 22.0
    point_at(camera, (0.0, 0.0, 0.0))
    scene.camera = camera

    renderable_objects = [
        obj for obj in scene.objects
        if obj.type in {"MESH", "FONT", "CURVE"}
    ]
    dashboard_props = [obj for obj in renderable_objects if obj != table]

    def render_layer(path, visible_objects, *, transparent):
        visible = set(visible_objects)
        for obj in renderable_objects:
            obj.hide_render = obj not in visible
        scene.render.filepath = str(path)
        scene.render.film_transparent = transparent
        scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
        bpy.ops.render.render(write_still=True)

    render_layer(SURFACE_RENDER_PATH, [table], transparent=False)
    render_layer(PROPS_RENDER_PATH, dashboard_props, transparent=True)
    render_layer(RENDER_PATH, [table] + dashboard_props, transparent=False)

    for obj in renderable_objects:
        obj.hide_render = False
    scene.render.filepath = str(RENDER_PATH)
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGB"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"Saved shared blend: {BLEND_PATH}")
    print(f"Saved shared render: {RENDER_PATH}")
    print(f"Saved surface layer: {SURFACE_RENDER_PATH}")
    print(f"Saved props layer: {PROPS_RENDER_PATH}")


if __name__ == "__main__":
    build_scene()
