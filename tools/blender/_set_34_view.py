import bpy
import math
from mathutils import Euler

for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            region = [r for r in area.regions if r.type == 'WINDOW'][0]
            space = area.spaces.active
            rv3d = space.region_3d
            with bpy.context.temp_override(area=area, region=region, screen=screen):
                bpy.ops.view3d.view_axis(type='FRONT')
            # yaw the view ~35 degrees for a 3/4 look
            eul = Euler((math.radians(90), 0, math.radians(35)), 'XYZ')
            rv3d.view_rotation = eul.to_quaternion()
            rv3d.view_location = (0.0, -0.05, 1.72)
            rv3d.view_distance = 0.5
            rv3d.view_perspective = 'ORTHO'

print("3/4 view set")
