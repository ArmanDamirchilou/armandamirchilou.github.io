"""
Headless Blender script: bakes real body-language animation tracks into the
avatar and exports an animated GLB.

Run:
  blender --background --python scripts/bake_animations.py

Produces: public/model_animated.glb  with two animation clips:
  - "Idle"   : breathing, subtle sway, slow head drift, relaxed open-arm pose
  - "Talking": livelier head nods/turns, chest engagement, hand gestures

The web app plays Idle by default and crossfades to Talking while the avatar
speaks, scaling intensity by voice amplitude.
"""

import bpy
import os
import math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "model.glb")
OUT = os.path.join(ROOT, "public", "model_animated.glb")
FPS = 30


def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model():
    bpy.ops.import_scene.gltf(filepath=SRC)
    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    if arm is None:
        raise RuntimeError("No armature found in model.glb")
    return arm


def bone(arm, name):
    return arm.pose.bones.get(name)


def set_modes(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"


def key_rot(pb, frame, x=0.0, y=0.0, z=0.0):
    """Add an additive rotation (radians) on top of the rest pose and keyframe it."""
    pb.rotation_euler = (x, y, z)
    pb.keyframe_insert(data_path="rotation_euler", frame=frame)


def build_action(arm, name, length, profile):
    """profile(t in [0,1)) -> dict of bone_name -> (x,y,z) radians."""
    action = bpy.data.actions.new(name=name)
    arm.animation_data_create()
    arm.animation_data.action = action

    steps = 24  # keyframes per loop -> smooth curves
    for i in range(steps + 1):
        frame = 1 + round(i / steps * (length - 1))
        t = (i / steps) % 1.0
        pose = profile(t)
        for bname, (rx, ry, rz) in pose.items():
            pb = bone(arm, bname)
            if pb:
                key_rot(pb, frame, rx, ry, rz)

    # smooth interpolation
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
    action.use_fake_user = True
    return action


def idle_profile(t):
    a = 2 * math.pi * t
    breath = math.sin(a)                 # ~one breath per loop
    drift = math.sin(a * 0.5)
    drift2 = math.sin(a * 0.5 + 1.3)
    return {
        # breathing through the chest
        "Spine":  (0.015 * breath, 0.0, 0.010 * math.sin(a * 0.5)),
        "Spine1": (0.018 * breath, 0.0, 0.0),
        "Spine2": (0.020 * breath, 0.006 * drift, 0.0),
        # slow, calm head life
        "Neck":   (0.020 * breath + 0.015 * drift, 0.020 * drift2, 0.010 * drift),
        "Head":   (0.030 * drift, 0.040 * drift2, 0.015 * math.sin(a * 0.7)),
        # shoulders rise slightly with breath
        "LeftShoulder":  (0.0, 0.0, 0.012 * breath),
        "RightShoulder": (0.0, 0.0, -0.012 * breath),
        # relaxed, slightly open arms (welcoming), gentle sway
        "LeftArm":  (0.05, 0.0, 0.10 + 0.02 * drift),
        "RightArm": (0.05, 0.0, -0.10 - 0.02 * drift),
        "LeftForeArm":  (0.10, 0.10 * drift, 0.0),
        "RightForeArm": (0.10, -0.10 * drift, 0.0),
    }


def talk_profile(t):
    a = 2 * math.pi * t
    nod = math.sin(a * 2.0)
    turn = math.sin(a * 1.3)
    beat = math.sin(a * 2.6)
    breath = math.sin(a)
    return {
        "Spine":  (0.018 * breath, 0.0, 0.012 * turn),
        "Spine1": (0.020 * breath + 0.012 * nod, 0.010 * turn, 0.0),
        "Spine2": (0.025 * nod, 0.018 * turn, 0.0),
        # expressive head while talking
        "Neck":   (0.035 * nod, 0.030 * turn, 0.012 * beat),
        "Head":   (0.055 * nod, 0.060 * turn, 0.025 * beat),
        "LeftShoulder":  (0.0, 0.0, 0.018 * breath),
        "RightShoulder": (0.0, 0.0, -0.018 * breath),
        # open arms + hand gestures emphasising speech
        "LeftArm":  (0.06 + 0.04 * beat, 0.0, 0.12 + 0.05 * beat),
        "RightArm": (0.06 - 0.04 * beat, 0.0, -0.12 - 0.05 * beat),
        "LeftForeArm":  (0.12 + 0.10 * beat, 0.12 * turn, 0.0),
        "RightForeArm": (0.12 - 0.10 * beat, -0.12 * turn, 0.0),
        "LeftHand":  (0.0, 0.08 * beat, 0.0),
        "RightHand": (0.0, -0.08 * beat, 0.0),
    }


def main():
    clean()
    arm = import_model()
    set_modes(arm)
    bpy.context.scene.render.fps = FPS

    build_action(arm, "Idle", 120, idle_profile)     # 4s loop
    build_action(arm, "Talking", 90, talk_profile)   # 3s loop

    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_nla_strips=False,
        export_morph=True,
        export_skins=True,
        export_yup=True,
    )
    print(f"[Bake] Exported {OUT}")


main()
