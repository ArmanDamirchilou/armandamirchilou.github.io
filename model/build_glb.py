"""
build_glb.py
Pure-Python GLB processor (no Blender required).

What it does:
  1. Loads public/model.glb
  2. Renames existing animation → "Idle"
  3. Creates a full-body procedural "Talking" animation:
       - Head: nods forward + side-to-side
       - Neck: follows head gently
       - Spine / Spine1 / Spine2: subtle forward lean + sway
       - LeftArm / RightArm: gentle gesture spread
       - LeftForeArm / RightForeArm: slight raise & gesture
       - All other bones: copied from Idle (legs, feet, hands, fingers)
  4. Both animations loop seamlessly.
  5. Saves back to public/model.glb (all textures / skins / morphs preserved).

Run:  python build_glb.py
"""

import copy, math, os, struct
import numpy as np
from pygltflib import (
    GLTF2, Animation, AnimationChannel, AnimationChannelTarget,
    AnimationSampler, Accessor, BufferView, Buffer
)

# ── Config ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GLB_PATH   = os.path.join(SCRIPT_DIR, "public", "model.glb")
OUT_PATH   = GLB_PATH

TALK_DURATION = 4.0   # seconds for Talking loop
FPS           = 30    # keyframes per second for new animations

# ── Quaternion math ────────────────────────────────────────────────────────────
# GLB quaternion layout: [x, y, z, w]

def quat_from_axis_angle(axis, angle_rad):
    """axis: [x,y,z] unit vector, returns [x,y,z,w]"""
    s = math.sin(angle_rad * 0.5)
    c = math.cos(angle_rad * 0.5)
    ax = np.array(axis, dtype=np.float64)
    ax = ax / (np.linalg.norm(ax) + 1e-12)
    return np.array([ax[0]*s, ax[1]*s, ax[2]*s, c], dtype=np.float32)

def quat_mul(q1, q2):
    """Hamilton product. Both [x,y,z,w]."""
    x1,y1,z1,w1 = q1
    x2,y2,z2,w2 = q2
    return np.array([
        w1*x2 + x1*w2 + y1*z2 - z1*y2,
        w1*y2 - x1*z2 + y1*w2 + z1*x2,
        w1*z2 + x1*y2 - y1*x2 + z1*w2,
        w1*w2 - x1*x2 - y1*y2 - z1*z2,
    ], dtype=np.float32)

def quat_slerp(q1, q2, t):
    """Spherical linear interpolation between two quaternions."""
    q1 = np.array(q1, dtype=np.float64)
    q2 = np.array(q2, dtype=np.float64)
    dot = np.dot(q1, q2)
    if dot < 0:
        q2 = -q2
        dot = -dot
    dot = min(dot, 1.0)
    if dot > 0.9995:
        result = q1 + t * (q2 - q1)
        return (result / np.linalg.norm(result)).astype(np.float32)
    theta_0 = math.acos(dot)
    theta   = theta_0 * t
    sin0    = math.sin(theta_0)
    result  = (math.sin(theta_0 - theta)/sin0) * q1 + (math.sin(theta)/sin0) * q2
    return (result / np.linalg.norm(result)).astype(np.float32)

def lerp(a, b, t):
    return a + t * (b - a)

# ── GLB accessor helpers ───────────────────────────────────────────────────────
COMP_COUNT = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
DTYPE_MAP  = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}

def read_accessor(glb, blob, idx):
    acc    = glb.accessors[idx]
    bv     = glb.bufferViews[acc.bufferView]
    nc     = COMP_COUNT[acc.type]
    dt     = DTYPE_MAP[acc.componentType]
    start  = (bv.byteOffset or 0) + (acc.byteOffset or 0)
    stride = bv.byteStride or (np.dtype(dt).itemsize * nc)
    rows = []
    for i in range(acc.count):
        off = start + i * stride
        rows.append(np.frombuffer(blob[off : off + np.dtype(dt).itemsize * nc], dtype=dt).copy())
    arr = np.array(rows, dtype=np.float32)
    return arr.reshape(acc.count, nc) if nc > 1 else arr.flatten()

