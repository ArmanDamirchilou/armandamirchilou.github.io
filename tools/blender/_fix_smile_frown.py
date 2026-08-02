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

# standalone corner mask: own radius around each mouth corner, not derived from mouth_mask
CORNER_RADIUS = 0.022
if "mouth_corner_mask" in body.vertex_groups:
    body.vertex_groups.remove(body.vertex_groups["mouth_corner_mask"])
corner_mask = body.vertex_groups.new(name="mouth_corner_mask")

corner_w = [0.0]*n
for i, co in enumerate(base_co):
    dL = (co - CORNER_L).length
    dR = (co - CORNER_R).length
    d = min(dL, dR)
    if d >= CORNER_RADIUS:
        continue
    w = smoothstep(1 - d / CORNER_RADIUS)
    # keep it to the front / lip area only (avoid cheeks): tight y and z bound already implied by radius
    corner_w[i] = w

for i, w in enumerate(corner_w):
    if w > 0.001:
        corner_mask.add([i], w, 'REPLACE')
print(f"mouth_corner_mask v2: {sum(1 for w in corner_w if w>0.001)} verts, max={max(corner_w):.3f}")

def make_key(name):
    if mesh.shape_keys and name in mesh.shape_keys.key_blocks:
        body.shape_key_remove(mesh.shape_keys.key_blocks[name])
    sk = body.shape_key_add(name=name, from_mix=False)
    sk.interpolation = 'KEY_LINEAR'
    sk.value = 0.0
    return sk

sk = make_key("mouthSmile")
for i in range(n):
    w = corner_w[i]
    if w <= 0.0:
        continue
    co = base_co[i]
    side = 1 if co.x > 0 else -1
    off = Vector((side * 0.010, -0.006, 0.014)) * w
    sk.data[i].co = co + off
diffs = [(sk.data[i].co-base_co[i]).length for i in range(n)]
print("mouthSmile v2 built. max diff=%.4f moved=%d" % (max(diffs), sum(1 for d in diffs if d>0.001)))

sk = make_key("mouthFrown")
for i in range(n):
    w = corner_w[i]
    if w <= 0.0:
        continue
    co = base_co[i]
    side = 1 if co.x > 0 else -1
    off = Vector((-side * 0.004, 0.004, -0.014)) * w
    sk.data[i].co = co + off
diffs = [(sk.data[i].co-base_co[i]).length for i in range(n)]
print("mouthFrown v2 built. max diff=%.4f moved=%d" % (max(diffs), sum(1 for d in diffs if d>0.001)))

for kb in mesh.shape_keys.key_blocks:
    if kb.name != "Basis":
        kb.value = 0.0
print("done")
