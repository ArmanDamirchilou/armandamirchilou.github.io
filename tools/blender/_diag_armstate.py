import bpy

print("\n\n========== ARM DIAG ==========")
arm = bpy.data.objects.get("Armature")
print("Armature animation_data:", arm.animation_data)
if arm.animation_data:
    print("active action:", arm.animation_data.action)
    print("NLA tracks:", [(t.name, t.mute, [(s.name, s.action.name if s.action else None, s.frame_start, s.frame_end, s.mute) for s in t.strips]) for t in arm.animation_data.nla_tracks])

print("\nCurrent frame:", bpy.context.scene.frame_current)
pb_la = arm.pose.bones.get("LeftArm")
pb_ra = arm.pose.bones.get("RightArm")
print("LeftArm rotation_mode:", pb_la.rotation_mode, "euler:", pb_la.rotation_euler[:], "quat:", pb_la.rotation_quaternion[:])
print("RightArm rotation_mode:", pb_ra.rotation_mode, "euler:", pb_ra.rotation_euler[:], "quat:", pb_ra.rotation_quaternion[:])

act_idle = bpy.data.actions.get("Idle")
if act_idle:
    print("\nIdle action fcurves:")
    for fc in act_idle.fcurves:
        kfs = [kp.co[:] for kp in fc.keyframe_points]
        print(f"  {fc.data_path} idx={fc.array_index}  n_kf={len(fc.keyframe_points)}  frames={[k[0] for k in kfs]}")
else:
    print("!! No 'Idle' action found in bpy.data.actions !!")

print("\nAll actions:", [a.name for a in bpy.data.actions])
print("========== END ==========\n\n")
