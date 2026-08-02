import bpy
arm = bpy.data.objects.get("Armature")
names = [b.name for b in arm.data.bones]
fingers = [n for n in names if any(f in n for f in ["Index","Middle","Ring","Pinky","Thumb"])]
fingers.sort()
print(fingers)
print("count:", len(fingers))

# also get frame ranges + keyframe frames for LeftHand/RightHand in Talking to understand hand keyframe timing
act = bpy.data.actions.get("Talking")
for fc in act.fcurves:
    if 'LeftHand"]' in fc.data_path and 'rotation_euler' in fc.data_path and fc.array_index==0:
        print("LeftHand keyframe frames (Talking):", [kp.co.x for kp in fc.keyframe_points])
act_idle = bpy.data.actions.get("Idle")
for fc in act_idle.fcurves:
    if 'LeftArm"]' in fc.data_path and 'rotation_euler' in fc.data_path and fc.array_index==0:
        print("LeftArm keyframe frames (Idle):", [kp.co.x for kp in fc.keyframe_points])
