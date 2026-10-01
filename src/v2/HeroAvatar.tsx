import { Suspense, useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar, type AvatarMeasurement } from '../components/Avatar';
import { GlassOrbs } from './GlassOrbs';
import { useTheme } from './theme';

/**
 * The hero's 3D portrait. The camera is a function of scroll progress: it
 * starts tight on the face from one side, swings round to the other side, and
 * settles on a head-and-shoulders shot. Progress comes in through a ref so a
 * scroll never re-renders React.
 */

// Camera keyframes over scroll progress. `win` is how much of the model's
// height fills the frame; `az` the orbit angle; `lift` raises the eye line.
const KEYS = [
  { p: 0, win: 0.235, az: 0.42, el: 0.04, lift: 0.012 },
  { p: 0.5, win: 0.28, az: -0.38, el: 0.1, lift: 0.01 },
  { p: 1, win: 0.42, az: 0.0, el: 0.02, lift: -0.02 },
];

const smooth = (t: number) => t * t * (3 - 2 * t);

function sample(p: number) {
  const x = Math.min(1, Math.max(0, p));
  let i = 0;
  while (i < KEYS.length - 2 && x > KEYS[i + 1].p) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth((x - a.p) / (b.p - a.p));
  const mix = (k: 'win' | 'az' | 'el' | 'lift') => a[k] + (b[k] - a[k]) * t;
  return { win: mix('win'), az: mix('az'), el: mix('el'), lift: mix('lift') };
}

function ScrollCamera({
  measurement,
  progress,
  pointer,
}: {
  measurement: AvatarMeasurement | null;
  progress: MutableRefObject<number>;
  pointer: MutableRefObject<{ x: number; y: number }>;
}) {
  const { camera, size } = useThree();
  const eased = useRef(0);
  const look = useRef({ x: 0, y: 0 });

  useFrame((_, dt) => {
    if (!measurement) return;
    // Ease toward the scroll position so fast flicks still read as a glide.
    const k = 1 - Math.exp(-dt * 6);
    eased.current += (progress.current - eased.current) * k;
    look.current.x += (pointer.current.x - look.current.x) * k * 0.5;
    look.current.y += (pointer.current.y - look.current.y) * k * 0.5;

    const { box, headWorldY, centerX, centerZ } = measurement;
    const H = box.max.y - box.min.y;
    const s = sample(eased.current);
    const cam = camera as THREE.PerspectiveCamera;
    const fovRad = (cam.fov * Math.PI) / 180;

    // Narrow screens crop the sides, so frame a little looser there.
    const aspect = size.width / size.height;
    const windowH = s.win * H * (aspect < 0.8 ? 1.35 : 1);
    const faceY = (headWorldY + box.max.y) / 2;
    const targetY = faceY - windowH * 0.2 + s.lift * H;
    const dist = windowH / 2 / Math.tan(fovRad / 2);

    const az = s.az + look.current.x * 0.12;
    const el = s.el + look.current.y * 0.06;

    // On wide screens the copy sits bottom-left, so aim the camera left of
    // the subject (sideways relative to the view) to move the face right.
    const halfW = dist * Math.tan(fovRad / 2) * aspect;
    const shift = aspect > 1.1 ? halfW * 0.3 : 0;
    const tx = centerX - Math.cos(az) * shift;
    const tz = centerZ + Math.sin(az) * shift;

    camera.position.set(
      tx + Math.sin(az) * Math.cos(el) * dist,
      targetY + Math.sin(el) * dist,
      tz + Math.cos(az) * Math.cos(el) * dist
    );
    camera.lookAt(tx, targetY, tz);
  });

  return null;
}

function Lights() {
  const [theme] = useTheme();
  return (
    <>
      {/* Key: soft, from camera-right, slightly warm. */}
      <directionalLight position={[2.5, 2.2, 3]} intensity={2.4} color="#fff4ea" />
      {/* Fill: dim and cool so the shadow side keeps shape. */}
      <directionalLight position={[-3, 0.8, 2]} intensity={0.35} color="#dfe6ff" />
      {/* Rims: the theme's accent on one edge (pomegranate at night, cobalt
          by day), white on the other. */}
      <directionalLight position={[-2.5, 1.8, -3]} intensity={3.2} color={theme === 'light' ? '#3891d9' : '#e0484f'} />
      <directionalLight position={[2.8, 2.4, -2.5]} intensity={1.6} color="#ffffff" />
      <ambientLight intensity={0.18} />
    </>
  );
}

export function HeroAvatar({
  progress,
  onReady,
}: {
  progress: MutableRefObject<number>;
  onReady?: () => void;
}) {
  const [measurement, setMeasurement] = useState<AvatarMeasurement | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  const handleMeasured = useCallback(
    (m: AvatarMeasurement) => {
      setMeasurement(m);
      onReady?.();
    },
    [onReady]
  );

  // The portrait turns slightly toward the cursor; no effect on touch.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Stop rendering once the hero has scrolled away; frees the GPU for the
  // rest of the page.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="v2-hero-canvas" aria-hidden>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 1.5, 1.2], fov: 26, near: 0.02, far: 50 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, powerPreference: 'high-performance' }}
        dpr={[1, 1.75]}
      >
        <Lights />
        <Suspense fallback={null}>
          <Avatar isSpeaking={false} isThinking={false} audioLevel={0} emotion="neutral" onMeasured={handleMeasured} />
        </Suspense>
        <GlassOrbs measurement={measurement} progress={progress} pointer={pointer} />
        <ScrollCamera measurement={measurement} progress={progress} pointer={pointer} />
      </Canvas>
    </div>
  );
}
