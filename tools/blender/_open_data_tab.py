import bpy
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'PROPERTIES':
            for space in area.spaces:
                if space.type == 'PROPERTIES':
                    space.context = 'DATA'
print("set properties tab to DATA (mesh) on all PROPERTIES areas")
