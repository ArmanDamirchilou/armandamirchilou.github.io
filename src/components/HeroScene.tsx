import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Float,
  Sparkles,
  Environment,
  MeshDistortMaterial,
  GradientTexture,
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { scrollState } from '../lib/scroll';

/**
 * Bright, scroll-reactive hero object: a glossy candy-glass core in violet/pink
 * that morphs and rotates on its own, AND scrubs to scroll — as you scroll the
 * first screen it spins, shrinks, intensifies its distortion and drifts up out
 * of frame. Reacts to the pointer for depth.
 */

function CoreObject() {
  const group = useRef<THREE.Group>(null!);
  const shell = useRef<THREE.Mesh>(null!);
  // MeshDistortMaterial exposes a live `distort` property we can drive per-frame.
  const mat = useRef<any>(null);
  const target = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const p = scrollState.heroProgress; // 0 → 1 across the first screen

    // Smooth pointer parallax — pointer is normalized [-1, 1].
    target.current.x = state.pointer.y * 0.25;
    target.current.y = state.pointer.x * 0.4;

    if (group.current) {
      const idleSpin = state.clock.elapsedTime * 0.12;
      group.current.rotation.x += (target.current.x - group.current.rotation.x) * 0.05;
      group.current.rotation.y +=
        (target.current.y + idleSpin + p * Math.PI * 1.1 - group.current.rotation.y) * 0.05;
      // shrink + drift up as you scroll past the hero
      const s = 1 - p * 0.3;
      group.current.scale.setScalar(s);
      group.current.position.y = p * 1.4;
    }
    if (shell.current) {
      shell.current.rotation.x -= delta * 0.08;
      shell.current.rotation.z += delta * 0.05;
    }
    if (mat.current) {
      mat.current.distort = 0.36 + p * 0.3 + Math.sin(state.clock.elapsedTime) * 0.02;
    }
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.6}>
        {/* Glossy candy-glass core */}
        <mesh castShadow>
          <icosahedronGeometry args={[1.35, 14]} />
          <MeshDistortMaterial
            ref={mat}
            distort={0.36}
            speed={1.7}
            roughness={0.12}
            metalness={0.45}
            envMapIntensity={1.1}
          >
            <GradientTexture
              stops={[0, 0.5, 1]}
              colors={['#A78BFA', '#EC4899', '#7C3AED']}
              size={256}
            />
          </MeshDistortMaterial>
        </mesh>

        {/* Faceted wireframe shell */}
        <mesh ref={shell} scale={1.9}>
          <icosahedronGeometry args={[1.35, 2]} />
          <meshBasicMaterial color="#7C3AED" wireframe transparent opacity={0.16} />
        </mesh>
      </Float>

      <Sparkles count={60} scale={[7, 5, 5]} size={3} speed={0.3} opacity={0.5} color="#7C3AED" />
    </group>
  );
}

export function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 5], fov: 38 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 5, 3]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[-5, -2, -3]} intensity={1.6} color="#EC4899" />
      <pointLight position={[0, 0, 3]} intensity={1.1} color="#A78BFA" />

      <Suspense fallback={null}>
        <CoreObject />
        <Environment preset="city" />
      </Suspense>

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
