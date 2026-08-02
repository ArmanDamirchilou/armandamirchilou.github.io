import bpy, math
from mathutils import Vector, Matrix

body = bpy.data.objects.get("avaturn_body")
mesh = body.data

MOUTH_C = Vector((0.0, -0.088, 1.669))
HINGE_L = Vector((-0.0863, 0.0235, 1.6711))
HINGE_R = Vector(( 0.0863, 0.0235, 1.6711))

remove_names = ["_sanity_test", "jawOpen", "mouthOpen", "viseme_aa", "viseme_o",
                "viseme_e", "viseme_i", "viseme_u", "mouthLowerDown"]
for nm in remove_names:
    if mesh.shape_keys and nm in mesh.shape_keys.key_blocks:
        body.shape_key_remove(mesh.shape_keys.key_blocks[nm])

basis = mesh.shape_keys.key_blocks["Basis"]
n = len(basis.data)
base_co = [basis.data[i].co.copy() for i in range(n)]

jaw_idx = body.vertex_groups["jaw_mask"].index
mouth_idx = body.vertex_groups["mouth_mask"].index
lower_lip_idx = body.vertex_groups["lower_lip_mask"].index

def group_weight(v, idx):
    for g in v.groups:
        if g.group == idx:
            return g.weight
    return 0.0

jaw_w = [group_weight(v, jaw_idx) for v in mesh.vertices]
mouth_w = [group_weight(v, mouth_idx) for v in mesh.vertices]
lower_lip_w = [group_weight(v, lower_lip_idx) for v in mesh.vertices]

def hinge_pivot(x):
    t = (x - HINGE_L.x) / (HINGE_R.x - HINGE_L.x)
    t = max(0.0, min(1.0, t))
    return HINGE_L.lerp(HINGE_R, t)

def jaw_rotate_offset(co, w, angle_deg):
    if w <= 0.0:
        return Vector((0, 0, 0))
    pivot = hinge_pivot(co.x)
    rel = co - pivot
    R = Matrix.Rotation(math.radians(angle_deg * w), 4, 'X')
    new_rel = R @ rel
    return (pivot + new_rel) - co

def make_key(name):
    sk = body.shape_key_add(name=name, from_mix=False)
    sk.interpolation = 'KEY_LINEAR'
    sk.value = 0.0
    return sk

# jawOpen: bumped from 26 -> 38 deg for clearer visible gap
JAW_ANGLE = 38.0
sk = make_key("jawOpen")
for i in range(n):
    off = jaw_rotate_offset(base_co[i], jaw_w[i], JAW_ANGLE)
    sk.data[i].co = base_co[i] + off
print("jawOpen built (rotation-based, jaw_mask, angle=%.1f)" % JAW_ANGLE)

# mouthOpen: lips part, mouth_mask only, slightly bigger than before
sk = make_key("mouthOpen")
for i in range(n):
    co = base_co[i]
    w = mouth_w[i]
    if w <= 0.0:
        continue
    if co.z > MOUTH_C.z:
        off = Vector((0, -0.004, 0.009)) * w
    else:
        off = Vector((0, 0.008, -0.018)) * w
    sk.data[i].co = co + off
print("mouthOpen built (mouth_mask only)")

sk = make_key("mouthLowerDown")
for i in range(n):
    w = lower_lip_w[i]
    if w <= 0.0:
        continue
    sk.data[i].co = base_co[i] + Vector((0, 0.006, -0.020)) * w
print("mouthLowerDown built (lower_lip_mask only)")

sk = make_key("viseme_aa")
for i in range(n):
    co = base_co[i]
    off = jaw_rotate_offset(co, jaw_w[i], 28.0)
    mw = mouth_w[i]
    if mw > 0:
        side = 1 if co.x > 0 else -1
        off += Vector((side * 0.005, 0, 0)) * mw
    if off.length > 0:
        sk.data[i].co = co + off
print("viseme_aa built")

sk = make_key("viseme_o")
for i in range(n):
    co = base_co[i]
    w = mouth_w[i]
    if w <= 0.0:
        continue
    pull_center = -co.x * 0.5 * w
    protrude = -0.016 * w
    vertical = -0.003 * w if co.z > MOUTH_C.z else 0.005 * w
    sk.data[i].co = co + Vector((pull_center, protrude, vertical))
print("viseme_o built")

sk = make_key("viseme_u")
for i in range(n):
    co = base_co[i]
    w = mouth_w[i]
    if w <= 0.0:
        continue
    pull_center = -co.x * 0.6 * w
    protrude = -0.020 * w
    sk.data[i].co = co + Vector((pull_center, protrude, 0.0))
print("viseme_u built")

sk = make_key("viseme_e")
for i in range(n):
    co = base_co[i]
    w = mouth_w[i]
    if w <= 0.0:
        continue
    side = 1 if co.x > 0 else -1
    pull_out = side * 0.008 * w
    vertical = -0.001 * w if co.z > MOUTH_C.z else 0.005 * w
    sk.data[i].co = co + Vector((pull_out, 0.002 * w, vertical))
print("viseme_e built")

sk = make_key("viseme_i")
for i in range(n):
    co = base_co[i]
    w = mouth_w[i]
    if w <= 0.0:
        continue
    side = 1 if co.x > 0 else -1
    pull_out = side * 0.009 * w
    up = 0.004 * w
    vertical = -0.0015 * w if co.z > MOUTH_C.z else 0.003 * w
    sk.data[i].co = co + Vector((pull_out, 0.001 * w, up + vertical))
print("viseme_i built")

for kb in mesh.shape_keys.key_blocks:
    if kb.name != "Basis":
        kb.value = 0.0

print("\nALL SHAPE KEYS:", [k.name for k in mesh.shape_keys.key_blocks])

# quick diff report
sk = mesh.shape_keys.key_blocks['jawOpen']
diffs = [(sk.data[i].co - base_co[i]).length for i in range(n)]
print("jawOpen max diff:", max(diffs), "num moved>1mm:", sum(1 for d in diffs if d>0.001))
