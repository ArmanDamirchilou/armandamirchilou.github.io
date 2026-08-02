import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

// The site's source-of-truth model (MetaPerson / Avatar SDK export with a full
// ARKit blendshape set: jawOpen, mouthFunnel, mouthPucker, mouthStretch*,
// mouthSmile*, browInnerUp, eyeBlink*, etc.). The mouth is driven live from the
// speech amplitude by cycling ARKit "viseme" poses, so lips articulate instead
// of just flapping. If the model ever ships "Idle"/"Talking" clips they play
// automatically; otherwise procedural head/neck motion keeps it alive.
const MODEL_URL = '/model.glb';
useGLTF.preload(MODEL_URL);

export interface AvatarMeasurement {
  box: THREE.Box3;
  headWorldY: number;
  centerX: number;
  centerZ: number;
}

type Emotion = 'neutral' | 'happy' | 'thinking' | 'surprised' | 'concerned';

interface AvatarProps {
  isSpeaking: boolean;
  isThinking: boolean;
  audioLevel: number;
  emotion: Emotion;
  onMeasured?: (m: AvatarMeasurement) => void;
}

interface BaseBone {
  b: THREE.Object3D;
  x: number;
  y: number;
  z: number;
}

const cap = (b: THREE.Object3D | null): BaseBone | null =>
  b ? { b, x: b.rotation.x, y: b.rotation.y, z: b.rotation.z } : null;

// ARKit "viseme" poses — each is a blend of real ARKit blendshapes that reads
// as a distinct mouth shape. Cycling these while speaking produces natural
// articulation. Weights are 0..1 and get scaled by live speech amplitude.
const VISEMES: Record<string, Record<string, number>> = {
  aa: { jawOpen: 0.95, mouthLowerDownLeft: 0.35, mouthLowerDownRight: 0.35 },
  E: { jawOpen: 0.4, mouthStretchLeft: 0.5, mouthStretchRight: 0.5, mouthUpperUpLeft: 0.25, mouthUpperUpRight: 0.25 },
  O: { jawOpen: 0.55, mouthFunnel: 0.65, mouthPucker: 0.25 },
  U: { jawOpen: 0.22, mouthPucker: 0.7, mouthFunnel: 0.35 },
  M: { jawOpen: 0.03, mouthClose: 0.25, mouthPressLeft: 0.2, mouthPressRight: 0.2 },
  L: { jawOpen: 0.45, mouthLowerDownLeft: 0.3, mouthLowerDownRight: 0.3, mouthUpperUpLeft: 0.15, mouthUpperUpRight: 0.15 },
};
const VISEME_KEYS = Object.keys(VISEMES);

// Every mouth blendshape the viseme system may touch (so unused ones ease to 0).
const MOUTH_NAMES = Array.from(
  new Set(VISEME_KEYS.flatMap((k) => Object.keys(VISEMES[k])))
);

// Emotion → ARKit expression targets (layered on top, never fight the mouth).
const EMOTION_EXPR: Record<Emotion, Record<string, number>> = {
  neutral: { mouthSmileLeft: 0.06, mouthSmileRight: 0.06 },
  happy: { mouthSmileLeft: 0.5, mouthSmileRight: 0.5, browInnerUp: 0.1, cheekSquintLeft: 0.2, cheekSquintRight: 0.2 },
  thinking: { browDownLeft: 0.3, browDownRight: 0.3, mouthPressLeft: 0.12, mouthPressRight: 0.12 },
  surprised: { browInnerUp: 0.6, browOuterUpLeft: 0.4, browOuterUpRight: 0.4, eyeWideLeft: 0.4, eyeWideRight: 0.4 },
  concerned: { browInnerUp: 0.35, mouthFrownLeft: 0.25, mouthFrownRight: 0.25 },
};
const EXPR_NAMES = Array.from(
  new Set(Object.values(EMOTION_EXPR).flatMap((e) => Object.keys(e)))
);

