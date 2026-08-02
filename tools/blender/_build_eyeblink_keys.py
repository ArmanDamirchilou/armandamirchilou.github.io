import bpy, math
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data

EYE_L = Vector((-0.0425, -0.0683, 1.7415))
EYE_R = Vector(( 0.0425, -0.0683, 1.7415))

# remove old flawed eyeBlink keys and rebuild
for nm in ["eyeBlinkLeft", "eyeBlinkRight"]:
    if mesh.shape_keys and nm in mesh.shape_keys.key_blocks:
        body.shape_key_remove(mesh.shape_keys.key_blocks[nm])

basis = mesh.shape_keys.key_blocks["Basis"]
n = len(basis.data)
base_co = [basis.data[i].co.copy() for i in range(n)]

idx_L = body.vertex_groups["eyelid_mask_L"].index
idx_R = body.vertex_groups["eyelid_mask_R"].index

def group_weight(v, idx):
    for g in v.groups:
        if g.group == idx:
            return g.weight
    return 0.0

w_L = [group_weight(v, idx_L) for v in mesh.vertices]
w_R = [group_weight(v, idx_R) for v in mesh.vertices]

def make_key(name):
    sk = body.shape_key_add(name=name, from_mix=False)
    sk.interpolation = 'KEY_LINEAR'
    sk.value = 0.0
    return sk

def build_blink(name, weights, eye_center):
    sk = make_key(name)
    for i in range(n):
        w = weights[i]
        if w <= 0.0:
            continue
        co = base_co[i]
        if co.z >= eye_center.z:
            # upper lid: drops down to meet lower lid, and slides slightly forward (toward -Y, out of face) to cover the eyeball
            off = Vector((0, -0.006, -0.017)) * w
        else:
            # lower lid: rises slightly to meet upper lid
            off = Vector((0, -0.002, 0.005)) * w
        sk.data[i].co = co + off
    diffs = [(sk.data[i].co - base_co[i]).length for i in range(n)]
    print(f"{name} built. max diff={max(diffs):.4f}, moved>1mm={sum(1 for d in diffs if d>0.001)}")

build_blink("eyeBlinkLeft", w_L, EYE_L)
build_blink("eyeBlinkRight", w_R, EYE_R)

for kb in mesh.shape_keys.key_blocks:
    if kb.name != "Basis":
        kb.value = 0.0

print("ALL SHAPE KEYS:", [k.name for k in mesh.shape_keys.key_blocks])
