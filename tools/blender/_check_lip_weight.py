import bpy
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data

jaw_idx = body.vertex_groups["jaw_mask"].index

def group_weight(v, idx):
    for g in v.groups:
        if g.group == idx:
            return g.weight
    return 0.0

# nearest vertex to LOWER_LIP and UPPER_LIP landmarks
LOWER_LIP = Vector((0.0, -0.086, 1.661))
UPPER_LIP = Vector((0.0, -0.086, 1.677))
CORNER_L = Vector((-0.0327, -0.0828, 1.6689))

bas = mesh.shape_keys.key_blocks["Basis"]
verts = [bas.data[i].co for i in range(len(bas.data))]

def nearest(target):
    return min(range(len(verts)), key=lambda i: (verts[i]-target).length)

ll_idx = nearest(LOWER_LIP)
ul_idx = nearest(UPPER_LIP)
cl_idx = nearest(CORNER_L)

print("lower lip vertex", ll_idx, "co", verts[ll_idx], "jaw_mask weight:", group_weight(mesh.vertices[ll_idx], jaw_idx))
print("upper lip vertex", ul_idx, "co", verts[ul_idx], "jaw_mask weight:", group_weight(mesh.vertices[ul_idx], jaw_idx))
print("corner vertex", cl_idx, "co", verts[cl_idx], "jaw_mask weight:", group_weight(mesh.vertices[cl_idx], jaw_idx))

# also check weight at several z depths straight down from lower lip
for dz in [0.0, -0.005, -0.01, -0.02, -0.03, -0.04]:
    target = LOWER_LIP + Vector((0,0,dz))
    i = nearest(target)
    print(f"dz={dz}: nearest vtx {i} co={tuple(round(c,4) for c in verts[i])} weight={group_weight(mesh.vertices[i], jaw_idx):.3f}")
