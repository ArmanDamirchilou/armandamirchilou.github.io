import { useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  ContactShadows,
  MeshTransmissionMaterial,
  Float,
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useScroll, useTransform, motion, type MotionValue } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MotionButton } from './MotionButton';
import * as THREE from 'three';

interface DragState {
  rotY: number;
  rotX: number;
  active: boolean;
  lastX: number;
  lastY: number;
}

/**
 * The hero centerpiece: a faceted liquid-crystal gem in a bright studio.
 * Scroll SCRUBS it (rotates, dollies the camera, "assembles" it from small to
 * full) and freezes wherever you stop — the Apple-style scroll-cinematic. You
 * can also drag to spin it. Swap <icosahedronGeometry> for a loaded custom GLB
 * later and everything else keeps working.
 */
function HeroObject({
  progress,
  drag,
}: {
  progress: MotionValue<number>;
  drag: React.MutableRefObject<DragState>;
}) {
  const group = useRef<THREE.Group>(null!);
  const { camera } = useThree();

  useFrame((state) => {
    const p = progress.get(); // 0 → 1 across the hero scroll
    const auto = state.clock.elapsedTime * 0.12;

    if (group.current) {
      group.current.rotation.y =
        auto + p * Math.PI * 2 + drag.current.rotY + state.pointer.x * 0.25;
      group.current.rotation.x = drag.current.rotX + state.pointer.y * 0.12;

      // "assemble" from small to full over the first half of the scrub
      const s = THREE.MathUtils.lerp(0.72, 1.25, THREE.MathUtils.smoothstep(p, 0, 0.55));
      group.current.scale.setScalar(s);
    }

    // gentle camera dolly-in as you scroll
    camera.position.z = THREE.MathUtils.lerp(5.6, 4.1, p);
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      <Float speed={1.3} rotationIntensity={0.18} floatIntensity={0.5}>
        <mesh castShadow>
          <icosahedronGeometry args={[1.25, 1]} />
          <MeshTransmissionMaterial
            samples={6}
            resolution={512}
            thickness={1.4}
            roughness={0.06}
            ior={1.45}
            chromaticAberration={0.32}
            anisotropy={0.3}
            distortion={0.2}
            distortionScale={0.4}
            temporalDistortion={0.1}
            transmission={1}
            color="#ffffff"
            attenuationColor="#e9b8ff"
            attenuationDistance={2.4}
            background={new THREE.Color('#f5f3ff')}
          />
        </mesh>
        {/* glowing inner core for color + life */}
        <mesh scale={0.42}>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial
            color="#a855f7"
            emissive="#ec4899"
            emissiveIntensity={1.4}
            roughness={0.3}
          />
        </mesh>
      </Float>
    </group>
  );
}

export function HeroStudio() {
  const sectionRef = useRef<HTMLElement>(null);
  const drag = useRef<DragState>({ rotY: 0, rotX: 0, active: false, lastX: 0, lastY: 0 });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Copy gently recedes as the cinematic takes over.
  const copyOpacity = useTransform(scrollYProgress, [0, 0.45, 0.7], [1, 1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 0.7], [0, -60]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const onDown = (e: React.PointerEvent) => {
    drag.current.active = true;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.rotY += (e.clientX - drag.current.lastX) * 0.008;
    drag.current.rotX = THREE.MathUtils.clamp(
      drag.current.rotX + (e.clientY - drag.current.lastY) * 0.005,
      -0.6,
      0.6
    );
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
  };
  const onUp = () => { drag.current.active = false; };

  return (
    <section ref={sectionRef} className="hero-scroll" id="top">
      <div
        className="hero-sticky"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <div className="hero-stage-canvas">
          <Canvas
            dpr={[1, 1.8]}
            camera={{ position: [0, 0, 5.6], fov: 35 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.1,
            }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 6, 4]} intensity={2.4} color="#ffffff" castShadow />
            <directionalLight position={[-6, 2, -3]} intensity={1.6} color="#c77dff" />
            <pointLight position={[3, -2, 4]} intensity={1.4} color="#ff8ad1" />

            <Suspense fallback={null}>
              <HeroObject progress={scrollYProgress} drag={drag} />
              <ContactShadows
                position={[0, -1.7, 0]}
                opacity={0.32}
                scale={9}
                blur={2.8}
                far={4}
                color="#7c3aed"
              />
              <Environment preset="city" />
            </Suspense>

            <EffectComposer>
              <Bloom intensity={0.55} luminanceThreshold={0.55} luminanceSmoothing={0.9} mipmapBlur />
            </EffectComposer>
          </Canvas>
        </div>

        <motion.div className="hero-copy" style={{ opacity: copyOpacity, y: copyY }}>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Tehran, Iran
          </div>
          <h1>
            Building AI<br />
            <span className="gradient-text">that thinks ahead.</span>
          </h1>
          <p className="hero-subtitle">
            I'm Arman, a 16-year-old AI researcher and engineer. International
            gold medalist, self-taught since 14, shipping systems that solve real problems.
          </p>
          <div className="hero-buttons">
            <Link to="/twin" className="btn-primary">Talk to my AI twin</Link>
            <MotionButton href="#work" variant="secondary">View my work</MotionButton>
          </div>
        </motion.div>

        <motion.div className="hero-hint" style={{ opacity: hintOpacity }} aria-hidden>
          Scroll to explore · drag to spin
        </motion.div>
      </div>
    </section>
  );
}
