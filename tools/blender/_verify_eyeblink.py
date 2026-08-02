import bpy
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data
bas = mesh.shape_keys.key_blocks["Basis"]
skL = mesh.shape_keys.key_blocks["eyeBlinkLeft"]
skR = mesh.shape_keys.key_blocks["eyeBlinkRight"]

# known brow vertex from earlier probe (topmost / highest Z near EYE_L)
brow_idx = 1774
print("brow vertex 1774 basis co:", bas.data[brow_idx].co)
print("  eyeBlinkLeft diff at brow vertex:", (skL.data[brow_idx].co - bas.data[brow_idx].co).length)

# eyelid_mask_L strongest-weighted vertex
idx_L = body.vertex_groups["eyelid_mask_L"].index
best_i, best_w = None, 0
for i, v in enumerate(mesh.vertices):
    for g in v.groups:
        if g.group == idx_L and g.weight > best_w:
            best_w = g.weight
            best_i = i
print(f"strongest eyelid_mask_L vertex: {best_i} weight={best_w:.3f} basis_co={bas.data[best_i].co}")
print("  eyeBlinkLeft diff there:", (skL.data[best_i].co - bas.data[best_i].co).length)

# overall stats
diffsL = [(skL.data[i].co - bas.data[i].co).length for i in range(len(bas.data))]
print("eyeBlinkLeft: max diff=%.4f, num moved>1mm=%d" % (max(diffsL), sum(1 for d in diffsL if d>0.001)))

# confirm eyeBlinkLeft does NOT move any right-eye vertices and vice versa
idx_R = body.vertex_groups["eyelid_mask_R"].index
right_moved_by_left = 0
for i, v in enumerate(mesh.vertices):
    wR = 0.0
    for g in v.groups:
        if g.group == idx_R:
            wR = g.weight
    if wR > 0.01 and diffsL[i] > 0.0005:
        right_moved_by_left += 1
print("right-eye vertices disturbed by eyeBlinkLeft:", right_moved_by_left)