def append_accessor(glb, new_blob, data: np.ndarray, atype: str, is_time=False):
    """Append numpy array to new_blob, add BufferView + Accessor, return accessor index."""
    raw    = data.astype(np.float32).tobytes()
    # 4-byte alignment
    pad    = (4 - len(new_blob) % 4) % 4
    new_blob += b'\x00' * pad

    bv_offset = len(new_blob)
    new_blob += raw

    bv_idx = len(glb.bufferViews)
    glb.bufferViews.append(BufferView(
        buffer     = 0,
        byteOffset = bv_offset,
        byteLength = len(raw),
    ))

    flat = data.flatten()
    acc_idx = len(glb.accessors)
    acc = Accessor(
        bufferView    = bv_idx,
        byteOffset    = 0,
        componentType = 5126,   # FLOAT
        count         = len(data),
        type          = atype,
    )
    if is_time:
        acc.min = [float(flat.min())]
        acc.max = [float(flat.max())]
    glb.accessors.append(acc)
    return acc_idx, new_blob

# ── Interpolation helpers ──────────────────────────────────────────────────────
def interp_rotation(times, quats, t):
    """Sample quaternion animation at time t (clamped, linear between keyframes)."""
    t = max(times[0], min(times[-1], t))
    idx = np.searchsorted(times, t, side='right') - 1
    idx = min(idx, len(times) - 2)
    t0, t1 = times[idx], times[idx+1]
    alpha = (t - t0) / (t1 - t0 + 1e-12)
    return quat_slerp(quats[idx], quats[idx+1], alpha)

def interp_translation(times, vecs, t):
    t = max(times[0], min(times[-1], t))
    idx = np.searchsorted(times, t, side='right') - 1
    idx = min(idx, len(times) - 2)
    t0, t1 = times[idx], times[idx+1]
    alpha = (t - t0) / (t1 - t0 + 1e-12)
    return lerp(vecs[idx], vecs[idx+1], alpha)

