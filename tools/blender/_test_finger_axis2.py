import bpy, math

arm = bpy.data.objects.get("Armature")
pb = arm.pose.bones.get("RightHandIndex1")
pb.rotation_mode = 'XYZ'
pb.rotation_euler = (math.radians(80), 0, 0)
pbt = arm.pose.bones.get("LeftHandThumb1")
pbt.rotation_mode = 'XYZ'
pbt.rotation_euler = (math.radians(80), 0, 0)
bpy.context.view_layer.update()
print("set RightHandIndex1 and LeftHandThumb1 to test values")
