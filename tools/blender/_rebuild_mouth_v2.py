import bpy, math
from mathutils import Vector, Matrix

body = bpy.data.objects.get("avaturn_body")
mesh = body.data
arm_mod = body.modifiers.get("Armature")
if arm_mod:
    arm_mod.show_viewport = True

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
CORNER_Z = (CORNER_L.z + CORNER_R.z) / 2.0

def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def clamp01(t):
    return max(0.0, min(1.0, t))

n = len(mesh.vertices)
basis_co = [v.co.copy() for v in mesh.vertices]

# =====================================================================
# jaw_mask v2: steeper ceiling transition (weight hits 1.0 fast just
# below mouth corner line), tighter floor so we don't drag the neck.
# =====================================================================
if "jaw_mask" in body.vertex_groups:
    body.vertex_groups.remove(body.vertex_groups["jaw_mask"])
jaw_mask = body.vertex_groups.new(name="jaw_mask")

jaw_weights = [0.0] * n
JAW_FLOOR_Z = CHIN.z - 0.020   # tighter floor -- was -0.035, now stays closer to chin
for i, co in enumerate(basis_co):
    if co.z < JAW_FLOOR_Z - 0.01 or co.z > CORNER_Z + 0.03:
        jaw_weights[i] = 0.0
        continue
    # steep ceiling: full weight within ~4mm below the corner line
    z_w = smoothstep((CORNER_Z - co.z) / 0.004 + 0.5)
    # steep floor: full weight until very close to the floor line, then fall off
    floor_w = smoothstep((co.z - JAW_FLOOR_Z) / 0.010 + 0.5)
    z_w *= floor_w
    if z_w <= 0.0:
        jaw_weights[i] = 0.0
        continue
    hinge_x = HINGE_R.x if co.x >= 0 else -HINGE_L.x
    x_w = smoothstep(1.0 - clamp01((abs(co.x) - hinge_x * 0.75) / (hinge_x * 0.45)))
    front_w = smoothstep((-0.02 - co.y) / 0.05 + 0.6)
    w = z_w * x_w * front_w
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

print(f"jaw_mask v2: {sum(1 for w in jaw_weights if w > 0.001)} vertices, max={max(jaw_weights):.3f}")

# mouth_mask / lower_lip_mask: keep same approach, just re-derive from current basis
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
    ceil_w = smoothstep((UPPER_LIP.z + 0.006 - co.z) / 0.006 + 0.5)
    front_w = smoothstep((-0.03 - co.y) / 0.04 + 0.6)
    mouth_weights[i] = w * ceil_w * front_w

for i, w in enumerate(mouth_weights):
    if w > 0.001:
        mouth_mask.add([i], w, 'REPLACE')

print(f"mouth_mask v2: {sum(1 for w in mouth_weights if w > 0.001)} vertices, max={max(mouth_weights):.3f}")

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

print(f"lower_lip_mask v2: {sum(1 for w in lower_lip_weights if w > 0.001)} vertices")
print("Vertex groups rebuilt: jaw_mask, mouth_mask, lower_lip_mask (v2, tighter boundaries)")