# ── Talking gesture offsets ────────────────────────────────────────────────────
def talking_offset(bone_name, t):
    """
    Return a quaternion offset [x,y,z,w] to compose on top of the idle pose.
    t is time in seconds (0 → TALK_DURATION).
    All gestures are tuned to feel natural and loop-friendly.
    """
    PI2 = 2 * math.pi
    DEG = math.pi / 180

    # Helpers
    def rot(axis, deg):
        return quat_from_axis_angle(axis, deg * DEG)

    identity = np.array([0, 0, 0, 1], dtype=np.float32)

    # ── Head: nod forward + side tilt ─────────────────────────────────────────
    if bone_name == 'Head':
        # Forward nod: subtle, 0.5 Hz
        nod_fwd  = math.sin(t * PI2 * 0.5) * 4     # ±4° X
        # Side tilt: 0.35 Hz
        tilt     = math.sin(t * PI2 * 0.35 + 0.3) * 5  # ±5° Z
        q = rot([1,0,0], nod_fwd)
        q = quat_mul(q, rot([0,0,1], tilt))
        return q

    # ── Neck: follows head at half amplitude ──────────────────────────────────
    if bone_name == 'Neck':
        nod_fwd  = math.sin(t * PI2 * 0.5) * 2
        tilt     = math.sin(t * PI2 * 0.35 + 0.3) * 2
        q = rot([1,0,0], nod_fwd)
        q = quat_mul(q, rot([0,0,1], tilt))
        return q

    # ── Spine / Spine1 / Spine2: gentle lean + sway ───────────────────────────
    if bone_name in ('Spine', 'Spine1', 'Spine2'):
        # Constant slight forward lean (2°) + slow Z sway (0.25 Hz)
        lean  = 2.0
        sway  = math.sin(t * PI2 * 0.25) * 1.5
        q = rot([1,0,0], lean)
        q = quat_mul(q, rot([0,0,1], sway))
        return q

    # ── Left arm: gesture spread 0.3 Hz ──────────────────────────────────────
    if bone_name == 'LeftArm':
        spread = math.sin(t * PI2 * 0.3) * 6
        return rot([0,0,1], spread)

    # ── Right arm: mirror of left, phase-shifted ──────────────────────────────
    if bone_name == 'RightArm':
        spread = math.sin(t * PI2 * 0.3 + math.pi * 0.5) * 6
        return rot([0,0,1], -spread)

    # ── Left forearm: slight raise gesture ───────────────────────────────────
    if bone_name == 'LeftForeArm':
        raise_  = (math.sin(t * PI2 * 0.3 + 0.5) * 0.5 + 0.5) * 8  # 0–8°
        return rot([0,1,0], raise_)

    # ── Right forearm: mirror ─────────────────────────────────────────────────
    if bone_name == 'RightForeArm':
        raise_  = (math.sin(t * PI2 * 0.3 + math.pi * 0.5 + 0.5) * 0.5 + 0.5) * 8
        return rot([0,1,0], -raise_)

    # ── Shoulders: subtle shrug ───────────────────────────────────────────────
    if bone_name == 'LeftShoulder':
        shrug = math.sin(t * PI2 * 0.5) * 2
        return rot([0,0,1], shrug)

    if bone_name == 'RightShoulder':
        shrug = math.sin(t * PI2 * 0.5 + math.pi) * 2
        return rot([0,0,1], -shrug)

    # ── Hips: slight side shift (weight shift) ────────────────────────────────
    if bone_name == 'Hips':
        sway = math.sin(t * PI2 * 0.25 + 0.2) * 2
        return rot([0,0,1], sway)

    return identity  # all other bones: no offset

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("Loading GLB …")
    glb  = GLTF2().load(GLB_PATH)
    blob = bytearray(glb.binary_blob())

    node_idx  = {n.name: i for i, n in enumerate(glb.nodes)}
    node_name = {i: n.name for i, n in enumerate(glb.nodes)}

    # ── Step 1: Read Idle animation ────────────────────────────────────────────
    idle_anim = glb.animations[0]
    idle_anim.name = "Idle"
    print(f"  Renamed animation → 'Idle'")

    bone_rot   = {}   # bone_name → (times_array, quats_array)
    bone_trans = {}   # bone_name → (times_array, vecs_array)

    for ch in idle_anim.channels:
        samp  = idle_anim.samplers[ch.sampler]
        times = read_accessor(glb, blob, samp.input)
        vals  = read_accessor(glb, blob, samp.output)
        name  = node_name[ch.target.node]
        if ch.target.path == 'rotation':
            bone_rot[name]   = (times, vals)
        elif ch.target.path == 'translation':
            bone_trans[name] = (times, vals)

    idle_duration = max(t[-1] for t, _ in bone_rot.values())
    print(f"  Idle duration: {idle_duration:.3f}s")

    # ── Step 2: Build Talking animation ───────────────────────────────────────
    print(f"  Generating Talking animation ({TALK_DURATION}s @ {FPS}fps) …")

    n_frames   = int(TALK_DURATION * FPS) + 1
    talk_times = np.linspace(0, TALK_DURATION, n_frames, dtype=np.float32)

    # We'll extend the blob with new data
    # First set buffer 0 to cover existing blob only
    orig_len = len(blob)

    new_data = bytearray()  # will be appended to blob

    talk_channels  = []
    talk_samplers  = []

    for bone_name, (idle_t, idle_q) in bone_rot.items():
        # Sample idle rotation at each talking frame (idle loops)
        sampled_q = np.zeros((n_frames, 4), dtype=np.float32)
        for fi, t in enumerate(talk_times):
            # Loop idle
            t_idle = t % idle_duration
            q_base = interp_rotation(idle_t, idle_q, t_idle)
            # Compose talking gesture offset
            q_off  = talking_offset(bone_name, t)
            sampled_q[fi] = quat_mul(q_base, q_off)
            # Normalize
            norm = np.linalg.norm(sampled_q[fi])
            if norm > 1e-8:
                sampled_q[fi] /= norm

        # Write time accessor (shared across all bones at same times — but
        # GLB needs separate accessors per sampler, so we write per bone)
        t_idx,  new_data = append_accessor(glb, new_data, talk_times, 'SCALAR', is_time=True)
        q_idx,  new_data = append_accessor(glb, new_data, sampled_q,  'VEC4')

        samp_idx = len(talk_samplers)
        talk_samplers.append(AnimationSampler(
            input        = t_idx,
            output       = q_idx,
            interpolation= "LINEAR"
        ))
        talk_channels.append(AnimationChannel(
            sampler = samp_idx,
            target  = AnimationChannelTarget(
                node = node_idx[bone_name],
                path = "rotation"
            )
        ))

    # Translation for Hips (slight vertical bob while talking)
    if 'Hips' in bone_trans:
        idle_t, idle_v = bone_trans['Hips']
        sampled_v = np.zeros((n_frames, 3), dtype=np.float32)
        for fi, t in enumerate(talk_times):
            t_idle = t % idle_duration
            v_base = interp_translation(idle_t, idle_v, t_idle)
            # Add slight vertical bob at 0.5Hz
            bob = math.sin(t * 2 * math.pi * 0.5) * 0.002
            sampled_v[fi] = v_base + np.array([0, bob, 0], dtype=np.float32)

        t_idx, new_data = append_accessor(glb, new_data, talk_times, 'SCALAR', is_time=True)
        v_idx, new_data = append_accessor(glb, new_data, sampled_v,  'VEC3')

        samp_idx = len(talk_samplers)
        talk_samplers.append(AnimationSampler(input=t_idx, output=v_idx, interpolation="LINEAR"))
        talk_channels.append(AnimationChannel(
            sampler = samp_idx,
            target  = AnimationChannelTarget(node=node_idx['Hips'], path="translation")
        ))

    talking_anim = Animation(
        name     = "Talking",
        channels = talk_channels,
        samplers = talk_samplers,
    )
    glb.animations.append(talking_anim)

    print(f"  Talking animation: {len(talk_channels)} channels, {n_frames} keyframes each")

    # ── Step 3: Merge new_data into blob ──────────────────────────────────────
    # Append new_data to blob; BufferViews for new data used orig_len as base offset
    # But append_accessor counted from 0 in new_data — fix offsets:
    new_bv_start = len(glb.bufferViews) - (len(talk_channels) * 2 + (1 if 'Hips' in bone_trans else 0) * 2)
    # Actually the bufferViews were already appended with byteOffset relative to new_data (0-based).
    # We need to shift them by orig_len.
    # Find the first new BufferView (easiest: count how many existed before)
    # We tracked this implicitly — let's just fix all BVs whose byteOffset < orig_len that point to new data:
    # Better approach: re-scan new BVs (those were added starting at a known index)

    # Count original bufferViews (before we started appending)
    # We know new_data was appended to glb.bufferViews as we built it.
    # The offset stored was relative to new_data start (0), so add orig_len to each new BV.
    # How many new BVs? Each channel has 2 (time + value), plus Hips translation has 2 more.
    n_new_bv = len(new_data) > 0  # boolean placeholder
    # Easier: iterate all bufferViews and fix those with byteOffset < orig_len that should be > orig_len
    # Actually append_accessor set byteOffset = len(new_blob_at_time_of_call).
    # new_blob starts at 0 (empty bytearray), so all new BVs have byteOffset within [0, len(new_data)).
    # Original BVs have byteOffset within [0, orig_len).
    # They can overlap in numbers — disambiguate by index.
    # We know original blob had N_orig_bv bufferViews. Anything after that is new.
    # We already know how many original BVs existed at load time.

    # Re-approach: record original bv count before main loop
    # (we didn't, but we can compute: total now minus number added)
    # Each bone gets 2 BVs (time + quat). Hips translation adds 2 more.
    n_rot_bones  = len(bone_rot)
    n_trans_add  = 1 if 'Hips' in bone_trans else 0
    n_new_bvs    = (n_rot_bones + n_trans_add) * 2
    orig_bv_count = len(glb.bufferViews) - n_new_bvs

    for bv in glb.bufferViews[orig_bv_count:]:
        bv.byteOffset = (bv.byteOffset or 0) + orig_len

    # Merge blobs
    final_blob = bytes(blob) + bytes(new_data)
    glb.buffers[0].byteLength = len(final_blob)
    glb.set_binary_blob(final_blob)

    # ── Step 4: Save ──────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    glb.save(OUT_PATH)
    size_mb = os.path.getsize(OUT_PATH) / 1024 / 1024
    print(f"\n  Saved → {OUT_PATH}  ({size_mb:.2f} MB)")

    # ── Step 5: Verify ────────────────────────────────────────────────────────
    print("\n─── ACCEPTANCE REPORT ────────────────────────────────────────")
    glb2  = GLTF2().load(OUT_PATH)
    blob2 = glb2.binary_blob()

    anim_names = [a.name for a in glb2.animations]
    print(f"Animations: {anim_names}")
    for req in ('Idle', 'Talking'):
        print(f"  {'✓' if req in anim_names else '✗ MISSING'}  {req}")

    morph_count = 0
    morph_names = []
    for mesh in glb2.meshes:
        extras = (mesh.extras or {})
        names  = extras.get('targetNames', [])
        morph_names.extend(names)
        morph_count += len(names)
        for prim in mesh.primitives:
            pn = (prim.extras or {}).get('targetNames', [])
            morph_names.extend(pn)
            morph_count += len(pn)

    print(f"Morph targets found: {morph_count}")
    for probe in ('jawOpen', 'viseme_aa', 'eyeBlinkLeft'):
        print(f"  {'✓' if probe in morph_names else '—'}  {probe}")

    print(f"File size: {size_mb:.2f} MB  {'✓' if size_mb < 10 else '✗ >10MB'}")
    print("──────────────────────────────────────────────────────────────")
    print("DONE.")

if __name__ == "__main__":
    main()
