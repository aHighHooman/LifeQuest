import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "src" / "assets" / "quests"
RENDER_PATH = OUTPUT_DIR / "quest-deck-tabletop-blender.webp"
BLEND_PATH = OUTPUT_DIR / "quest-deck-tabletop.blend"
BASE_RENDER_PATH = OUTPUT_DIR / "quest-tabletop-base-blender.webp"
LOG_PILE_RENDER_PATHS = {
    kind: {
        count: OUTPUT_DIR / f"quest-log-{kind}-{count}-blender.webp"
        for count in range(0, 7)
    }
    for kind in ("victory", "discard")
}
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


def material(name, color, *, metallic=0.0, roughness=0.5, alpha=1.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Alpha"].default_value = alpha
    emission_color = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
    emission_power = shader.inputs.get("Emission Strength")
    if emission and emission_color:
        emission_color.default_value = (*emission, 1.0)
    if emission_power:
        emission_power.default_value = emission_strength
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

    def detail_curve(part, points, mat=accent, thickness=0.022, height_z=0.176, cyclic=False, flowing=True):
        """Raised local-space linework for engraved/embossed card ornament."""
        curve_data = bpy.data.curves.new(f"{name} {part} curve", type="CURVE")
        curve_data.dimensions = "3D"
        curve_data.resolution_u = 12
        curve_data.bevel_depth = thickness
        curve_data.bevel_resolution = 4
        curve_data.resolution_u = 16
        spline_type = "BEZIER" if flowing else "POLY"
        spline = curve_data.splines.new(spline_type)
        if flowing:
            spline.bezier_points.add(len(points) - 1)
            for point, (px, py) in zip(spline.bezier_points, points):
                point.co = (px, py, 0.0)
                point.handle_left_type = "AUTO"
                point.handle_right_type = "AUTO"
        else:
            spline.points.add(len(points) - 1)
            for point, (px, py) in zip(spline.points, points):
                point.co = (px, py, 0.0, 1.0)
        spline.use_cyclic_u = cyclic
        curve = bpy.data.objects.new(f"{name} {rarity} {part}", curve_data)
        bpy.context.collection.objects.link(curve)
        curve.location = (x, y, z + height_z)
        curve.rotation_euler = rotation
        curve.data.materials.append(mat)
        objects.append(curve)

    def mirrored(points, mirror_x=False, mirror_y=False):
        return [
            (-px if mirror_x else px, -py if mirror_y else py)
            for px, py in points
        ]

    def detail_gem(part, dx, dy, size=0.11, mat=highlight, height_z=0.050):
        """A solid raised diamond used as a jewel/leaf punctuation mark."""
        offset_x, offset_y = rotated_offset(dx, dy, angle)
        objects.append(add_box(
            f"{name} {rarity} {part}",
            (size, size, height_z),
            (x + offset_x, y + offset_y, z + 0.180),
            mat,
            bevel=size * 0.13,
            rotation=(0.0, 0.0, angle + math.radians(45.0)),
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
        # A true layered black-and-gold artifact: the second rail, stepped
        # corners, and raised filigree catch real scene light like embossing.
        for part, dx, dy, width, height in (
            ("inner frame top", 0.0, 2.43, 6.78, 0.040),
            ("inner frame bottom", 0.0, -2.43, 6.78, 0.040),
            ("inner frame left", -3.56, 0.0, 0.040, 4.64),
            ("inner frame right", 3.56, 0.0, 0.040, 4.64),
        ):
            detail_box(part, dx, dy, width, height, accent, 0.030)

        # Architectural stepped shoulders echo the reference's hand-built
        # double border without encroaching on the quest title.
        top_step = [
            (-3.30, 2.48), (-1.40, 2.48), (-1.24, 2.34), (-0.82, 2.34)
        ]
        bottom_step = [
            (-3.30, -2.48), (-1.40, -2.48), (-1.24, -2.34), (-0.82, -2.34)
        ]
        for side, mirror_x in (("left", False), ("right", True)):
            detail_curve(
                f"bright stepped top {side}",
                mirrored(top_step, mirror_x=mirror_x),
                highlight,
                thickness=0.026,
                flowing=False,
            )
            detail_curve(
                f"bright stepped bottom {side}",
                mirrored(bottom_step, mirror_x=mirror_x),
                highlight,
                thickness=0.026,
                flowing=False,
            )

        # Each corner is generated from the same master flourish, guaranteeing
        # exact vertical and horizontal symmetry.
        corner_paths = (
            # The primary stem follows the frame, then turns inward. Shorter
            # secondary curls resolve back into it instead of ending randomly.
            [(-3.47, 1.48), (-3.49, 1.82), (-3.42, 2.12), (-3.22, 2.34), (-2.86, 2.39)],
            [(-3.41, 2.09), (-3.20, 1.93), (-3.02, 2.00), (-3.09, 2.17)],
            [(-3.28, 2.29), (-3.08, 2.12), (-2.87, 2.17)],
            [(-3.47, 1.88), (-3.25, 1.72), (-3.21, 1.52)],
            [(-3.10, 2.36), (-2.93, 2.24), (-2.72, 2.26), (-2.65, 2.38)],
            [(-3.42, 1.72), (-3.29, 1.57), (-3.35, 1.42)],
        )
        for vertical, mirror_y in (("upper", False), ("lower", True)):
            for horizontal, mirror_x in (("left", False), ("right", True)):
                for path_index, path in enumerate(corner_paths):
                    detail_curve(
                        f"{vertical} {horizontal} filigree {path_index}",
                        mirrored(path, mirror_x=mirror_x, mirror_y=mirror_y),
                        highlight if path_index in (0, 1) else accent,
                        thickness=0.025 if path_index == 0 else 0.019,
                    )
                corner_sign_x = -1 if not mirror_x else 1
                corner_sign_y = 1 if not mirror_y else -1
                for leaf_index, (leaf_x, leaf_y, leaf_size) in enumerate((
                    (3.23, 2.19, 0.075),
                    (3.05, 2.31, 0.065),
                    (3.36, 1.79, 0.062),
                )):
                    detail_gem(
                        f"{vertical} {horizontal} raised leaf {leaf_index}",
                        corner_sign_x * leaf_x,
                        corner_sign_y * leaf_y,
                        size=leaf_size,
                        mat=highlight if leaf_index == 0 else accent,
                        height_z=0.042,
                    )

        # A centered tiara with a sharp gemstone silhouette and mirrored wings.
        top_diamond = [(0.0, 2.65), (0.15, 2.42), (0.0, 2.17), (-0.15, 2.42)]
        detail_curve(
            "top crown diamond",
            top_diamond,
            highlight,
            thickness=0.027,
            cyclic=True,
            flowing=False,
        )
        detail_gem("top crown center jewel", 0.0, 2.40, size=0.115)
        crown_wing = [
            (-0.02, 2.20), (-0.16, 2.36), (-0.22, 2.56),
            (-0.34, 2.37), (-0.52, 2.43),
        ]
        crown_curl = [
            (-0.16, 2.23), (-0.38, 2.09), (-0.61, 2.12), (-0.70, 2.29)
        ]
        crown_lower_scroll = [
            (-0.20, 2.18), (-0.43, 2.03), (-0.69, 2.06), (-0.92, 2.20)
        ]
        for side, mirror_x in (("left", False), ("right", True)):
            detail_curve(
                f"top crown {side} wing",
                mirrored(crown_wing, mirror_x=mirror_x),
                highlight,
                thickness=0.024,
            )
            detail_curve(
                f"top crown {side} curl",
                mirrored(crown_curl, mirror_x=mirror_x),
                accent,
                thickness=0.018,
            )
            detail_curve(
                f"top crown {side} lower scroll",
                mirrored(crown_lower_scroll, mirror_x=mirror_x),
                highlight,
                thickness=0.020,
            )
            leaf_x = -0.34 if not mirror_x else 0.34
            outer_leaf_x = -0.53 if not mirror_x else 0.53
            detail_gem(f"top crown {side} inner leaf", leaf_x, 2.27, size=0.080)
            detail_gem(f"top crown {side} outer leaf", outer_leaf_x, 2.19, size=0.065, mat=accent)

        # The lower crest repeats the crown language at a quieter scale.
        bottom_diamond = [(0.0, -2.61), (0.13, -2.40), (0.0, -2.19), (-0.13, -2.40)]
        detail_curve(
            "lower crest diamond",
            bottom_diamond,
            highlight,
            thickness=0.025,
            cyclic=True,
            flowing=False,
        )
        detail_gem("lower crest center jewel", 0.0, -2.40, size=0.095)
        lower_wing = [
            (-0.03, -2.23), (-0.22, -2.38), (-0.46, -2.29),
            (-0.67, -2.34), (-0.78, -2.46),
        ]
        for side, mirror_x in (("left", False), ("right", True)):
            detail_curve(
                f"lower crest {side} wing",
                mirrored(lower_wing, mirror_x=mirror_x),
                accent,
                thickness=0.019,
            )
            leaf_x = -0.33 if not mirror_x else 0.33
            detail_gem(f"lower crest {side} leaf", leaf_x, -2.31, size=0.060, mat=accent)

        # Refined side clasps make the frame feel continuous. Tiny stitch marks
        # sit beside them like hand-tooled registration detail.
        side_clasp = [
            (-3.55, -0.52), (-3.47, -0.32), (-3.53, -0.12),
            (-3.40, 0.0), (-3.53, 0.12), (-3.47, 0.32), (-3.55, 0.52),
        ]
        side_inner_curl = [
            (-3.47, -0.20), (-3.30, -0.10), (-3.30, 0.10), (-3.47, 0.20)
        ]
        for side, mirror_x in (("left", False), ("right", True)):
            detail_curve(
                f"{side} sculpted clasp",
                mirrored(side_clasp, mirror_x=mirror_x),
                highlight,
                thickness=0.020,
            )
            detail_curve(
                f"{side} clasp inner curl",
                mirrored(side_inner_curl, mirror_x=mirror_x),
                accent,
                thickness=0.017,
            )
            detail_gem(
                f"{side} clasp jewel",
                -3.42 if not mirror_x else 3.42,
                0.0,
                size=0.070,
                mat=highlight,
            )

        for side, dx in (("left", -3.39), ("right", 3.39)):
            for stitch_index, dy in enumerate((-0.72, -0.62, -0.52, 0.52, 0.62, 0.72)):
                detail_box(
                    f"{side} gold stitch {stitch_index}",
                    dx,
                    dy,
                    0.045,
                    0.018,
                    accent,
                    0.025,
                )
    else:
        # Common stays intentionally utilitarian, but its inset field rails
        # make it read as a manufactured card rather than an empty slab.
        detail_box("field top index", 0.0, 2.36, 1.25, 0.045, highlight)
        detail_box("field lower index", 0.0, -2.36, 0.72, 0.04, accent)

    shadow_x, shadow_y = rotated_offset(0.035, -0.045, angle)
    shadow_card = add_box(
        f"{name} contact shadow",
        (8.02, 5.72, 0.012),
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


def add_table_text(name, body, location, mat, *, size=0.42, spacing=1.12):
    curve = bpy.data.curves.new(type="FONT", name=f"{name} lettering")
    curve.body = body
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.space_character = spacing
    curve.extrude = 0.012
    curve.bevel_depth = 0.006
    curve.bevel_resolution = 3
    font_path = Path("C:/Windows/Fonts/bahnschrift.ttf")
    if font_path.exists():
        curve.font = bpy.data.fonts.load(str(font_path))
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.data.materials.append(mat)
    return obj


def add_token(
    name,
    location,
    angle_degrees,
    base_mat,
    face_mat,
    rim_mat,
    symbol_mat,
    shadow_mat,
    ground_shadow_mat,
    symbol,
    *,
    tilt_x=0.0,
    tilt_y=0.0,
):
    x, y, stack_height = location
    table_top = -0.105
    base_depth = 0.40
    objects = []
    bpy.ops.object.empty_add(
        type="PLAIN_AXES",
        location=(x, y, table_top + base_depth / 2 + stack_height),
        rotation=(math.radians(tilt_x), math.radians(tilt_y), math.radians(angle_degrees)),
    )
    token_root = bpy.context.object
    token_root.name = f"{name} flat seated token root"

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=96,
        radius=0.40,
        depth=base_depth,
        location=(0.0, 0.0, 0.0),
    )
    base = bpy.context.object
    base.name = f"{name} thick dark-grey minted body"
    base.parent = token_root
    base.data.materials.append(base_mat)
    bevel = base.modifiers.new(name="Rounded minted edge", type="BEVEL")
    bevel.width = 0.045
    bevel.segments = 5
    for polygon in base.data.polygons:
        polygon.use_smooth = abs(polygon.normal.z) < 0.5
    objects.append(base)

    token_top = base_depth / 2
    lip_segments = 96
    lip_inner_radius = 0.342
    lip_outer_radius = 0.392
    lip_bottom = token_top + 0.004
    lip_top = token_top + 0.064
    lip_vertices = []
    for z in (lip_bottom, lip_top):
        for radius in (lip_outer_radius, lip_inner_radius):
            lip_vertices.extend(
                (
                    math.cos((index / lip_segments) * math.tau) * radius,
                    math.sin((index / lip_segments) * math.tau) * radius,
                    z,
                )
                for index in range(lip_segments)
            )
    outer_bottom = 0
    inner_bottom = lip_segments
    outer_top = lip_segments * 2
    inner_top = lip_segments * 3
    lip_faces = []
    for index in range(lip_segments):
        next_index = (index + 1) % lip_segments
        lip_faces.extend((
            (
                outer_bottom + index,
                outer_bottom + next_index,
                outer_top + next_index,
                outer_top + index,
            ),
            (
                inner_bottom + next_index,
                inner_bottom + index,
                inner_top + index,
                inner_top + next_index,
            ),
            (
                outer_top + index,
                outer_top + next_index,
                inner_top + next_index,
                inner_top + index,
            ),
            (
                outer_bottom + next_index,
                outer_bottom + index,
                inner_bottom + index,
                inner_bottom + next_index,
            ),
        ))
    lip_mesh = bpy.data.meshes.new(f"{name} raised stamped rim mesh")
    lip_mesh.from_pydata(lip_vertices, [], lip_faces)
    lip_mesh.update()
    lip = bpy.data.objects.new(f"{name} raised stamped outer rim", lip_mesh)
    bpy.context.collection.objects.link(lip)
    lip.parent = token_root
    lip.data.materials.append(rim_mat)
    lip_bevel = lip.modifiers.new(name="Stamped rim softened edge", type="BEVEL")
    lip_bevel.width = 0.010
    lip_bevel.segments = 3
    objects.append(lip)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.382,
        minor_radius=0.014,
        major_segments=96,
        minor_segments=12,
        location=(0.0, 0.0, -token_top + 0.025),
    )
    lower_ridge = bpy.context.object
    lower_ridge.name = f"{name} lower side edge ridge"
    lower_ridge.parent = token_root
    lower_ridge.data.materials.append(rim_mat)
    objects.append(lower_ridge)

    face_offset_y = 0.070
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=96,
        radius=0.330,
        depth=0.012,
        location=(0.0, face_offset_y, token_top - 0.006),
    )
    face = bpy.context.object
    face.name = f"{name} graphite inset face"
    face.parent = token_root
    face.data.materials.append(face_mat)
    face_bevel = face.modifiers.new(name="Inset face bevel", type="BEVEL")
    face_bevel.width = 0.012
    face_bevel.segments = 4
    objects.append(face)

    def symbol_stroke(part, points, width=0.022):
        curve_data = bpy.data.curves.new(f"{name} {part} curve", type="CURVE")
        curve_data.dimensions = "3D"
        curve_data.resolution_u = 2
        curve_data.bevel_depth = width
        curve_data.bevel_resolution = 4
        spline = curve_data.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for point, (px, py) in zip(spline.points, points):
            point.co = (px, py, token_top + 0.052, 1.0)
        symbol_piece = bpy.data.objects.new(f"{name} luminous {part}", curve_data)
        bpy.context.collection.objects.link(symbol_piece)
        symbol_piece.parent = token_root
        symbol_piece.data.materials.append(symbol_mat)
        objects.append(symbol_piece)

    if symbol == "check":
        circle_points = [
            (
                math.cos(math.radians(angle)) * 0.215,
                math.sin(math.radians(angle)) * 0.215,
            )
            for angle in range(48, 371, 9)
        ]
        symbol_stroke("broken completion circle", circle_points, 0.023)
        symbol_stroke(
            "completion check",
            [(-0.125, -0.005), (-0.030, -0.090), (0.165, 0.115)],
            0.027,
        )
    else:
        symbol_stroke(
            "trash can body",
            [(-0.135, 0.055), (-0.120, -0.165), (0.120, -0.165), (0.135, 0.055)],
            0.023,
        )
        symbol_stroke("trash can lid", [(-0.185, 0.075), (0.185, 0.075)], 0.025)
        symbol_stroke(
            "trash can handle",
            [(-0.070, 0.080), (-0.055, 0.155), (0.055, 0.155), (0.070, 0.080)],
            0.023,
        )
        symbol_stroke("trash can left slot", [(-0.052, 0.005), (-0.052, -0.105)], 0.017)
        symbol_stroke("trash can right slot", [(0.052, 0.005), (0.052, -0.105)], 0.017)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64,
        radius=0.43,
        depth=0.008,
        location=(x + 0.035, y - 0.050, table_top + 0.006),
    )
    ground_shadow = bpy.context.object
    ground_shadow.name = f"{name} soft tabletop cast shadow"
    ground_shadow.scale.x = 0.96
    ground_shadow.scale.y = 0.78
    ground_shadow.data.materials.append(ground_shadow_mat)
    objects.insert(0, ground_shadow)

    is_stacked = stack_height > 0.0
    if is_stacked:
        shadow_z = table_top + base_depth + 0.030 + max(0.0, stack_height - 0.28)
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=64,
            radius=0.41,
            depth=0.008,
            location=(x, y - 0.012, shadow_z),
        )
        overlap_shadow = bpy.context.object
        overlap_shadow.name = f"{name} tight inter-token contact shadow"
        overlap_shadow.scale.x = 0.92
        overlap_shadow.scale.y = 0.82
        overlap_shadow.data.materials.append(shadow_mat)
        objects.insert(0, overlap_shadow)
    return objects


