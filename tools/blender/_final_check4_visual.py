import bpy

arm = bpy.data.objects.get("Armature.001")
for track in arm.animation_data.nla_tracks:
    for strip in track.strips:
        strip.use_auto_blend = False
        strip.use_animated_influence = False
        strip.influence = 1.0
        strip.mute = False

for n in ["avaturn_hair_0.001", "avaturn_hair_1.001", "avaturn_glasses_0.001", "avaturn_glasses_1.001", "avaturn_look_0.001"]:
    o = bpy.data.objects.get(n)
    if o:
        o.hide_set(False)
arm.hide_set(True)

body = bpy.data.objects.get("avaturn_body.001")
bpy.context.view_layer.objects.active = body
body.select_set(True)

for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            region = [r for r in area.regions if r.type == 'WINDOW'][0]
            space = area.spaces.active
            rv3d = space.region_3d
            with bpy.context.temp_override(area=area, region=region, screen=screen):
                bpy.ops.view3d.view_axis(type='FRONT')
            rv3d.view_location = (0.0, 0.0, 1.0)
            rv3d.view_distance = 2.2
            rv3d.view_perspective = 'ORTHO'

bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
print("Influence fixed to 1.0 for verification playback, full body view ready, frame=1")
