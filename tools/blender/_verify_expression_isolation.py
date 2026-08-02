import bpy
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data
bas = mesh.shape_keys.key_blocks["Basis"]

NOSE = Vector((0, -0.09, 1.70))
CHEEK_L = Vector((-0.0576, -0.0613, 1.7147))
CHEEK_R = Vector((0.0576, -0.0613, 1.7147))

def nearest(target):
    best_i, best_d = None, 1e9
    for i in range(len(bas.data)):
        d = (bas.data[i].co - target).length
        if d < best_d:
            best_d = d
            best_i = i
    return best_i

nose_idx = nearest(NOSE)
cheekL_idx = nearest(CHEEK_L)
cheekR_idx = nearest(CHEEK_R)
eyelidL_idx = 5950  # strongest eyelid_mask_L vertex from earlier check

for keyname in ["mouthSmile", "mouthFrown", "browInnerUp", "browDown"]:
    sk = mesh.shape_keys.key_blocks[keyname]
    dn = (sk.data[nose_idx].co - bas.data[nose_idx].co).length
    dcl = (sk.data[cheekL_idx].co - bas.data[cheekL_idx].co).length
    dcr = (sk.data[cheekR_idx].co - bas.data[cheekR_idx].co).length
    del_ = (sk.data[eyelidL_idx].co - bas.data[eyelidL_idx].co).length
    print(f"{keyname}: nose_diff={dn:.5f} cheekL_diff={dcl:.5f} cheekR_diff={dcr:.5f} eyelid_diff={del_:.5f}")

for keyname in ["jawOpen", "mouthOpen", "mouthLowerDown"]:
    sk = mesh.shape_keys.key_blocks[keyname]
    dn = (sk.data[nose_idx].co - bas.data[nose_idx].co).length
    dcl = (sk.data[cheekL_idx].co - bas.data[cheekL_idx].co).length
    dcr = (sk.data[cheekR_idx].co - bas.data[cheekR_idx].co).length
    print(f"{keyname}: nose_diff={dn:.5f} cheekL_diff={dcl:.5f} cheekR_diff={dcr:.5f}")
