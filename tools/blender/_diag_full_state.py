import bpy

print("\n\n========== FULL STATE DIAG ==========")
body = bpy.data.objects.get("avaturn_body")
print("SHAPE KEYS:", [k.name for k in body.data.shape_keys.key_blocks] if body.data.shape_keys else None)
print("VERTEX GROUPS on body:", [g.name for g in body.vertex_groups])
print("VERTEX COUNT:", len(body.data.vertices))

arm = bpy.data.objects.get("Armature")
print("\nNLA TRACKS:")
for t in arm.animation_data.nla_tracks:
    for s in t.strips:
        print(f"  track='{t.name}' strip='{s.name}' influence={s.influence} mute={s.mute} frames={s.frame_start}-{s.frame_end} action={s.action.name if s.action else None}")

print("\nACTIONS:", [a.name for a in bpy.data.actions])
print("BONES:", [b.name for b in arm.data.bones])
print("========== END ==========\n\n")
