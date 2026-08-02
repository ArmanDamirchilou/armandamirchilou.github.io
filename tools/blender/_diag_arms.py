import bpy

body = bpy.data.objects.get("avaturn_body")
for kb in body.data.shape_keys.key_blocks:
    if kb.name != "Basis":
        kb.value = 0.0

arm = bpy.data.objects.get("Armature")
print("\n=== ARMATURE ACTIONS & BONES ===")
print("Actions:", [a.name for a in bpy.data.actions])

arm_bone_names = [b.name for b in arm.data.bones if 'arm' in b.name.lower() or 'hand' in b.name.lower() or 'finger' in b.name.lower() or 'thumb' in b.name.lower() or 'shoulder' in b.name.lower()]
print("Arm/hand related bones:", arm_bone_names)

print("\n=== NLA TRACKS ===")
for t in arm.animation_data.nla_tracks:
    for s in t.strips:
        print(f"track='{t.name}' strip='{s.name}' influence={s.influence} mute={s.mute} frame={s.frame_start}-{s.frame_end} action={s.action.name if s.action else None}")

for act_name in ["Idle", "Talking"]:
    act = bpy.data.actions.get(act_name)
    if not act:
        print(f"\nAction '{act_name}' NOT FOUND")
        continue
    print(f"\n=== ACTION '{act_name}' frame_range={act.frame_range} ===")
    fcurves_by_bone = {}
    for fc in act.fcurves:
        dp = fc.data_path
        if 'pose.bones[' in dp:
            bone_name = dp.split('"')[1]
            fcurves_by_bone.setdefault(bone_name, []).append((fc.data_path, fc.array_index, len(fc.keyframe_points)))
    for bname in ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftHand", "RightHand"]:
        if bname in fcurves_by_bone:
            print(f"  {bname}: {fcurves_by_bone[bname]}")
        else:
            print(f"  {bname}: NO FCURVES")
    # also list any finger bones with keyframes
    finger_bones_with_keys = [b for b in fcurves_by_bone if 'finger' in b.lower() or 'thumb' in b.lower()]
    print(f"  finger/thumb bones WITH keyframes: {finger_bones_with_keys}")
