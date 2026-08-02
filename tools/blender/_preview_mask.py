import bpy
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data

name = "_mask_preview"
if mesh.shape_keys and name in mesh.shape_keys.key_blocks:
    body.shape_key_remove(mesh.shape_keys.key_blocks[name])

if not mesh.shape_keys:
    body.shape_key_add(name="Basis", from_mix=False)

sk = body.shape_key_add(name=name, from_mix=False)
basis = mesh.shape_keys.key_blocks["Basis"]

vg = body.vertex_groups[VG_NAME]
vg_idx = vg.index

for i, v in enumerate(mesh.vertices):
    w = 0.0
    for g in v.groups:
        if g.group == vg_idx:
            w = g.weight
            break
    if w > 0:
        # push masked vertices straight forward (out of the face) so the
        # masked region is obvious as a bulge, independent of any real sculpt direction
        sk.data[i].co = basis.data[i].co + Vector((0, -0.05, 0)) * w

sk.value = 1.0
for kb in mesh.shape_keys.key_blocks:
    if kb.name not in ("Basis", name):
        kb.value = 0.0

print(f"Preview built for group '{VG_NAME}'")
