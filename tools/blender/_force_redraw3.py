import bpy

body = bpy.data.objects.get("avaturn_body")
bpy.context.view_layer.objects.active = body
body.select_set(True)

for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            region = [r for r in area.regions if r.type == 'WINDOW'][0]
            with bpy.context.temp_override(area=area, region=region, screen=screen, active_object=body, object=body):
                bpy.ops.object.mode_set(mode='EDIT')
                bpy.ops.object.mode_set(mode='OBJECT')
            break

print('toggled edit/object mode to force full re-evaluation')
print('jawOpen:', body.data.shape_keys.key_blocks['jawOpen'].value)
