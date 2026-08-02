import bpy, math
from mathutils import Vector, Matrix

body = bpy.data.objects.get("avaturn_body")
mesh = body.data

# ---- landmarks (clicked on the actual mesh; symmetrized L/R since single clicks weren't perfectly centered) ----
EYE_L = Vector((-0.0425, -0.0683, 1.7415))
EYE_R = Vector(( 0.0425, -0.0683, 1.7415))
MOUTH_C = Vector((0.0, -0.088, 1.669))
CORNER_L = Vector((-0.0327, -0.0828, 1.6689))
CORNER_R = Vector(( 0.0327, -0.0828, 1.6689))
CHIN = Vector((0.0, -0.0838, 1.6295))
LOWER_LIP = Vector((0.0, -0.086, 1.661))
UPPER_LIP = Vector((0.0, -0.086, 1.677))
HINGE_L = Vector((-0.0863, 0.0235, 1.6711))
HINGE_R = Vector(( 0.0863, 0.0235, 1.6711))
CHEEK_L = Vector((-0.0576, -0.0613, 1.7147))
CHEEK_R = Vector(( 0.0576, -0.0613, 1.7147))
CORNER_Z = (CORNER_L.z + CORNER_R.z) / 2.0  # 1.6689 -- the hard ceiling line for the jaw mask

def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def clamp01(t):
    return max(0.0, min(1.0, t))

n = len(mesh.vertices)
basis_co = [v.co.copy() for v in mesh.vertices]  # current Basis (rest) coordinates

# =====================================================================
# 1) build "jaw_mask" vertex group: lower lip + chin + jawline only.
#    Nose and cheekbones are HARD-PINNED to 0, on top of a very tight
#    Z ceiling so nothing above the mouth-corner line is ever included.
# =====================================================================
if "jaw_mask" in body.vertex_groups:
    body.vertex_groups.remove(body.vertex_groups["jaw_mask"])
jaw_mask = body.vertex_groups.new(name="jaw_mask")

jaw_weights = [0.0] * n
JAW_FLOOR_Z = CHIN.z - 0.035  # nothing below this -- keeps torso/arms/legs out entirely
for i, co in enumerate(basis_co):
    # only consider vertices actually in the head/neck area at all (cheap early-out
    # that also guarantees no far-away body vertex can ever reach this code path)
    if co.z < JAW_FLOOR_Z or co.z > CORNER_Z + 0.03:
        jaw_weights[i] = 0.0
        continue
    # hard Z ceiling: nothing above the corner line contributes, tight ~1cm transition
    z_w = smoothstep((CORNER_Z - co.z) / 0.010 + 0.5)
    # hard Z floor: nothing below the chin contributes, tight ~1.5cm transition
    floor_w = smoothstep((co.z - JAW_FLOOR_Z) / 0.015 + 0.5)
    z_w *= floor_w
    if z_w <= 0.0:
        jaw_weights[i] = 0.0
        continue
    # fade out laterally past the jaw hinge width so we don't reach into cheeks/ears
    hinge_x = HINGE_R.x if co.x >= 0 else -HINGE_L.x
    x_w = smoothstep(1.0 - clamp01((abs(co.x) - hinge_x * 0.75) / (hinge_x * 0.45)))
    # keep to the front half of the head (not ears / back of jaw)
    front_w = smoothstep((-0.02 - co.y) / 0.05 + 0.6)
    w = z_w * x_w * front_w
    # hard pins: nose tip/bridge and cheekbones are never part of the jaw
    if (co - Vector((0, -0.09, 1.70))).length < 0.05:
        w *= smoothstep((co - Vector((0, -0.09, 1.70))).length / 0.05)
    if (co - CHEEK_L).length < 0.045:
        w = 0.0
    if (co - CHEEK_R).length < 0.045:
        w = 0.0
    jaw_weights[i] = w

for i, w in enumerate(jaw_weights):
    if w > 0.001:
        jaw_mask.add([i], w, 'REPLACE')

print(f"jaw_mask: {sum(1 for w in jaw_weights if w > 0.001)} vertices weighted, max={max(jaw_weights):.3f}")

# =====================================================================
# 2) build "mouth_mask" vertex group: lips only, small tight radius,
#    hard ceiling just above the upper lip so it can never reach the nose.
# =====================================================================
if "mouth_mask" in body.vertex_groups:
    body.vertex_groups.remove(body.vertex_groups["mouth_mask"])
mouth_mask = body.vertex_groups.new(name="mouth_mask")

mouth_weights = [0.0] * n
MOUTH_RADIUS = 0.042
for i, co in enumerate(basis_co):
    d = (co - MOUTH_C).length
    if d >= MOUTH_RADIUS:
        mouth_weights[i] = 0.0
        continue
    w = smoothstep(1 - d / MOUTH_RADIUS)
    # hard ceiling a few mm above the upper lip -- keeps nose untouched
    ceil_w = smoothstep((UPPER_LIP.z + 0.006 - co.z) / 0.006 + 0.5)
    front_w = smoothstep((-0.03 - co.y) / 0.04 + 0.6)
    mouth_weights[i] = w * ceil_w * front_w

for i, w in enumerate(mouth_weights):
    if w > 0.001:
        mouth_mask.add([i], w, 'REPLACE')

print(f"mouth_mask: {sum(1 for w in mouth_weights if w > 0.001)} vertices weighted, max={max(mouth_weights):.3f}")

# =====================================================================
# 3) build "lower_lip_mask" (subset of mouth_mask, below the mouth line only)
# =====================================================================
if "lower_lip_mask" in body.vertex_groups:
    body.vertex_groups.remove(body.vertex_groups["lower_lip_mask"])
lower_lip_mask = body.vertex_groups.new(name="lower_lip_mask")

lower_lip_weights = [0.0] * n
for i, co in enumerate(basis_co):
    base_w = mouth_weights[i]
    if base_w <= 0.0:
        continue
    below_w = smoothstep((MOUTH_C.z - co.z) / 0.006 + 0.5)
    lower_lip_weights[i] = base_w * below_w

for i, w in enumerate(lower_lip_weights):
    if w > 0.001:
        lower_lip_mask.add([i], w, 'REPLACE')

print(f"lower_lip_mask: {sum(1 for w in lower_lip_weights if w > 0.001)} vertices weighted")

print("Vertex groups built: jaw_mask, mouth_mask, lower_lip_mask")
