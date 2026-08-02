"""
bake_animations.py
Headless Blender 4.x script:
  - Imports public/model.glb (Avaturn avatar)
  - Imports assets/anim/idle.fbx + talking.fbx (Mixamo)
  - Strips 'mixamorig:' prefix from bone names
  - Assigns actions named exactly 'Idle' and 'Talking'
  - Exports back to public/model.glb with morphs + skins
Run:
  blender --background --python bake_animations.py
"""

import bpy
import os
import sys

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
GLB_PATH    = os.path.join(SCRIPT_DIR, "public",       "model.glb")
IDLE_PATH   = os.path.join(SCRIPT_DIR, "assets", "anim", "idle.fbx")
TALK_PATH   = os.path.join(SCRIPT_DIR, "assets", "anim", "talking.fbx")
OUT_PATH    = GLB_PATH   # overwrite in-place

# ── Helpers ────────────────────────────────────────────────────────────────────
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    print(f"[OK] Imported GLB: {path}")

def get_armature():
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    raise RuntimeError("No armature found after GLB import!")

def strip_mixamo_prefix(armature):
    """Rename bones: 'mixamorig:Hips' → 'Hips'"""
    PREFIX = "mixamorig:"
    for bone in armature.data.bones:
        if bone.name.startswith(PREFIX):
            bone.name = bone.name[len(PREFIX):]
    print("[OK] Stripped 'mixamorig:' prefix from armature bones")

def import_fbx_action(fbx_path, action_name, armature):
    """Import FBX, extract its action, rename it, assign to armature."""
    # Remember existing actions
    before = set(bpy.data.actions.keys())

    bpy.ops.import_scene.fbx(
        filepath=fbx_path,
        use_anim=True,
        automatic_bone_orientation=True,
        ignore_leaf_bones=True,
        force_connect_children=False,
    )

    after = set(bpy.data.actions.keys())
    new_actions = after - before

    # Strip mixamorig prefix from any newly-imported armature bones too
    for obj in bpy.context.selected_objects:
        if obj.type == "ARMATURE" and obj != armature:
            strip_mixamo_prefix(obj)
            # Delete the extra armature (we only keep the original)
            bpy.data.objects.remove(obj, do_unlink=True)

    # Also remove any extra meshes that came with the FBX
    for obj in list(bpy.context.selected_objects):
        if obj.type == "MESH" and obj not in [o for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys]:
            try:
                bpy.data.objects.remove(obj, do_unlink=True)
            except Exception:
                pass

    if not new_actions:
        # Fallback: pick the most recently added action
        new_actions = {bpy.data.actions[-1].name} if bpy.data.actions else set()

    action = bpy.data.actions[list(new_actions)[0]]
    action.name = action_name

    # Strip mixamorig: from fcurve data paths inside the action
    PREFIX = "mixamorig:"
    for fc in action.fcurves:
        if PREFIX in fc.data_path:
            fc.data_path = fc.data_path.replace(PREFIX, "")

    # Make loop: set extrapolation to LINEAR and add cyclic modifier
    for fc in action.fcurves:
        fc.extrapolation = "LINEAR"
        if not fc.modifiers:
            mod = fc.modifiers.new(type="CYCLES")
            mod.mode_before = "REPEAT"
            mod.mode_after  = "REPEAT"

    # Assign to armature
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action

    print(f"[OK] Action '{action_name}' imported from {os.path.basename(fbx_path)}, "
          f"{len(action.fcurves)} fcurves, assigned to armature")
    return action

def verify_and_report(armature, out_path):
    print("\n─── ACCEPTANCE REPORT ────────────────────────────────────────")

    # Animations
    anim_names = [a.name for a in bpy.data.actions]
    print(f"Actions in file: {anim_names}")
    for required in ("Idle", "Talking"):
        status = "✓" if required in anim_names else "✗ MISSING"
        print(f"  {status}  {required}")

    # Morph targets
    morph_count = 0
    morph_names = []
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.data.shape_keys:
            keys = [k.name for k in obj.data.shape_keys.key_blocks if k.name != "Basis"]
            morph_count += len(keys)
            morph_names.extend(keys)

    print(f"Morph targets total: {morph_count}")
    for probe in ("jawOpen", "viseme_aa", "eyeBlinkLeft", "eyeBlinkRight"):
        found = probe in morph_names
        print(f"  {'✓' if found else '?'}  {probe}")

    # File size
    if os.path.exists(out_path):
        size_mb = os.path.getsize(out_path) / 1024 / 1024
        print(f"Output file size: {size_mb:.2f} MB  {'✓ <10 MB' if size_mb < 10 else '✗ TOO LARGE'}")

    print("──────────────────────────────────────────────────────────────\n")

def export_glb(out_path):
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_animations=True,
        export_morph=True,
        export_morph_normal=False,
        export_morph_tangent=False,
        export_skins=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_colors=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_nla_strips=True,
        export_def_bones=False,
        export_current_frame=False,
        export_frame_range=False,
        use_selection=False,
        use_visible=False,
        use_renderable=False,
        use_active_collection=False,
        use_mesh_edges=False,
        use_mesh_vertices=False,
    )
    print(f"[OK] Exported GLB → {out_path}")

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    # Validate inputs
    for p, label in [(GLB_PATH, "model.glb"), (IDLE_PATH, "idle.fbx"), (TALK_PATH, "talking.fbx")]:
        if not os.path.exists(p):
            print(f"[ERROR] Missing file: {p}  ({label})")
            sys.exit(1)

    clear_scene()

    # 1. Import avatar GLB
    import_glb(GLB_PATH)
    armature = get_armature()
    print(f"[INFO] Avatar armature: '{armature.name}'")

    # 2. Strip prefix from avatar skeleton (in case Avaturn used mixamorig: names)
    strip_mixamo_prefix(armature)

    # 3. Import animations
    idle_action = import_fbx_action(IDLE_PATH, "Idle",    armature)
    talk_action = import_fbx_action(TALK_PATH, "Talking", armature)

    # 4. Leave armature with Idle as active action (neutral pose)
    armature.animation_data.action = idle_action

    # 5. Export
    export_glb(OUT_PATH)

    # 6. Verify
    verify_and_report(armature, OUT_PATH)

    print("[DONE] bake_animations.py completed successfully.")

main()
