import bpy

body = bpy.data.objects.get("avaturn_body")
bpy.context.view_layer.objects.active = body
body.select_set(True)

results = []
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'PROPERTIES':
            for space in area.spaces:
                if space.type == 'PROPERTIES':
                    try:
                        space.context = 'DATA'
                        results.append('OK')
                    except TypeError as e:
                        results.append(str(e))

print('active object:', bpy.context.view_layer.objects.active)
print('results:', results)
