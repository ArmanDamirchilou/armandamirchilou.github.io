import bpy

arm = bpy.data.objects["Armature"]
for track in arm.animation_data.nla_tracks:
    for strip in track.strips:
        strip.use_auto_blend = False
        strip.use_animated_influence = False
        strip.influence = 1.0
        strip.mute = False
        print(f"track '{track.name}' strip '{strip.name}' -> influence={strip.influence}, auto_blend={strip.use_auto_blend}")

bpy.context.scene.frame_set(1)
print("Fixed. Current frame reset to 1.")
