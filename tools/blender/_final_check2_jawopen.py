import bpy
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body.001")
mesh = body.data
bas = mesh.shape_keys.key_blocks["Basis"]
sk = mesh.shape_keys.key_blocks["jawOpen"]

NOSE = Vector((0, -0.09, 1.70))
def nearest(target):
    return min(range(len(bas.data)), key=lambda i: (bas.data[i].co - target).length)
nose_idx = nearest(NOSE)
print("nose diff at jawOpen=1.0:", (sk.data[nose_idx].co - bas.data[nose_idx].co).length)

diffs = [(sk.data[i].co - bas.data[i].co).length for i in range(len(bas.data))]
print("jawOpen max diff:", max(diffs), "moved>1mm:", sum(1 for d in diffs if d>0.001))

# set value and hide other objects for a clean screenshot
for kb in mesh.shape_keys.key_blocks:
    kb.value = 1.0 if kb.name == "jawOpen" else 0.0

for n in ["avaturn_hair_0.001", "avaturn_hair_1.001", "avaturn_glasses_0.001", "avaturn_glasses_1.001", "avaturn_look_0.001"]:
    o = bpy.data.objects.get(n)
    if o:
        o.hide_set(True)
arm = bpy.data.objects.get("Armature.001")
if arm:
    arm.hide_set(True)

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

print("jawOpen=1.0 set, view framed on face")
