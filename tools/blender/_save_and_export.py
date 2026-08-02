import bpy

body = bpy.data.objects.get("avaturn_body")
# reset all shape keys to 0 before saving/exporting (clean default state)
for kb in body.data.shape_keys.key_blocks:
    if kb.name != "Basis":
        kb.value = 0.0

arm = bpy.data.objects.get("Armature")
arm.hide_set(False)
arm.animation_data.action = None
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()

# restore visibility of everything for export (glTF export skips hidden-from-render objects
# depending on settings, so make sure nothing relevant is excluded)
for n in ["avaturn_hair_0", "avaturn_hair_1", "avaturn_glasses_0", "avaturn_glasses_1", "avaturn_look_0"]:
    o = bpy.data.objects.get(n)
    if o:
        o.hide_set(False)
        o.hide_viewport = False
        o.hide_render = False
body.hide_set(False)
body.hide_viewport = False
body.hide_render = False
arm.hide_viewport = False
arm.hide_render = False

bpy.ops.wm.save_mainfile()
print("Saved avatar_rig_source.blend")

# confirm NLA strips still correct before export
for t in arm.animation_data.nla_tracks:
    for s in t.strips:
        print(f"NLA track='{t.name}' strip='{s.name}' influence={s.influence} mute={s.mute} action={s.action.name if s.action else None}")

print("Shape keys at save time:", [k.name for k in body.data.shape_keys.key_blocks])
