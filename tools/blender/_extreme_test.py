import bpy

body = bpy.data.objects.get("avaturn_body")
mesh = body.data
arm_mod = body.modifiers.get("Armature")
if arm_mod:
    arm_mod.show_viewport = True  # restore normal armature display

# remove sanity test key
if "_sanity_test" in mesh.shape_keys.key_blocks:
    body.shape_key_remove(mesh.shape_keys.key_blocks["_sanity_test"])

sk = mesh.shape_keys.key_blocks['jawOpen']
bas = mesh.shape_keys.key_blocks['Basis']

# scale existing offsets by 4x as an extreme diagnostic test
for i in range(len(bas.data)):
    off = sk.data[i].co - bas.data[i].co
    if off.length > 0.0001:
        sk.data[i].co = bas.data[i].co + off * 4.0

for kb in mesh.shape_keys.key_blocks:
    kb.value = 1.0 if kb.name == 'jawOpen' else 0.0

bpy.context.view_layer.update()
print("jawOpen offsets scaled 4x for extreme visibility test, value=1.0")
