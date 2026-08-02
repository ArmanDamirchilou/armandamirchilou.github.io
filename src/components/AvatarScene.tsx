import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { Avatar, type AvatarMeasurement } from './Avatar';
import * as THREE from 'three';

type Framing = 'closeup' | 'portrait' | 'bust' | 'full';

interface AvatarSceneProps {
  isSpeaking: boolean;
  isThinking: boolean;
  audioLevel: number;
  emotion: 'neutral' | 'happy' | 'thinking' | 'surprised' | 'concerned';
  /** 'closeup' = face only, 'portrait' = head+shoulders, 'bust', 'full' = whole body */
  framing?: Framing;
  /** push subject to the right so hero text sits on the left */
  offsetRight?: boolean;
  /** decorative homepage instance: no shadows, no controls, lighter — cheaper */
  decorative?: boolean;
}

function SceneLighting({ decorative }: { decorative: boolean }) {
  return (
    <>
      <directionalLight
        position={[3, 4, 5]}
        intensity={2.1}
        color="#ffffff"
        castShadow={!decorative}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={12}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0009}
      />
      <directionalLight position={[-3, 2, 3]} intensity={0.9} color="#eef2ff" />
      <directionalLight position={[0, 3, -4]} intensity={1.5} color="#ffffff" />
      <ambientLight intensity={0.55} color="#ffffff" />
      <pointLight position={[0, -0.4, 2.4]} intensity={0.5} color="#ffffff" distance={7} />
    </>
  );
}

/**
 * Reads the measured avatar bounds and drives the camera so the face is framed,
 * regardless of the model's internal scale/origin.
 */
function CameraRig({
  measurement,
  framing,
  offsetRight,
  controlsRef,
}: {
  measurement: AvatarMeasurement | null;
  framing: Framing;
  offsetRight: boolean;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera, size } = useThree();
  const applied = useRef<string>('');

  useFrame(() => {
    if (!measurement) return;

    const aspect = size.width / size.height;
    const key = `${framing}|${offsetRight}|${aspect.toFixed(2)}`;
    if (applied.current === key) return;
    applied.current = key;

    const { box, headWorldY } = measurement;
    const H = box.max.y - box.min.y;
    const top = box.max.y;
    const subjectX = (box.min.x + box.max.x) / 2;
    const subjectZ = box.max.z;

    const fov = (camera as THREE.PerspectiveCamera).fov;
    const fovRad = (fov * Math.PI) / 180;

    const faceY = (headWorldY + top) / 2 + 0.02 * H;
    let centerY: number;
    let windowH: number;
    if (framing === 'closeup') {
      // Tight face crop (just above head to collarbones) — hides the arms.
      windowH = 0.24 * H;
      centerY = faceY - windowH * 0.22;
    } else if (framing === 'portrait') {
      windowH = 0.34 * H;
      centerY = faceY - windowH * 0.34;
    } else if (framing === 'bust') {
      windowH = 0.46 * H;
      centerY = faceY - windowH * 0.18;
    } else {
      windowH = H * 1.12;
      centerY = (box.min.y + box.max.y) / 2;
    }

    const dist = (windowH / 2) / Math.tan(fovRad / 2) * 1.04;

    let targetX = subjectX;
    if (offsetRight && aspect > 1) {
      const halfW = dist * Math.tan(fovRad / 2) * aspect;
      targetX = subjectX - Math.min(0.34 * halfW, 0.5 * H);
    }

    camera.position.set(targetX, centerY + 0.03 * H, subjectZ + dist);
    camera.lookAt(targetX, centerY, subjectZ);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(targetX, centerY, subjectZ);
      controlsRef.current.minDistance = dist * 0.65;
      controlsRef.current.maxDistance = dist * 1.6;
      controlsRef.current.update();
    }
  });

  return null;
}

function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.25, 20, 20]} />
      <meshStandardMaterial color="#111111" wireframe />
    </mesh>
  );
}

export function AvatarScene({
  isSpeaking,
  isThinking,
  audioLevel,
  emotion,
  framing = 'bust',
  offsetRight = true,
  decorative = false,
}: AvatarSceneProps) {
  const [measurement, setMeasurement] = useState<AvatarMeasurement | null>(null);
  const controlsRef = useRef<any>(null);
  const handleMeasured = useCallback((m: AvatarMeasurement) => setMeasurement(m), []);

  // Pause the render loop entirely when the canvas is scrolled out of view or
  // the tab is hidden — this is what frees the GPU so the page scrolls smoothly.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      threshold: 0.01,
    });
    io.observe(el);
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  const frameloop = onScreen && tabVisible ? 'always' : 'never';

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <Canvas
        frameloop={frameloop}
        shadows={decorative ? false : { type: THREE.PCFShadowMap }}
        camera={{ position: [0, 1.4, 2], fov: 28, near: 0.05, far: 100 }}
        gl={{ antialias: !decorative, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, powerPreference: 'high-performance' }}
        dpr={[1, decorative ? 1.4 : 1.6]}
      >
        <SceneLighting decorative={decorative} />

        <Suspense fallback={<LoadingFallback />}>
          <Avatar
            isSpeaking={isSpeaking}
            isThinking={isThinking}
            audioLevel={audioLevel}
            emotion={emotion}
            onMeasured={handleMeasured}
          />
        </Suspense>

        {!decorative && measurement && (
          <ContactShadows
            position={[measurement.centerX, measurement.box.min.y + 0.001, measurement.centerZ]}
            opacity={0.3}
            scale={Math.max(4, (measurement.box.max.x - measurement.box.min.x) * 6)}
            blur={2.6}
            far={4}
            color="#000000"
          />
        )}

        <CameraRig
          measurement={measurement}
          framing={framing}
          offsetRight={offsetRight}
          controlsRef={controlsRef}
        />

        {!decorative && (
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 2.6}
            maxPolarAngle={Math.PI / 1.9}
            minAzimuthAngle={-Math.PI / 6}
            maxAzimuthAngle={Math.PI / 6}
            enableDamping
            dampingFactor={0.06}
            rotateSpeed={0.5}
          />
        )}
      </Canvas>
    </div>
  );
}
