import bpy

body = bpy.data.objects.get("avaturn_body.001")
mesh = body.data
bas = mesh.shape_keys.key_blocks["Basis"]
sk = mesh.shape_keys.key_blocks["eyeBlinkLeft"]

brow_idx = 1774
print("brow vertex diff at eyeBlinkLeft=1.0:", (sk.data[brow_idx].co - bas.data[brow_idx].co).length)

diffs = [(sk.data[i].co - bas.data[i].co).length for i in range(len(bas.data))]
print("eyeBlinkLeft max diff:", max(diffs), "moved>1mm:", sum(1 for d in diffs if d > 0.001))

for kb in mesh.shape_keys.key_blocks:
    kb.value = 1.0 if kb.name == "eyeBlinkLeft" else 0.0

print("eyeBlinkLeft=1.0 set")
