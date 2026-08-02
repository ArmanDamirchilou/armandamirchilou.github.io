import bpy

body = bpy.data.objects.get("avaturn_body")
body.data.shape_keys.key_blocks['jawOpen'].value = 1.0
body.data.update_tag()
body.update_tag()
bpy.context.view_layer.update()
bpy.context.view_layer.depsgraph.update()

for screen in bpy.data.screens:
    for area in screen.areas:
        area.tag_redraw()

print('jawOpen now:', body.data.shape_keys.key_blocks['jawOpen'].value)
print('redraw tagged on all screens/areas')
