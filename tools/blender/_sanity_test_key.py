import bpy
from mathutils import Vector

body = bpy.data.objects.get("avaturn_body")
mesh = body.data

if "_sanity_test" in mesh.shape_keys.key_blocks:
    body.shape_key_remove(mesh.shape_keys.key_blocks["_sanity_test"])

sk = body.shape_key_add(name="_sanity_test", from_mix=False)
basis = mesh.shape_keys.key_blocks["Basis"]
for i in range(len(basis.data)):
    sk.data[i].co = basis.data[i].co + Vector((0.2, 0, 0))  # huge 20cm shift in X, whole body

# zero everything else, set this to 1
for kb in mesh.shape_keys.key_blocks:
    kb.value = 1.0 if kb.name == "_sanity_test" else 0.0

bpy.context.view_layer.update()
print("sanity test key created and set to 1.0 -- whole body should shift 20cm in +X")
print([ (kb.name, kb.value) for kb in mesh.shape_keys.key_blocks ])