def build_log_markers():
    victory_text = material("Victory table inlay", (0.020, 0.25, 0.18), metallic=0.28, roughness=0.48)
    discard_text = material("Discard table inlay", (0.31, 0.035, 0.050), metallic=0.25, roughness=0.50)
    labels = [
        add_table_text("Engraved victory log label", "VICTORY LOG", (-3.48, 0.65, -0.096), victory_text),
        add_table_text("Engraved discarded label", "DISCARDED", (3.48, 0.65, -0.096), discard_text),
    ]

    graphite_side = material("Token charcoal edge", (0.080, 0.095, 0.110), metallic=0.62, roughness=0.34)
    graphite_face = material("Token dark graphite face", (0.040, 0.050, 0.062), metallic=0.42, roughness=0.42)
    graphite_rim = material("Token machined graphite line rim", (0.13, 0.15, 0.17), metallic=0.58, roughness=0.32)
    victory_graphite_side = material(
        "Victory token charcoal edge", (0.035, 0.045, 0.055), metallic=0.24, roughness=0.56
    )
    victory_graphite_face = material(
        "Victory token dark graphite face", (0.018, 0.025, 0.032), metallic=0.12, roughness=0.64
    )
    victory_graphite_rim = material(
        "Victory token machined graphite line rim", (0.065, 0.080, 0.095), metallic=0.28, roughness=0.50
    )
    victory_line = material(
        "Victory luminous green line art",
        (0.020, 0.30, 0.22),
        metallic=0.42,
        roughness=0.20,
        emission=(0.020, 0.56, 0.39),
        emission_strength=1.0,
    )
    discard_line = material(
        "Discard luminous red line art",
        (0.34, 0.025, 0.045),
        metallic=0.42,
        roughness=0.20,
        emission=(0.68, 0.035, 0.070),
        emission_strength=1.8,
    )
    token_shadow = material("Token contact shadow", (0.0, 0.0, 0.0), roughness=1.0, alpha=0.24)
    token_ground_shadow = material(
        "Token soft tabletop cast shadow", (0.0, 0.0, 0.0), roughness=1.0, alpha=0.10
    )

    victory_groups = []
    discard_groups = []
    for index in range(6):
        stack_height = index * 0.28
        victory_groups.append(add_token(
            f"Victory neat stack token {index + 1}",
            (-4.10 + index * 0.48, 0.03, stack_height),
            -4.0,
            victory_graphite_side,
            victory_graphite_face,
            victory_graphite_rim,
            victory_line,
            token_shadow,
            token_ground_shadow,
            "check",
            tilt_y=0.0 if index == 0 else 5.0,
        ))
        discard_groups.append(add_token(
            f"Discard neat stack token {index + 1}",
            (4.10 - index * 0.48, 0.03, stack_height),
            4.0,
            graphite_side,
            graphite_face,
            graphite_rim,
            discard_line,
            token_shadow,
            token_ground_shadow,
            "discard",
            tilt_y=0.0 if index == 0 else -5.0,
        ))
    return labels, victory_groups, discard_groups


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
    card_shadow = material("Card layer contact shadow", (0.0, 0.0, 0.0), roughness=1.0, alpha=0.10)
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
            "shell": material("Legendary blackened shell", (0.007, 0.006, 0.004), metallic=0.30, roughness=0.52),
            "face": material("Legendary matte obsidian face", (0.009, 0.008, 0.005), metallic=0.08, roughness=0.70),
            "edge": material("Legendary dark bronze edge", (0.003, 0.0025, 0.0015), metallic=0.42, roughness=0.42),
            "accent": material("Legendary aged gold inlay", (0.34, 0.20, 0.030), metallic=0.80, roughness=0.26),
            "highlight": material("Legendary bright gold emboss", (0.68, 0.43, 0.075), metallic=0.91, roughness=0.18),
        },
    }

    add_box("Workbench", (30.0, 30.0, 0.35), (0.0, 0.0, -0.28), table, bevel=0.12)
    log_label_objects, victory_token_groups, discard_token_groups = build_log_markers()

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
    all_log_token_objects = [
        obj
        for groups in (victory_token_groups, discard_token_groups)
        for group in groups
        for obj in group
    ]
    all_log_label_objects = list(log_label_objects)
    all_renderable_objects = [obj for obj in scene.objects if obj.type in {"MESH", "FONT", "CURVE"}]
    tabletop_objects = [
        obj
        for obj in all_renderable_objects
        if (
            obj not in all_card_objects
            and obj not in all_log_token_objects
            and obj not in all_log_label_objects
        )
    ]

    def show_only(objects):
        visible = set(objects)
        for obj in all_renderable_objects:
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
    reference_tokens = [
        obj
        for groups in (victory_token_groups[:4], discard_token_groups[:4])
        for group in groups
        for obj in group
    ]
    show_only(tabletop_objects + all_log_label_objects + reference_objects + reference_tokens)
    render_to(RENDER_PATH, transparent=False)

    # Keep the table itself viewport-sized. Log labels and tokens are rendered
    # separately so React can anchor them below the responsive card stage.
    show_only(tabletop_objects)
    render_to(BASE_RENDER_PATH, transparent=False)

    full_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    full_camera_location = camera.location.copy()
    full_ortho_scale = camera_data.ortho_scale
    scene.render.resolution_x = 450
    scene.render.resolution_y = 240
    camera_data.ortho_scale = 4.20
    for kind, groups, label, center_x in (
        ("victory", victory_token_groups, log_label_objects[0], -3.25),
        ("discard", discard_token_groups, log_label_objects[1], 3.25),
    ):
        camera.location = (center_x, 0.28, 24.0)
        point_at(camera, (center_x, 0.28, 0.0))
        for count in range(0, 7):
            pile_objects = [obj for group in groups[:count] for obj in group]
            show_only([label] + pile_objects)
            render_to(LOG_PILE_RENDER_PATHS[kind][count], transparent=True)

    scene.render.resolution_x, scene.render.resolution_y = full_resolution
    camera.location = full_camera_location
    camera_data.ortho_scale = full_ortho_scale
    point_at(camera, (0.0, 0.0, 0.0))

    for rarity, rarity_layers in card_layers.items():
        for slot, layer in rarity_layers.items():
            show_only(layer["objects"])
            render_to(CARD_RENDER_PATHS[rarity][slot], transparent=True)

    show_only(tabletop_objects + all_log_label_objects + reference_objects + reference_tokens)
    scene.render.filepath = str(RENDER_PATH)
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGB"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"Saved blend: {BLEND_PATH}")
    print(f"Saved composite: {RENDER_PATH}")
    print(f"Saved base: {BASE_RENDER_PATH}")
    print(f"Saved log piles: {LOG_PILE_RENDER_PATHS}")
    print(f"Saved card passes: {CARD_RENDER_PATHS}")


if __name__ == "__main__":
    build_scene()