export function Avatar({ isSpeaking, isThinking, audioLevel, emotion, onMeasured }: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL);

  // SkeletonUtils clone preserves skinning + lets us mount multiple instances.
  const model = useMemo(() => {
    const c = skeletonClone(scene) as THREE.Group;
    c.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          // Clone into a local first — assigning back to mesh.material widens
          // the type to Material and loses envMapIntensity.
          const mat = mesh.material.clone();
          mat.envMapIntensity = 1.15;
          mesh.material = mat;
        }
      }
    });
    return c;
  }, [scene]);

  const { actions } = useAnimations(animations, model);
  const hasClips = !!(actions['Idle'] || actions['Talking']);

  useEffect(() => {
    if (!hasClips) return;
    const idle = actions['Idle'];
    const talk = actions['Talking'];
    if (idle) { idle.reset().play(); idle.setEffectiveWeight(1); }
    if (talk) { talk.reset().play(); talk.setEffectiveWeight(0); }
  }, [actions, hasClips]);

  useEffect(() => {
    if (!hasClips) return;
    const idle = actions['Idle'];
    const talk = actions['Talking'];
    if (isSpeaking) { talk?.fadeIn(0.4); idle?.fadeOut(0.4); }
    else { idle?.fadeIn(0.5); talk?.fadeOut(0.5); }
  }, [isSpeaking, actions, hasClips]);

  // Procedural fallback: capture rest rotations of head / neck / spine only.
  const bones = useMemo(() => {
    if (hasClips) return { head: null, neck: null, spine: null };
    const get = (n: string) => model.getObjectByName(n);
    return {
      head: cap(get('Head') ?? null),
      neck: cap(get('Neck') ?? get('Neck1') ?? null),
      spine: cap(get('Spine2') ?? get('Spine1') ?? get('Spine') ?? null),
    };
  }, [model, hasClips]);

  // Index every blendshape by its (lowercased) ARKit name → the meshes that
  // carry it. A shape like jawOpen lives on both the face and the teeth mesh,
  // so we drive all of them together.
  const morphMap = useMemo(() => {
    const map = new Map<string, { mesh: THREE.Mesh; index: number }[]>();
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.morphTargetDictionary) return;
      for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ mesh, index: idx });
      }
    });
    return map;
  }, [model]);

  const hasBlink = morphMap.has('eyeblinkleft') || morphMap.has('eyeblinkright');

  // Measure once for camera framing.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!groupRef.current) return;
      groupRef.current.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(groupRef.current);
      const center = new THREE.Vector3();
      box.getCenter(center);
      let headWorldY = box.max.y - (box.max.y - box.min.y) * 0.12;
      const head = model.getObjectByName('Head');
      if (head) {
        const hp = new THREE.Vector3();
        head.getWorldPosition(hp);
        headWorldY = hp.y;
      }
      onMeasured?.({ box, headWorldY, centerX: center.x, centerZ: center.z });
    });
    return () => cancelAnimationFrame(raf);
  }, [model, onMeasured]);

  // Live-driver state — smoothed weights we own, keyed by ARKit name.
  const weights = useRef<Record<string, number>>({});
  const blinkTimer = useRef(2.5);
  const voice = useRef(0);
  const viseme = useRef('M');
  const visemeTimer = useRef(0);
  const microBrowTimer = useRef(4);

  const writeMorph = (name: string, value: number) => {
    const refs = morphMap.get(name.toLowerCase());
    if (!refs) return;
    for (const { mesh, index } of refs) {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = value;
    }
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const speak = isSpeaking ? THREE.MathUtils.clamp(audioLevel, 0, 1) : 0;
    // Smooth the amplitude so the jaw doesn't jitter (frame-rate independent).
    voice.current += (speak - voice.current) * (1 - Math.exp(-delta * 18));
    const v = voice.current;

    if (hasClips) {
      const talk = actions['Talking'];
      if (talk && isSpeaking) talk.timeScale = 0.9 + v * 0.5;
    } else {
      // Procedural upper-body life (head / neck / breathing only).
      const driftX = Math.sin(t * 0.5);
      const driftY = Math.sin(t * 0.37 + 1.2);
      const breath = Math.sin(t * 0.9);
      const nod = Math.sin(t * 6.5) * v;
      const sway = Math.sin(t * 2.3 + 0.5);
      const think = isThinking ? 0.6 : 0;

      if (bones.head) {
        const h = bones.head;
        h.b.rotation.x = h.x + driftX * 0.04 + nod * 0.05 - think * 0.04;
        h.b.rotation.y = h.y + driftY * 0.06 + sway * v * 0.05 + think * 0.05;
        h.b.rotation.z = h.z + Math.sin(t * 0.6) * 0.02;
      }
      if (bones.neck) {
        const n = bones.neck;
        n.b.rotation.x = n.x + driftX * 0.02 + nod * 0.025;
        n.b.rotation.y = n.y + driftY * 0.03;
      }
      if (bones.spine) {
        const s = bones.spine;
        s.b.rotation.x = s.x + breath * 0.012 + v * 0.01;
      }
    }

    // ── Build this frame's target weights ──────────────────────────────────
    const target: Record<string, number> = {};

    // Mouth: cycle viseme poses while speaking so the lips keep reshaping.
    if (isSpeaking && v > 0.02) {
      visemeTimer.current -= delta;
      if (visemeTimer.current <= 0) {
        const opts = VISEME_KEYS.filter((k) => k !== viseme.current);
        viseme.current = opts[Math.floor(Math.random() * opts.length)];
        visemeTimer.current = 0.09 + Math.random() * 0.06;
      }
      const pose = VISEMES[viseme.current];
      const gain = THREE.MathUtils.clamp(v * 1.15 + 0.15, 0, 1);
      for (const [name, w] of Object.entries(pose)) target[name] = w * gain;
      // Guarantee jaw openness tracks loudness even mid-pose.
      target.jawOpen = Math.max(target.jawOpen ?? 0, v * 0.6);
    }

    // Expressions from emotion (+ a rare micro brow-raise for life).
    microBrowTimer.current -= delta;
    let microBrow = 0;
    if (microBrowTimer.current < 0.5 && microBrowTimer.current > 0) {
      microBrow = 0.25 * (1 - Math.abs(microBrowTimer.current - 0.25) / 0.25);
    }
    if (microBrowTimer.current <= 0) microBrowTimer.current = 4 + Math.random() * 4;

    const expr = EMOTION_EXPR[emotion] ?? EMOTION_EXPR.neutral;
    for (const [name, w] of Object.entries(expr)) {
      target[name] = (target[name] ?? 0) + w;
    }
    target.browInnerUp = (target.browInnerUp ?? 0) + microBrow;

    // ── Ease every controlled morph toward its target and write it ─────────
    const mouthK = 1 - Math.exp(-delta * 22); // snappy mouth
    const exprK = 1 - Math.exp(-delta * 7); // slow expressions
    const w = weights.current;
    for (const name of MOUTH_NAMES) {
      const tv = target[name] ?? 0;
      w[name] = (w[name] ?? 0) + (tv - (w[name] ?? 0)) * mouthK;
      writeMorph(name, w[name]);
    }
    for (const name of EXPR_NAMES) {
      if (MOUTH_NAMES.includes(name)) continue; // already handled above
      const tv = target[name] ?? 0;
      w[name] = (w[name] ?? 0) + (tv - (w[name] ?? 0)) * exprK;
      writeMorph(name, w[name]);
    }

    // ── Blink (independent of everything else) ─────────────────────────────
    if (hasBlink) {
      blinkTimer.current -= delta;
      const phase = blinkTimer.current;
      let blink = 0;
      if (phase < 0.18) blink = THREE.MathUtils.clamp(1 - Math.abs(phase - 0.09) / 0.09, 0, 1);
      if (phase <= 0) blinkTimer.current = 2.5 + Math.random() * 3.5;
      writeMorph('eyeBlinkLeft', blink);
      writeMorph('eyeBlinkRight', blink);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}
