import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "src" / "assets" / "quests"
RENDER_PATH = OUTPUT_DIR / "quest-deck-tabletop-blender.webp"
BLEND_PATH = OUTPUT_DIR / "quest-deck-tabletop.blend"
BASE_RENDER_PATH = OUTPUT_DIR / "quest-tabletop-base-blender.webp"
RARITIES = ("easy", "medium", "hard", "legendary")
SLOTS = ("rear", "middle", "active")
CARD_RENDER_PATHS = {
    rarity: {
        slot: OUTPUT_DIR / f"quest-card-{slot}-{rarity}-blender.webp"
        for slot in SLOTS
    }
    for rarity in RARITIES
}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def material(name, color, *, metallic=0.0, roughness=0.5, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Alpha"].default_value = alpha
    if alpha < 1.0 and hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    return mat


def tabletop_material():
    mat = material("Dark green card table", (0.012, 0.042, 0.025), roughness=0.82)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes.get("Principled BSDF")

    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 7.0
    noise.inputs["Roughness"].default_value = 0.72
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.006, 0.021, 0.012, 1.0)
    ramp.color_ramp.elements[1].color = (0.025, 0.082, 0.048, 1.0)
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.13
    bump.inputs["Distance"].default_value = 0.045
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def add_box(name, dimensions, location, mat, *, bevel=0.06, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new(name="Soft physical edge", type="BEVEL")
    modifier.width = bevel
    modifier.segments = 5
    return obj


def add_clipped_box(name, dimensions, location, mat, *, clip=0.24, bevel=0.06, rotation=(0.0, 0.0, 0.0)):
    """Extruded card shell with deliberately clipped, forged corners."""
    width, height, depth = dimensions
    half_w, half_h, half_d = width / 2, height / 2, depth / 2
    outline = (
        (-half_w + clip, -half_h),
        (half_w - clip, -half_h),
        (half_w, -half_h + clip),
        (half_w, half_h - clip),
        (half_w - clip, half_h),
        (-half_w + clip, half_h),
        (-half_w, half_h - clip),
        (-half_w, -half_h + clip),
    )
    vertices = [(x, y, -half_d) for x, y in outline] + [(x, y, half_d) for x, y in outline]
    faces = [tuple(range(7, -1, -1)), tuple(range(8, 16))]
    faces.extend((index, (index + 1) % 8, 8 + (index + 1) % 8, 8 + index) for index in range(8))
    mesh = bpy.data.meshes.new(f"{name} mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new(name="Forged clipped edge", type="BEVEL")
    modifier.width = bevel
    modifier.segments = 3
    return obj


def rotated_offset(x, y, angle):
    return (
        x * math.cos(angle) - y * math.sin(angle),
        x * math.sin(angle) + y * math.cos(angle),
    )


def physical_card(name, location, rotation_z, materials, shadow, rarity):
    """One manufactured card with rarity-specific construction and detailing."""
    x, y, z = location
    rotation = (0.0, 0.0, math.radians(rotation_z))
    objects = []
    shell = materials["shell"]
    face = materials["face"]
    edge = materials["edge"]
    accent = materials["accent"]
    highlight = materials["highlight"]
    shell_builder = add_clipped_box if rarity == "hard" else add_box
    shell_options = {"clip": 0.30} if rarity == "hard" else {}
    face_builder = add_clipped_box if rarity == "hard" else add_box
    face_options = {"clip": 0.23} if rarity == "hard" else {}

    card = shell_builder(
        f"{name} full-size shell",
        (8.0, 5.70, 0.14),
        (x, y, z),
        shell,
        bevel=0.18,
        rotation=rotation,
        **shell_options,
    )
    objects.append(card)
    objects.append(face_builder(
        f"{name} inset face",
        (7.72, 5.42, 0.055),
        (x, y, z + 0.095),
        face,
        bevel=0.13,
        rotation=rotation,
        **face_options,
    ))
    objects.append(add_box(
        f"{name} lower laminate",
        (7.90, 5.60, 0.035),
        (x, y, z - 0.085),
        edge,
        bevel=0.15,
        rotation=rotation,
    ))

    angle = math.radians(rotation_z)
    rail_width = 0.045 if rarity == "easy" else 0.075
    rail_inset = 2.635 if rarity != "legendary" else 2.59
    for part, dx, dy, width, height in (
        ("top", 0.0, rail_inset, 7.64, rail_width),
        ("bottom", 0.0, -rail_inset, 7.64, rail_width),
        ("left", -3.79, 0.0, rail_width, 5.23),
        ("right", 3.79, 0.0, rail_width, 5.23),
    ):
        offset_x, offset_y = rotated_offset(dx, dy, angle)
        objects.append(add_box(
            f"{name} {rarity} perimeter rail {part}",
            (width, height, 0.028),
            (x + offset_x, y + offset_y, z + 0.135),
            accent,
            bevel=0.025,
            rotation=rotation,
        ))

    def detail_box(part, dx, dy, width, height, mat=accent, height_z=0.034):
        offset_x, offset_y = rotated_offset(dx, dy, angle)
        objects.append(add_box(
            f"{name} {rarity} {part}",
            (width, height, height_z),
            (x + offset_x, y + offset_y, z + 0.145),
            mat,
            bevel=min(width, height, 0.08) * 0.22,
            rotation=rotation,
        ))

    if rarity == "medium":
        # Tempered-alloy corner brackets and twin header rails restore the
        # original Rare card's cool, engineered appearance.
        for corner, dx, dy in (
            ("upper left bracket", -3.49, 2.36),
            ("upper right bracket", 3.49, 2.36),
            ("lower left bracket", -3.49, -2.36),
            ("lower right bracket", 3.49, -2.36),
        ):
            detail_box(corner, dx, dy, 0.48, 0.18, highlight)
        detail_box("upper signal rail", 0.0, 2.37, 2.25, 0.055, highlight)
        detail_box("lower signal rail", 0.0, -2.37, 1.15, 0.045, accent)
    elif rarity == "hard":
        # Epic uses a visibly forged silhouette, segmented side armor, and
        # diagonal corner cuts instead of a rounded recolored rectangle.
        for side, dx in (("left armor", -3.62), ("right armor", 3.62)):
            detail_box(side, dx, 0.0, 0.16, 2.76, highlight)
        for index, (dx, dy) in enumerate(((-3.48, 2.25), (3.48, 2.25), (-3.48, -2.25), (3.48, -2.25))):
            detail_box(f"forged corner node {index}", dx, dy, 0.34, 0.34, accent)
        detail_box("epic center spine", 0.0, 2.38, 1.55, 0.085, highlight)
    elif rarity == "legendary":
        # Legendary is a layered black-metal artifact with substantial gold
        # corner armor and a small raised crest.
        for corner, dx, dy in (
            ("gold upper left armor", -3.42, 2.31),
            ("gold upper right armor", 3.42, 2.31),
            ("gold lower left armor", -3.42, -2.31),
            ("gold lower right armor", 3.42, -2.31),
        ):
            detail_box(corner, dx, dy, 0.64, 0.24, highlight, 0.045)
        detail_box("gold inner top rail", 0.0, 2.35, 2.65, 0.075, highlight)
        detail_box("gold inner bottom rail", 0.0, -2.35, 2.10, 0.06, highlight)
        offset_x, offset_y = rotated_offset(0.0, 2.08, angle)
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16,
            radius=0.18,
            depth=0.055,
            location=(x + offset_x, y + offset_y, z + 0.16),
            rotation=rotation,
        )
        crest = bpy.context.object
        crest.name = f"{name} legendary raised crest"
        crest.data.materials.append(highlight)
        objects.append(crest)
    else:
        # Common stays intentionally utilitarian, but its inset field rails
        # make it read as a manufactured card rather than an empty slab.
        detail_box("field top index", 0.0, 2.36, 1.25, 0.045, highlight)
        detail_box("field lower index", 0.0, -2.36, 0.72, 0.04, accent)

    shadow_x, shadow_y = rotated_offset(0.07, -0.09, angle)
    shadow_card = add_box(
        f"{name} contact shadow",
        (8.10, 5.80, 0.018),
        (x + shadow_x, y + shadow_y, z - 0.105),
        shadow,
        bevel=0.20,
        rotation=rotation,
    )
    objects.insert(0, shadow_card)
    return {"objects": objects}


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, color, size, target):
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)


