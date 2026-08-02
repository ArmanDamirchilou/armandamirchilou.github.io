import bpy
body = bpy.data.objects.get("avaturn_body")
mesh = body.data
bas = mesh.shape_keys.key_blocks["Basis"]
skR = mesh.shape_keys.key_blocks["eyeBlinkRight"]

brow_idx_r = 2342  # a right-side high vertex from earlier probe near the brow
print("brow-ish vertex", brow_idx_r, "basis co:", bas.data[brow_idx_r].co)
print("  eyeBlinkRight diff there:", (skR.data[brow_idx_r].co - bas.data[brow_idx_r].co).length)

diffsR = [(skR.data[i].co - bas.data[i].co).length for i in range(len(bas.data))]
print("eyeBlinkRight: max diff=%.4f, moved>1mm=%d" % (max(diffsR), sum(1 for d in diffsR if d>0.001)))

idx_L = body.vertex_groups["eyelid_mask_L"].index
left_moved_by_right = 0
for i, v in enumerate(mesh.vertices):
    wL = 0.0
    for g in v.groups:
        if g.group == idx_L:
            wL = g.weight
    if wL > 0.01 and diffsR[i] > 0.0005:
        left_moved_by_right += 1
print("left-eye vertices disturbed by eyeBlinkRight:", left_moved_by_right)
