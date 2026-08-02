# Getting Real Lip-Sync (Moving Mouth)

## The current situation

Your `model.glb` was exported from Avaturn **without facial blendshapes**. I checked the file:

- **0 morph targets** (no mouth/eye/eyebrow shapes)
- **52 bones**, but the skeleton **ends at `Head`** — there is no `Jaw` bone

This means the face is a single rigid mesh. There is physically nothing in the file to move the lips with. The site currently fakes "talking" with head, neck, and shoulder motion driven by the audio volume, which reads well from a distance but the lips do not actually part.

To get a **real moving mouth**, you need a model that has either ARKit blendshapes or a jaw bone. You have two paths.

---

## Path A — Re-export from Avaturn with blendshapes (easiest, 5 minutes)

1. Go to [avaturn.me](https://avaturn.me) and open your avatar.
2. In the **Export** dialog, enable:
   - **"Morph targets / Blendshapes"** (sometimes labeled "ARKit blendshapes" or "Visemes")
3. Download the new `.glb` and replace `public/model.glb`.
4. Tell me it's done. The lip-sync system is already written to detect ARKit shapes
   (`jawOpen`, `mouthClose`, `viseme_*`) and drive them from the audio automatically.

This is the recommended path. Avaturn ARKit avatars include 52 standard blendshapes
that map 1:1 to what the lip-sync engine expects.

---

## Path B — Add visemes in Blender (full control, ~30 minutes)

If you want custom mouth shapes:

1. Open `model.glb` in **Blender** (File > Import > glTF 2.0).
2. Select the head mesh, go to **Object Data Properties > Shape Keys**.
3. Add shape keys for the core visemes: `AA` (open), `OH` (round), `EE` (wide),
   `MM/PP` (closed), and a neutral `Basis`.
4. Sculpt each shape key by moving the lip/jaw vertices.
5. Export back to glTF 2.0 **with "Shape Keys" checked**, replace `public/model.glb`.

I can wire any naming convention you use into the lip-sync engine.

---

## What already works regardless of the model

- **Voice**: your real cloned voice answers every question (XTTS v2, local, on your GPU).
- **Audio-reactive motion**: head nods, micro-tilts, breathing, and torso sway scale
  with your voice amplitude in real time.
- **Eye and brow motion**: ready to switch on the moment blendshapes exist.

Once you drop in a blendshape-enabled model, the mouth starts moving with zero extra
work from you.
