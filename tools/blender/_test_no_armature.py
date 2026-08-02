import bpy

body = bpy.data.objects.get("avaturn_body")
arm_mod = body.modifiers.get("Armature")
print("Armature modifier found:", arm_mod)
if arm_mod:
    arm_mod.show_viewport = False

body.data.shape_keys.key_blocks['jawOpen'].value = 1.0
bpy.context.view_layer.update()

print("Armature modifier viewport display now:", arm_mod.show_viewport if arm_mod else None)
print("jawOpen:", body.data.shape_keys.key_blocks['jawOpen'].value)
