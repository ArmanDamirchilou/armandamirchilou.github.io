import bpy

body = bpy.data.objects.get("avaturn_body.001")
for kb in body.data.shape_keys.key_blocks:
    kb.value = 0.0

arm = bpy.data.objects.get("Armature.001")
print("Armature animation_data:", arm.animation_data)
if arm.animation_data:
    print("NLA tracks:")
    for t in arm.animation_data.nla_tracks:
        for s in t.strips:
            print(f"  track='{t.name}' strip='{s.name}' influence={s.influence} mute={s.mute} frames={s.frame_start}-{s.frame_end} action={s.action.name if s.action else None}")

print("Actions in file:", [a.name for a in bpy.data.actions])

# check arm bone rotation values at a few frames directly from the strip's action (since NLA
# needs evaluation -- easiest reliable check is to read the action fcurve keyframe values directly)
import math
for act_name in ["Idle", "Talking"]:
    act = bpy.data.actions.get(act_name)
    if not act:
        print(f"ACTION '{act_name}' NOT FOUND IN IMPORTED FILE")
        continue
    print(f"\n--- {act_name} ---")
    for bone in ["LeftArm", "RightArm"]:
        for idx in range(3):
            dp = f'pose.bones["{bone}"].rotation_euler'
            for fc in act.fcurves:
                if fc.data_path == dp and fc.array_index == idx:
                    vals = [(kp.co.x, round(math.degrees(kp.co.y),1)) for kp in fc.keyframe_points]
                    print(f"  {bone}[{idx}]: {vals}")
    for finger_bone in ["LeftHandIndex1", "LeftHandThumb1", "RightHandIndex1", "RightHandThumb1"]:
        dp = f'pose.bones["{finger_bone}"].rotation_euler'
        for fc in act.fcurves:
            if fc.data_path == dp and fc.array_index == 0:
                vals = [(kp.co.x, round(math.degrees(kp.co.y),1)) for kp in fc.keyframe_points]
                print(f"  {finger_bone}[0]: {vals}")
