import bpy

body = bpy.data.objects.get("avaturn_body.001")
print("Body object found:", body is not None)
if body and body.data.shape_keys:
    keys = [k.name for k in body.data.shape_keys.key_blocks]
    print("SHAPE KEYS (%d total):" % len(keys), keys)
    expected = ["Basis", "jawOpen", "mouthOpen", "mouthLowerDown", "viseme_aa", "viseme_o",
                "viseme_u", "viseme_e", "viseme_i", "eyeBlinkLeft", "eyeBlinkRight",
                "mouthSmile", "mouthFrown", "browInnerUp", "browDown"]
    missing = [e for e in expected if e not in keys]
    extra = [k for k in keys if k not in expected]
    print("Expected 15 (Basis+14). Missing:", missing, "Extra:", extra)
else:
    print("NO SHAPE KEYS FOUND")
