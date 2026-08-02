import bpy, math

arm = bpy.data.objects.get("Armature")
pb = arm.pose.bones.get("LeftHandIndex1")
pb.rotation_mode = 'XYZ'
pb.rotation_euler = (math.radians(AXIS_X), math.radians(AXIS_Y), math.radians(AXIS_Z))
bpy.context.view_layer.update()
print("set LeftHandIndex1 to", AXIS_X, AXIS_Y, AXIS_Z)
