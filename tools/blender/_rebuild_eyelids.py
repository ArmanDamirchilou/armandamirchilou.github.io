import bpy, math
from mathutils import Vector, Matrix

body = bpy.data.objects.get("avaturn_body")
mesh = body.data

EYE_L = Vector((-0.0425, -0.0683, 1.7415))
EYE_R = Vector(( 0.0425, -0.0683, 1.7415))
EYE_RADIUS = 0.023      # tight sphere around each eye
BROW_CEIL_L = EYE_L.z + 0.028   # hard ceiling -- excludes eyebrow entirely
BROW_CEIL_R = EYE_R.z + 0.028
CHEEK_FLOOR = EYE_L.z - 0.022   # hard floor -- excludes upper cheek

def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

n = len(mesh.vertices)
basis_co = [v.co.copy() for v in mesh.vertices]

def build_eyelid_mask(name, center, brow_ceil):
    if name in body.vertex_groups:
        body.vertex_groups.remove(body.vertex_groups[name])
    vg = body.vertex_groups.new(name=name)
    weights = [0.0] * n
    for i, co in enumerate(basis_co):
        if co.z > brow_ceil or co.z < CHEEK_FLOOR:
            continue
        d = (co - center).length
        if d >= EYE_RADIUS:
            continue
        w = smoothstep(1 - d / EYE_RADIUS)
        # extra ceiling fade right below the brow line so nothing brow-adjacent sneaks in at full weight
        ceil_fade = smoothstep((brow_ceil - co.z) / 0.010 + 0.5)
        w *= ceil_fade
        weights[i] = w
    for i, w in enumerate(weights):
        if w > 0.001:
            vg.add([i], w, 'REPLACE')
    print(f"{name}: {sum(1 for w in weights if w>0.001)} vertices, max={max(weights):.3f}")
    return weights

eyelid_L = build_eyelid_mask("eyelid_mask_L", EYE_L, BROW_CEIL_L)
eyelid_R = build_eyelid_mask("eyelid_mask_R", EYE_R, BROW_CEIL_R)

print("Vertex groups built: eyelid_mask_L, eyelid_mask_R")
