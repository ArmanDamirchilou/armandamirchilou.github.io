import bpy, math

arm = bpy.data.objects.get("Armature")

FINGER_CURL = {
    1: 75.0,   # proximal (knuckle)
    2: 85.0,   # middle joint
    3: 65.0,   # distal (tip) -- slightly less so it doesn't clip through the palm
}
THUMB_CURL = {
    1: 45.0,   # thumb base -- smaller, mostly opposition
    2: 60.0,
    3: 55.0,
}

fingers = ["Index", "Middle", "Ring", "Pinky"]
sides = ["Left", "Right"]

def set_fist_pose():
    for side in sides:
        for finger in fingers:
            for joint in (1, 2, 3):
                bname = f"{side}Hand{finger}{joint}"
                pb = arm.pose.bones.get(bname)
                if not pb:
                    print("MISSING BONE", bname)
                    continue
                pb.rotation_mode = 'XYZ'
                pb.rotation_euler = (math.radians(FINGER_CURL[joint]), 0, 0)
        for joint in (1, 2, 3):
            bname = f"{side}HandThumb{joint}"
            pb = arm.pose.bones.get(bname)
            if not pb:
                print("MISSING BONE", bname)
                continue
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = (math.radians(THUMB_CURL[joint]), 0, 0)

def insert_fist_keyframes(action, frames):
    arm.animation_data.action = action
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        set_fist_pose()
        bpy.context.view_layer.update()
        for side in sides:
            for finger in fingers:
                for joint in (1, 2, 3):
                    bname = f"{side}Hand{finger}{joint}"
                    pb = arm.pose.bones.get(bname)
                    if pb:
                        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
            for joint in (1, 2, 3):
                bname = f"{side}HandThumb{joint}"
                pb = arm.pose.bones.get(bname)
                if pb:
                    pb.keyframe_insert(data_path="rotation_euler", frame=frame)
    # force constant/linear interpolation between the two identical keys so it never animates
    for fc in action.fcurves:
        if 'Hand' in fc.data_path and ('Index' in fc.data_path or 'Middle' in fc.data_path or 'Ring' in fc.data_path or 'Pinky' in fc.data_path or 'Thumb' in fc.data_path):
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'

idle_act = bpy.data.actions.get("Idle")
talking_act = bpy.data.actions.get("Talking")

insert_fist_keyframes(idle_act, [1, 168])
insert_fist_keyframes(talking_act, [1, 120])

# clear the temp active action link (NLA tracks still reference the actions independently)
arm.animation_data.action = None
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()

print("Fist keyframes inserted into Idle (frames 1,168) and Talking (frames 1,120), CONSTANT interpolation.")
