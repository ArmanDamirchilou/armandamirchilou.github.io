import bpy
body = bpy.data.objects.get("avaturn_body")
kbs = body.data.shape_keys.key_blocks
for kb in kbs:
    if kb.name != 'Basis':
        kb.value = 0.0
kbs[KEY_NAME].value = KEY_VALUE
bpy.context.view_layer.update()
print(KEY_NAME, '=', KEY_VALUE)
