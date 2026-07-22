import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "src" / "assets" / "dashboard"
RENDER_PATH = OUTPUT_DIR / "health-injector-tabletop-blender.webp"
BLEND_PATH = OUTPUT_DIR / "health-injector-tabletop.blend"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def principled_material(
    name,
    base_color,
    *,
    metallic=0.0,
    roughness=0.45,
    emission_color=None,
    emission_strength=0.0,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*base_color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission_color is not None:
        emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        strength_input = shader.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = (*emission_color, 1.0)
        if strength_input:
            strength_input.default_value = emission_strength
    return material


def tabletop_material():
    material = principled_material(
        "Matte charcoal workbench",
        (0.018, 0.028, 0.052),
        metallic=0.05,
        roughness=0.78,
    )
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get("Principled BSDF")

    # Recreate the app's original upper-center slate glow as part of the table shader.
    coordinates = nodes.new("ShaderNodeTexCoord")
    subtract = nodes.new("ShaderNodeVectorMath")
    subtract.operation = "SUBTRACT"
    subtract.inputs[1].default_value = (0.5, 0.84, 0.5)
    squash = nodes.new("ShaderNodeVectorMath")
    squash.operation = "MULTIPLY"
    squash.inputs[1].default_value = (1.0, 0.52, 0.0)
    distance = nodes.new("ShaderNodeVectorMath")
    distance.operation = "LENGTH"
    gradient = nodes.new("ShaderNodeValToRGB")
    gradient.color_ramp.elements.remove(gradient.color_ramp.elements[1])
    bright = gradient.color_ramp.elements[0]
    bright.position = 0.0
    bright.color = (0.026, 0.048, 0.095, 1.0)
    middle = gradient.color_ramp.elements.new(0.34)
    middle.color = (0.007, 0.018, 0.046, 1.0)
    dark = gradient.color_ramp.elements.new(0.76)
    dark.color = (0.001, 0.003, 0.010, 1.0)
    links.new(coordinates.outputs["Generated"], subtract.inputs[0])
    links.new(subtract.outputs["Vector"], squash.inputs[0])
    links.new(squash.outputs["Vector"], distance.inputs[0])
    links.new(distance.outputs["Value"], gradient.inputs["Fac"])
    links.new(gradient.outputs["Color"], shader.inputs["Base Color"])

    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 11.0
    noise.inputs["Detail"].default_value = 5.0
    noise.inputs["Roughness"].default_value = 0.7
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.09
    bump.inputs["Distance"].default_value = 0.055
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return material


def assign_material(obj, material):
    obj.data.materials.append(material)


def bevel(obj, width=0.08, segments=4):
    modifier = obj.modifiers.new(name="Soft manufactured edges", type="BEVEL")
    modifier.width = width
    modifier.segments = segments


def smooth(obj):
    if hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def cylinder(name, radius, depth, location, material, parent, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=(0.0, math.radians(90), 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    bevel(obj, min(radius * 0.1, 0.06), 3)
    smooth(obj)
    obj.parent = parent
    return obj


def rounded_box(name, dimensions, location, material, parent=None, bevel_width=0.08, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation or (0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, bevel_width, 5)
    assign_material(obj, material)
    if parent:
        obj.parent = parent
    return obj


def chamfered_prism(name, width, height, depth, chamfer, location, material, parent=None):
    half_w = width / 2.0
    half_h = height / 2.0
    half_d = depth / 2.0
    outline = [
        (-half_w + chamfer, -half_h),
        (half_w - chamfer, -half_h),
        (half_w, -half_h + chamfer),
        (half_w, half_h - chamfer),
        (half_w - chamfer, half_h),
        (-half_w + chamfer, half_h),
        (-half_w, half_h - chamfer),
        (-half_w, -half_h + chamfer),
    ]
    vertices = [(x, y, -half_d) for x, y in outline] + [(x, y, half_d) for x, y in outline]
    faces = [tuple(range(7, -1, -1)), tuple(range(8, 16))]
    for index in range(8):
        next_index = (index + 1) % 8
        faces.append((index, next_index, next_index + 8, index + 8))
    mesh = bpy.data.meshes.new(f"{name} mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    assign_material(obj, material)
    bevel(obj, min(depth * 0.2, 0.025), 2)
    if parent:
        obj.parent = parent
    return obj


def torus(name, major_radius, minor_radius, location, material, parent):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=12,
        location=location,
        rotation=(0.0, math.radians(90), 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    smooth(obj)
    obj.parent = parent
    return obj


def top_disc(name, radius, depth, location, material, parent, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    bevel(obj, min(radius * 0.18, 0.018), 2)
    # Keep the broad faces optically flat. Smoothing the cylinder caps makes thin
    # coins shade like bubbles even though their geometry is planar.
    for polygon in obj.data.polygons:
        polygon.use_smooth = abs(polygon.normal.z) < 0.5
    obj.parent = parent
    return obj


def realistic_gold_material(name, base_color, roughness, bump_strength, metallic=0.90):
    """Gold with microscopic roughness variation instead of emission or painted color."""
    material = principled_material(name, base_color, metallic=metallic, roughness=roughness)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get("Principled BSDF")
    specular = shader.inputs.get("Specular IOR Level") or shader.inputs.get("Specular")
    if specular:
        specular.default_value = 0.25

    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 165.0
    grain.inputs["Detail"].default_value = 3.0
    grain.inputs["Roughness"].default_value = 0.72

    roughness_map = nodes.new("ShaderNodeValToRGB")
    roughness_map.color_ramp.elements[0].color = (roughness * 0.62,) * 3 + (1.0,)
    roughness_map.color_ramp.elements[1].color = (min(roughness * 1.45, 0.58),) * 3 + (1.0,)
    links.new(grain.outputs["Fac"], roughness_map.inputs["Fac"])
    links.new(roughness_map.outputs["Color"], shader.inputs["Roughness"])

    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.004
    links.new(grain.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return material


def sculpted_coin(
    name,
    location,
    rotation,
    gold_material,
    side_material,
    relief_material,
    *,
    radius=0.37,
    depth=0.14,
    clean_face=False,
    reeded_edge=False,
):
    """Build a thick, decorated coin with modeled rather than painted relief."""
    radius *= 1.20
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=location, rotation=rotation)
    coin = bpy.context.object
    coin.name = name

    top_disc(f"{name} thick minted blank", radius, depth, (0.0, 0.0, 0.0), side_material, coin, 128)

    if reeded_edge:
        for reed_index in range(36):
            angle = math.tau * reed_index / 36.0
            rounded_box(
                f"{name} edge reed {reed_index}",
                (radius * 0.025, radius * 0.072, depth * 0.72),
                (math.cos(angle) * radius * 0.985, math.sin(angle) * radius * 0.985, 0.0),
                relief_material,
                coin,
                bevel_width=0.002,
                rotation=(0.0, 0.0, angle),
            )
    face_z = depth * 0.57
    top_disc(
        f"{name} raised face",
        radius * 0.94,
        depth * 0.20,
        (0.0, 0.0, face_z),
        gold_material,
        coin,
        128,
    )

    # Concentric coined rims establish the same fine hard-surface hierarchy as
    # the injector while staying visibly part of one piece of metal.
    for ring_index, ring_radius in enumerate((0.84, 0.63)):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=radius * ring_radius,
            minor_radius=radius * (0.020 if ring_index == 0 else 0.013),
            major_segments=128,
            minor_segments=12,
            location=(0.0, 0.0, face_z + depth * 0.13),
        )
        rim = bpy.context.object
        rim.name = f"{name} minted ring {ring_index}"
        assign_material(rim, relief_material)
        smooth(rim)
        rim.parent = coin

    # A beaded perimeter gives the face the dense, irregular highlight pattern
    # seen in old struck currency.
    for bead_index in range(28):
        angle = math.tau * bead_index / 28.0
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=12,
            ring_count=6,
            radius=radius * 0.022,
            location=(math.cos(angle) * radius * 0.745, math.sin(angle) * radius * 0.745, face_z + depth * 0.17),
        )
        bead = bpy.context.object
        bead.name = f"{name} rim bead {bead_index}"
        bead.scale.z = 0.52
        assign_material(bead, relief_material)
        smooth(bead)
        bead.parent = coin

    if not clean_face:
        chamfered_prism(
            f"{name} heraldic shield",
            radius * 0.42,
            radius * 0.50,
            depth * 0.16,
            radius * 0.07,
            (0.0, -radius * 0.025, face_z + depth * 0.19),
            relief_material,
            coin,
        )
        for stripe_y in (-0.10, 0.04, 0.18):
            rounded_box(
                f"{name} shield engraving {stripe_y}",
                (radius * 0.28, radius * 0.025, depth * 0.06),
                (0.0, radius * stripe_y, face_z + depth * 0.29),
                side_material,
                coin,
                bevel_width=0.003,
            )

        # Paired laurel leaves create dense embossed detail without relying on a
        # flat texture or a glowing outline.
        for side in (-1.0, 1.0):
            for leaf_index in range(4):
                leaf_y = radius * (-0.27 + leaf_index * 0.18)
                leaf_x = side * radius * (0.34 + abs(leaf_y / radius) * 0.10)
                bpy.ops.mesh.primitive_uv_sphere_add(
                    segments=16,
                    ring_count=8,
                    radius=radius * 0.072,
                    location=(leaf_x, leaf_y, face_z + depth * 0.20),
                    rotation=(0.0, 0.0, side * math.radians(28.0 - leaf_index * 8.0)),
                )
                leaf = bpy.context.object
                leaf.name = f"{name} laurel leaf {side} {leaf_index}"
                leaf.scale = (0.52, 1.18, 0.26)
                assign_material(leaf, relief_material)
                smooth(leaf)
                leaf.parent = coin

    return coin


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
    return obj


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_scene():
    reset_scene()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    # A tall top-down plate becomes the dashboard's entire ground plane.
    scene.render.resolution_x = 900
    scene.render.resolution_y = 2000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.quality = 90
    scene.render.filepath = str(RENDER_PATH)
    scene.render.film_transparent = False
    scene.render.resolution_percentage = 100

    scene.world.color = (0.004, 0.007, 0.015)
    world = scene.world
    world.use_nodes = True
    world_bg = world.node_tree.nodes.get("Background")
    # A very dim warm environment keeps steep metallic faces from reflecting
    # featureless black while leaving the table's authored navy gradient intact.
    world_bg.inputs["Color"].default_value = (0.022, 0.014, 0.006, 1.0)
    world_bg.inputs["Strength"].default_value = 0.28

    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    metal = principled_material("Navy gunmetal", (0.018, 0.028, 0.065), metallic=0.82, roughness=0.28)
    armor = principled_material("Slate armor plating", (0.035, 0.060, 0.125), metallic=0.75, roughness=0.24)
    edge_metal = principled_material("Machined edge highlights", (0.075, 0.105, 0.18), metallic=0.88, roughness=0.2)
    dark_metal = principled_material("Dark edge metal", (0.006, 0.009, 0.022), metallic=0.72, roughness=0.34)
    rubber = principled_material("Grip rubber", (0.008, 0.012, 0.025), metallic=0.0, roughness=0.68)
    screen = principled_material("Blank display glass", (0.002, 0.003, 0.007), metallic=0.12, roughness=0.18)
    magenta = principled_material(
        "Royal purple anodized accent",
        (0.165, 0.040, 0.335),
        metallic=0.52,
        roughness=0.29,
        emission_color=(0.20, 0.050, 0.38),
        emission_strength=0.05,
    )
    cyan = principled_material(
        "Cyan status light",
        (0.0, 0.12, 0.2),
        metallic=0.0,
        roughness=0.2,
        emission_color=(0.0, 0.65, 1.0),
        emission_strength=3.0,
    )
    reservoir = principled_material(
        "Crimson reservoir",
        (0.28, 0.004, 0.025),
        metallic=0.05,
        roughness=0.2,
        emission_color=(1.0, 0.006, 0.035),
        emission_strength=1.6,
    )
    reservoir_glass = principled_material(
        "Tinted reservoir glass",
        (0.12, 0.003, 0.016),
        metallic=0.0,
        roughness=0.12,
    )
    glass_shader = reservoir_glass.node_tree.nodes.get("Principled BSDF")
    transmission = glass_shader.inputs.get("Transmission Weight") or glass_shader.inputs.get("Transmission")
    if transmission:
        transmission.default_value = 0.72
    if glass_shader.inputs.get("IOR"):
        glass_shader.inputs["IOR"].default_value = 1.46
    coat = glass_shader.inputs.get("Coat Weight") or glass_shader.inputs.get("Clearcoat")
    if coat:
        coat.default_value = 0.35
    gold = realistic_gold_material("Unified reflective gold", (0.56, 0.225, 0.018), 0.24, 0.08, 0.88)
    gold_side = realistic_gold_material("Unified reflective gold edge", (0.24, 0.075, 0.004), 0.31, 0.09, 0.80)
    gold_relief = realistic_gold_material("Unified reflective gold relief", (0.48, 0.175, 0.010), 0.19, 0.06, 0.95)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0.25, 6.85, 0.0))
    rig = bpy.context.object
    rig.name = "Injector angled on table"
    rig.rotation_euler.z = math.radians(-30.0)

    cylinder("Main injector body", 0.69, 3.75, (0.75, 0.0, 0.74), metal, rig)
    cylinder("Rear grip", 0.75, 1.15, (3.15, 0.0, 0.76), rubber, rig)
    cylinder("Rear collar", 0.79, 0.28, (2.45, 0.0, 0.76), dark_metal, rig)
    cylinder("Reservoir left collar", 0.57, 0.24, (-2.68, 0.0, 0.62), dark_metal, rig)
    cylinder("Reservoir right collar", 0.57, 0.24, (-1.22, 0.0, 0.62), dark_metal, rig)
    cylinder("Glowing crimson cartridge core", 0.31, 1.28, (-1.95, 0.0, 0.62), reservoir, rig)
    cylinder("Tinted cartridge shell", 0.48, 1.36, (-1.95, 0.0, 0.62), reservoir_glass, rig)
    rounded_box("Reservoir upper rail", (1.42, 0.13, 0.09), (-1.95, 0.0, 1.11), dark_metal, rig, 0.035)
    rounded_box("Reservoir lower rail", (1.42, 0.13, 0.09), (-1.95, 0.0, 0.13), dark_metal, rig, 0.035)
    rounded_box("Reservoir near rail", (1.42, 0.09, 0.09), (-1.95, -0.47, 0.62), edge_metal, rig, 0.028)
    rounded_box("Reservoir far rail", (1.42, 0.09, 0.09), (-1.95, 0.47, 0.62), dark_metal, rig, 0.028)
    cylinder("Nozzle collar", 0.53, 0.45, (-3.02, 0.0, 0.57), metal, rig)
    cylinder("Nozzle taper", 0.32, 0.85, (-3.62, 0.0, 0.45), rubber, rig)
    cylinder("Nozzle cap", 0.20, 0.45, (-4.22, 0.0, 0.36), dark_metal, rig)

    for x in (-2.73, -1.18, 2.43, 3.72):
        torus(f"Violet ring {x}", 0.70 if x > 2 else 0.55, 0.022, (x, 0.0, 0.70 if x > 2 else 0.62), magenta, rig)

    # Layered upward-facing panel with a machined outer housing and thin luminous gasket.
    chamfered_prism("Display armor housing", 3.22, 1.12, 0.14, 0.18, (0.86, 0.0, 1.39), armor, rig)
    chamfered_prism("Violet display gasket", 3.00, 0.93, 0.10, 0.14, (0.86, 0.0, 1.47), magenta, rig)
    rounded_box("Display bezel", (2.82, 0.78, 0.14), (0.86, 0.0, 1.53), dark_metal, rig, 0.11)
    rounded_box("Blank display surface", (2.48, 0.54, 0.08), (0.86, 0.0, 1.62), screen, rig, 0.08)

    for x in (-0.50, 2.22):
        for y in (-0.41, 0.41):
            top_disc(f"Display fastener {x} {y}", 0.045, 0.045, (x, y, 1.64), edge_metal, rig, 20)

    rounded_box("Cyan status inset", (0.30, 0.11, 0.06), (-0.78, -0.30, 1.40), cyan, rig, 0.025)
    rounded_box("Top violet indicator", (0.82, 0.12, 0.08), (0.28, 0.42, 1.42), magenta, rig, 0.025)

    # Transition armor and small seams break up the formerly primitive cylinder silhouette.
    chamfered_prism("Reservoir shoulder armor", 0.54, 1.06, 0.14, 0.13, (-0.93, 0.0, 1.30), armor, rig)
    chamfered_prism("Rear shoulder armor", 0.48, 1.10, 0.14, 0.13, (2.48, 0.0, 1.34), armor, rig)
    chamfered_prism("Rear grip top plate", 0.90, 0.70, 0.11, 0.12, (3.18, 0.0, 1.48), armor, rig)
    chamfered_prism("Left electronics cheek", 0.44, 0.70, 0.10, 0.10, (-0.76, 0.0, 1.43), edge_metal, rig)

    for index, x in enumerate((2.76, 2.94, 3.12, 3.30, 3.48)):
        rounded_box(f"Rear grip groove {index}", (0.055, 1.16, 0.055), (x, 0.0, 1.48), dark_metal, rig, 0.015)

    for index, y in enumerate((-0.43, -0.27, 0.27, 0.43)):
        rounded_box(f"Body vent {index}", (0.34, 0.055, 0.055), (-0.55, y, 1.42), dark_metal, rig, 0.012)

    # Raised structural rails give the simple cylinders a hard-surface silhouette.
    rounded_box("Upper body rail", (2.25, 0.34, 0.10), (0.85, 0.0, 1.34), metal, rig, 0.05)
    rounded_box("Lower body rail", (2.15, 0.30, 0.12), (0.85, 0.0, 0.08), dark_metal, rig, 0.04)

    table = rounded_box(
        "Workbench surface",
        (30.0, 30.0, 0.25),
        (0.0, 0.0, -0.15),
        tabletop_material(),
        bevel_width=0.08,
    )

    card_material = principled_material("Data card", (0.012, 0.018, 0.035), metallic=0.18, roughness=0.52)
    rounded_box(
        "Cropped data card",
        (2.4, 1.35, 0.06),
        (-3.75, 9.35, 0.04),
        card_material,
        bevel_width=0.05,
        rotation=(0.0, 0.0, math.radians(-16)),
    )

    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.23, depth=0.12, location=(3.8, 7.7, 0.08))
    fastener = bpy.context.object
    fastener.name = "Peripheral fastener"
    assign_material(fastener, dark_metal)
    bevel(fastener, 0.025, 2)
    smooth(fastener)

    # Twelve-coin composition arranged in explicit physical layers. Base coins are
    # spaced so their meshes do not intersect; raised coins overlap only in the
    # camera projection and have enough height to rest on the layer beneath.
    coin_layout = [
        # Base layer
        (-4.10, -3.05, 0.125, 2.0, -1.0, -13.0, 0.47, False),
        (-2.94, -3.02, 0.130, -2.5, 1.0, 9.0, 0.47, False),
        (-1.76, -2.72, 0.135, 3.0, 1.5, -7.0, 0.45, False),
        (-4.48, -1.85, 0.135, -3.0, -1.0, 16.0, 0.47, False),
        (-3.25, -1.92, 0.130, 2.0, 1.0, -4.0, 0.46, False),
        (-2.05, -1.58, 0.140, -4.0, 1.0, 12.0, 0.46, False),
        (-2.76, -0.60, 0.240, -14.0, 8.0, 7.0, 0.45, False),
        # Raised layer
        (-3.78, -1.95, 0.425, 13.0, -5.0, 21.0, 0.46, False),
        (-2.32, -1.95, 0.430, -12.0, 6.0, -16.0, 0.46, False),
        (-3.68, -1.12, 0.490, 18.0, -8.0, -18.0, 0.45, False),
        (-2.12, -0.94, 0.550, 28.0, -5.0, 29.0, 0.43, True),
    ]
    for index, (coin_x, coin_y, coin_z, tilt_x, tilt_y, turn_z, radius, reeded_edge) in enumerate(coin_layout):
        sculpted_coin(
            f"Antique gold coin {index}",
            (coin_x, coin_y, coin_z),
            (math.radians(tilt_x), math.radians(tilt_y), math.radians(turn_z)),
            gold,
            gold_side,
            gold_relief,
            radius=radius,
            depth=0.16,
            reeded_edge=reeded_edge,
        )

    # The top coin keeps its center readable for the live balance while retaining
    # the same beaded perimeter, inset rings, thickness, and worn material.
    top_coin_x, top_coin_y = -3.05, -2.28
    sculpted_coin(
        "Balance display coin",
        (top_coin_x, top_coin_y, 0.580),
        (math.radians(28.0), math.radians(-6.0), math.radians(5.0)),
        gold,
        gold_side,
        gold_relief,
        radius=0.52,
        depth=0.17,
        clean_face=True,
    )

    # One broad source lights the entire tabletop, not the coin pile in isolation.
    # It provides the warm directional reflection needed for gold to read as metal.
    add_area_light(
        "Warm tabletop softbox",
        (-4.5, -5.5, 11.5),
        90.0,
        (1.0, 0.72, 0.40),
        5.5,
        (-2.8, -2.1, 0.0),
    )

    add_area_light(
        "Large soft overhead source",
        (-4.5, 2.0, 10.5),
        925.0,
        (0.68, 0.76, 1.0),
        5.5,
        (0.0, 6.0, 0.5),
    )
    add_area_light(
        "Restrained violet fill",
        (5.0, 8.5, 5.0),
        95.0,
        (0.24, 0.08, 0.62),
        4.0,
        (1.0, 6.0, 0.5),
    )
    add_area_light(
        "Crimson reservoir spill",
        (-2.0, 5.8, 1.8),
        38.0,
        (1.0, 0.006, 0.02),
        1.3,
        (-2.0, 5.6, 0.0),
    )

    camera_data = bpy.data.cameras.new("Dashboard tabletop camera")
    camera = bpy.data.objects.new("Dashboard tabletop camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.0, 0.0, 24.0)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 22.0
    point_at(camera, (0.0, 0.0, 0.0))
    scene.camera = camera

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.render.render(write_still=True)
    print(f"Saved blend: {BLEND_PATH}")
    print(f"Saved render: {RENDER_PATH}")


if __name__ == "__main__":
    build_scene()
