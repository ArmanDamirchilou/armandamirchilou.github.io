import bpy

export_path = r"E:\arman-personal-website\assets\source\model_cowork2.glb"

bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    export_morph=True,          # Shape Keys checked
    export_apply=False,         # CRITICAL: must be False or shape keys get silently dropped
    export_animation_mode='NLA_TRACKS',
    export_force_sampling=True,
    export_skins=True,
    export_yup=True,
)

print("Exported to", export_path)

import os
print("File exists:", os.path.exists(export_path), "size:", os.path.getsize(export_path) if os.path.exists(export_path) else None)
