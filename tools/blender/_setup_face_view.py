import bpy

ico = bpy.data.objects.get("Icosphere")
if ico:
    bpy.data.objects.remove(ico, do_unlink=True)

for n in ["avaturn_hair_0", "avaturn_hair_1", "avaturn_glasses_0", "avaturn_glasses_1", "avaturn_look_0", "avaturn_look_1"]:
    o = bpy.data.objects.get(n)
    if o:
        o.hide_set(True)

arm = bpy.data.objects.get("Armature")
if arm:
    arm.hide_set(True)

body = bpy.data.objects.get("avaturn_body")
# reset all shape key values to 0 so we're looking at Basis
if body.data.shape_keys:
    for kb in body.data.shape_keys.key_blocks:
        if kb.name != "Basis":
            kb.value = 0.0

bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = body
body.select_set(True)

for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            region = [r for r in area.regions if r.type == 'WINDOW'][0]
            space = area.spaces.active
            rv3d = space.region_3d
            with bpy.context.temp_override(area=area, region=region, screen=screen):
                bpy.ops.view3d.view_axis(type='FRONT')
            rv3d.view_location = (0.0, -0.05, 1.72)
            rv3d.view_distance = 0.45
            rv3d.view_perspective = 'ORTHO'

print("Face view ready.")
