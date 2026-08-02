import bpy

# create a fresh, empty scene for isolated verification
new_scene = bpy.data.scenes.new("VerifyImport")
bpy.context.window.scene = new_scene

glb_path = r"E:\arman-personal-website\assets\source\model_cowork2.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

print("Imported into fresh scene:", new_scene.name)
print("Objects in scene:", [o.name for o in new_scene.objects])
