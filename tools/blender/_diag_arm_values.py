import bpy, math

arm = bpy.data.objects.get("Armature")

def get_fcurve(action, bone, prop, idx):
    dp = f'pose.bones["{bone}"].{prop}'
    for fc in action.fcurves:
        if fc.data_path == dp and fc.array_index == idx:
            return fc
    return None

for act_name in ["Idle", "Talking"]:
    act = bpy.data.actions.get(act_name)
    print(f"\n=== {act_name} ===")
    for bone in ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm"]:
        vals = []
        for idx in range(3):
            fc = get_fcurve(act, bone, "rotation_euler", idx)
            if fc:
                kf_vals = [(kp.co.x, round(math.degrees(kp.co.y), 1)) for kp in fc.keyframe_points]
                vals.append((idx, kf_vals))
        print(f"  {bone}: {vals}")
