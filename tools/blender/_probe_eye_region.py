import bpy
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data
basis = mesh.shape_keys.key_blocks["Basis"]

EYE_L = Vector((-0.0425, -0.0683, 1.7415))

verts_near = []
for i in range(len(basis.data)):
    co = basis.data[i].co
    d = (co - EYE_L).length
    if d < 0.03:
        verts_near.append((i, co.copy(), d))

verts_near.sort(key=lambda t: t[1].z)
print(f"found {len(verts_near)} vertices within 3cm of EYE_L")
print("Z range:", verts_near[0][1].z, "to", verts_near[-1][1].z)
# print a sample spread across the Z range
step = max(1, len(verts_near)//25)
for i in range(0, len(verts_near), step):
    idx, co, d = verts_near[i]
    print(f"  v{idx}: co=({co.x:.4f},{co.y:.4f},{co.z:.4f}) dist={d:.4f}")
