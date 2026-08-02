import bpy, math
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data

MOUTH_C = Vector((0.0, -0.088, 1.669))
CORNER_L = Vector((-0.0327, -0.0828, 1.6689))
CORNER_R = Vector(( 0.0327, -0.0828, 1.6689))

def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

n = len(mesh.vertices)
basis = mesh.shape_keys.key_blocks["Basis"]
base_co = [basis.data[i].co.copy() for i in range(n)]

# =====================================================================
# brow_mask_all + brow_mask_inner vertex groups
# =====================================================================
BROW_Z_LOW = 1.760
BROW_Z_HIGH = 1.788
for gname in ["brow_mask_all", "brow_mask_inner"]:
    if gname in body.vertex_groups:
        body.vertex_groups.remove(body.vertex_groups[gname])
brow_all = body.vertex_groups.new(name="brow_mask_all")
brow_inner = body.vertex_groups.new(name="brow_mask_inner")

eyelid_idx_L = body.vertex_groups["eyelid_mask_L"].index
eyelid_idx_R = body.vertex_groups["eyelid_mask_R"].index
def has_eyelid_weight(v):
    for g in v.groups:
        if g.group in (eyelid_idx_L, eyelid_idx_R) and g.weight > 0.001:
            return True
    return False

all_w = [0.0]*n
inner_w = [0.0]*n
for i, co in enumerate(base_co):
    if co.y >= -0.03 or not (BROW_Z_LOW < co.z < BROW_Z_HIGH) or abs(co.x) > 0.075:
        continue
    if has_eyelid_weight(mesh.vertices[i]):
        continue  # hard exclusion -- brow must never touch eyelid vertices
    # smooth top/bottom edges
    bottom_fade = smoothstep((co.z - BROW_Z_LOW) / 0.010 + 0.5)
    top_fade = smoothstep((BROW_Z_HIGH - co.z) / 0.010 + 0.5)
    lateral_fade = smoothstep((0.075 - abs(co.x)) / 0.015 + 0.5)
    w = bottom_fade * top_fade * lateral_fade
    all_w[i] = w
    # inner: full weight near x=0, fades to 0 by |x|=0.045
    inner_factor = smoothstep(1 - abs(co.x) / 0.045)
    inner_w[i] = w * inner_factor

for i, w in enumerate(all_w):
    if w > 0.001:
        brow_all.add([i], w, 'REPLACE')
for i, w in enumerate(inner_w):
    if w > 0.001:
        brow_inner.add([i], w, 'REPLACE')

print(f"brow_mask_all: {sum(1 for w in all_w if w>0.001)} verts, max={max(all_w):.3f}")
print(f"brow_mask_inner: {sum(1 for w in inner_w if w>0.001)} verts, max={max(inner_w):.3f}")

# =====================================================================
# mouth_corner_mask: reuse mouth_mask weight, biased toward the corners
# =====================================================================
mouth_idx = body.vertex_groups["mouth_mask"].index
def group_weight(v, idx):
    for g in v.groups:
        if g.group == idx:
            return g.weight
    return 0.0
mouth_w = [group_weight(v, mouth_idx) for v in mesh.vertices]

if "mouth_corner_mask" in body.vertex_groups:
    body.vertex_groups.remove(body.vertex_groups["mouth_corner_mask"])
corner_mask = body.vertex_groups.new(name="mouth_corner_mask")
corner_w = [0.0]*n
MOUTH_HALF_WIDTH = CORNER_R.x  # ~0.0327
for i, co in enumerate(base_co):
    mw = mouth_w[i]
    if mw <= 0.0:
        continue
    # favor vertices further from center (closer to a corner) along X
    corner_factor = smoothstep(abs(co.x) / (MOUTH_HALF_WIDTH * 0.9))
    corner_w[i] = mw * corner_factor
for i, w in enumerate(corner_w):
    if w > 0.001:
        corner_mask.add([i], w, 'REPLACE')
print(f"mouth_corner_mask: {sum(1 for w in corner_w if w>0.001)} verts, max={max(corner_w):.3f}")

# =====================================================================
# build the 4 shape keys
# =====================================================================
def make_key(name):
    if mesh.shape_keys and name in mesh.shape_keys.key_blocks:
        body.shape_key_remove(mesh.shape_keys.key_blocks[name])
    sk = body.shape_key_add(name=name, from_mix=False)
    sk.interpolation = 'KEY_LINEAR'
    sk.value = 0.0
    return sk

# mouthSmile: corners pull up and outward
sk = make_key("mouthSmile")
for i in range(n):
    w = corner_w[i]
    if w <= 0.0:
        continue
    co = base_co[i]
    side = 1 if co.x > 0 else -1
    off = Vector((side * 0.007, -0.004, 0.010)) * w
    sk.data[i].co = co + off
diffs = [(sk.data[i].co-base_co[i]).length for i in range(n)]
print("mouthSmile built. max diff=%.4f moved=%d" % (max(diffs), sum(1 for d in diffs if d>0.001)))

# mouthFrown: corners pull down and slightly inward
sk = make_key("mouthFrown")
for i in range(n):
    w = corner_w[i]
    if w <= 0.0:
        continue
    co = base_co[i]
    side = 1 if co.x > 0 else -1
    off = Vector((-side * 0.003, 0.003, -0.010)) * w
    sk.data[i].co = co + off
diffs = [(sk.data[i].co-base_co[i]).length for i in range(n)]
print("mouthFrown built. max diff=%.4f moved=%d" % (max(diffs), sum(1 for d in diffs if d>0.001)))

# browInnerUp: inner brow raises
sk = make_key("browInnerUp")
for i in range(n):
    w = inner_w[i]
    if w <= 0.0:
        continue
    co = base_co[i]
    off = Vector((0, -0.002, 0.010)) * w
    sk.data[i].co = co + off
diffs = [(sk.data[i].co-base_co[i]).length for i in range(n)]
print("browInnerUp built. max diff=%.4f moved=%d" % (max(diffs), sum(1 for d in diffs if d>0.001)))

# browDown: whole brow lowers
sk = make_key("browDown")
for i in range(n):
    w = all_w[i]
    if w <= 0.0:
        continue
    co = base_co[i]
    off = Vector((0, 0.003, -0.009)) * w
    sk.data[i].co = co + off
diffs = [(sk.data[i].co-base_co[i]).length for i in range(n)]
print("browDown built. max diff=%.4f moved=%d" % (max(diffs), sum(1 for d in diffs if d>0.001)))

for kb in mesh.shape_keys.key_blocks:
    if kb.name != "Basis":
        kb.value = 0.0

print("\nALL SHAPE KEYS:", [k.name for k in mesh.shape_keys.key_blocks])
print("TOTAL COUNT:", len(mesh.shape_keys.key_blocks))
