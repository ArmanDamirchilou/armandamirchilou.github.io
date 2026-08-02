import bpy

body = bpy.data.objects.get("avaturn_body")
mesh = body.data
key = mesh.shape_keys

key.key_blocks['jawOpen'].value = 1.0
key.update_tag()
mesh.update_tag()
body.update_tag()
bpy.context.view_layer.update()

dg = bpy.context.evaluated_depsgraph_get()
dg.update()

print('jawOpen:', key.key_blocks['jawOpen'].value)
print('tagged key, mesh, object; view_layer + depsgraph updated')