def build_scene():
    reset_scene()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 2000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.quality = 92
    scene.render.filepath = str(RENDER_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.002, 0.004, 0.008)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.022, 0.014, 0.006, 1.0)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.28

    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    table = tabletop_material()
    card_shadow = material("Card layer contact shadow", (0.0, 0.0, 0.0), roughness=1.0, alpha=0.26)
    rarity_materials = {
        "easy": {
            "shell": material("Common field shell", (0.012, 0.027, 0.016), metallic=0.18, roughness=0.50),
            "face": material("Common moss face", (0.025, 0.064, 0.035), metallic=0.04, roughness=0.68),
            "edge": material("Common dark laminate", (0.004, 0.009, 0.005), metallic=0.12, roughness=0.50),
            "accent": material("Common olive inlay", (0.16, 0.31, 0.17), metallic=0.34, roughness=0.35),
            "highlight": material("Common pale index", (0.33, 0.48, 0.31), metallic=0.30, roughness=0.29),
        },
        "medium": {
            "shell": material("Rare tempered shell", (0.009, 0.022, 0.035), metallic=0.62, roughness=0.31),
            "face": material("Rare blue alloy face", (0.018, 0.050, 0.077), metallic=0.33, roughness=0.43),
            "edge": material("Rare gunmetal laminate", (0.004, 0.010, 0.017), metallic=0.66, roughness=0.27),
            "accent": material("Rare cobalt inlay", (0.08, 0.31, 0.53), metallic=0.68, roughness=0.23),
            "highlight": material("Rare silver-blue bracket", (0.25, 0.51, 0.69), metallic=0.78, roughness=0.19),
        },
        "hard": {
            "shell": material("Epic forged shell", (0.031, 0.010, 0.041), metallic=0.48, roughness=0.37),
            "face": material("Epic composite face", (0.063, 0.020, 0.077), metallic=0.21, roughness=0.51),
            "edge": material("Epic black composite edge", (0.010, 0.003, 0.013), metallic=0.28, roughness=0.40),
            "accent": material("Epic violet node", (0.39, 0.12, 0.50), metallic=0.54, roughness=0.26),
            "highlight": material("Epic amethyst armor", (0.53, 0.26, 0.62), metallic=0.60, roughness=0.22),
        },
        "legendary": {
            "shell": material("Legendary blackened shell", (0.025, 0.021, 0.010), metallic=0.76, roughness=0.24),
            "face": material("Legendary obsidian face", (0.045, 0.038, 0.018), metallic=0.42, roughness=0.36),
            "edge": material("Legendary dark bronze edge", (0.015, 0.010, 0.003), metallic=0.72, roughness=0.25),
            "accent": material("Legendary aged gold inlay", (0.42, 0.26, 0.045), metallic=0.82, roughness=0.22),
            "highlight": material("Legendary bright gold armor", (0.68, 0.46, 0.09), metallic=0.90, roughness=0.16),
        },
    }

    add_box("Workbench", (30.0, 30.0, 0.35), (0.0, 0.0, -0.28), table, bevel=0.12)

    # All cards share exactly the same modeled dimensions. Their Z coordinates
    # put each lower face directly beneath the next shell rather than floating.
    slot_geometry = {
        "rear": ((-0.60, 4.95, 0.00), -4.5),
        "middle": ((-0.10, 5.45, 0.18), 2.5),
        "active": ((0.30, 5.95, 0.36), -0.8),
    }
    card_layers = {
        rarity: {
            slot: physical_card(
                f"{rarity.title()} {slot} card",
                location,
                rotation_z,
                rarity_materials[rarity],
                card_shadow,
                rarity,
            )
            for slot, (location, rotation_z) in slot_geometry.items()
        }
        for rarity in RARITIES
    }

    # Match the Dashboard plate: one broad cool source defines the whole table,
    # with a restrained colored fill and warm environment for readable edges.
    add_area_light("Large soft overhead source", (-4.5, 2.0, 10.5), 925.0, (0.68, 0.76, 1.0), 5.5, (0.0, 6.0, 0.5))
    add_area_light("Restrained green fill", (5.0, 8.5, 5.0), 95.0, (0.12, 0.42, 0.23), 4.0, (1.0, 6.0, 0.5))
    add_area_light("Warm tabletop edge source", (-4.5, -5.5, 11.5), 90.0, (1.0, 0.72, 0.40), 5.5, (0.0, 5.8, 0.0))

    camera_data = bpy.data.cameras.new("Quest deck tabletop camera")
    camera = bpy.data.objects.new("Quest deck tabletop camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.0, 0.0, 24.0)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 22.0
    point_at(camera, (0.0, 0.0, 0.0))
    scene.camera = camera

    all_card_objects = [
        obj
        for rarity_layers in card_layers.values()
        for layer in rarity_layers.values()
        for obj in layer["objects"]
    ]
    all_mesh_objects = [obj for obj in scene.objects if obj.type == "MESH"]

    def show_only(objects):
        visible = set(objects)
        for obj in all_mesh_objects:
            obj.hide_render = obj not in visible

    def render_to(path, *, transparent):
        scene.render.filepath = str(path)
        scene.render.film_transparent = transparent
        scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
        bpy.ops.render.render(write_still=True)

    # The authored reference stack deliberately shows three different rarity
    # constructions. Every other runtime variant remains present in the .blend
    # but hidden from the reference render.
    reference_layers = (
        card_layers["hard"]["rear"],
        card_layers["medium"]["middle"],
        card_layers["legendary"]["active"],
    )
    reference_objects = [obj for layer in reference_layers for obj in layer["objects"]]
    show_only([obj for obj in all_mesh_objects if obj not in all_card_objects] + reference_objects)
    render_to(RENDER_PATH, transparent=False)

    # Runtime passes share the exact same camera, geometry, lighting, and pixel
    # coordinates. React composites them without recreating any card geometry.
    show_only([obj for obj in all_mesh_objects if obj not in all_card_objects])
    render_to(BASE_RENDER_PATH, transparent=False)

    for rarity, rarity_layers in card_layers.items():
        for slot, layer in rarity_layers.items():
            show_only(layer["objects"])
            render_to(CARD_RENDER_PATHS[rarity][slot], transparent=True)

    show_only([obj for obj in all_mesh_objects if obj not in all_card_objects] + reference_objects)
    scene.render.filepath = str(RENDER_PATH)
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGB"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"Saved blend: {BLEND_PATH}")
    print(f"Saved composite: {RENDER_PATH}")
    print(f"Saved base: {BASE_RENDER_PATH}")
    print(f"Saved card passes: {CARD_RENDER_PATHS}")


if __name__ == "__main__":
    build_scene()
