import bpy
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data
basis = mesh.shape_keys.key_blocks["Basis"]

BROW_CENTER = Vector((0.0, -0.07, 1.76))
verts_near = []
for i in range(len(basis.data)):
    co = basis.data[i].co
    if co.y < -0.03 and 1.735 < co.z < 1.79 and abs(co.x) < 0.08:
        verts_near.append((i, co.copy()))

verts_near.sort(key=lambda t: t[1].x)
print(f"found {len(verts_near)} candidate brow-band vertices")
step = max(1, len(verts_near)//30)
for i in range(0, len(verts_near), step):
    idx, co = verts_near[i]
    print(f"  v{idx}: co=({co.x:.4f},{co.y:.4f},{co.z:.4f})")
