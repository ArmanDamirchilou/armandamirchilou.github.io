import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AvatarMeasurement } from '../components/Avatar';
import { useTheme } from './theme';

/**
 * Pieces of smoked glass floating around the portrait: they catch the light,
 * shimmer faintly with thin-film colour, bob gently, lean away from the
 * cursor and drift apart as the page scrolls.
 *
 * The reflections come from a procedural studio (RoomEnvironment) rather than
 * a downloaded HDR, so nothing extra loads.
 */

type Piece = {
  shape: 'sphere' | 'torus' | 'capsule' | 'knot';
  /** Offset from the face, in model heights. */
  at: [number, number, number];
  size: number;
  speed: number;
  phase: number;
};

const PIECES: Piece[] = [
  { shape: 'sphere', at: [-0.15, 0.0, 0.07], size: 0.026, speed: 0.7, phase: 0 },
  { shape: 'torus', at: [0.13, 0.03, -0.03], size: 0.03, speed: 0.5, phase: 1.3 },
  { shape: 'sphere', at: [0.09, -0.08, 0.1], size: 0.014, speed: 0.9, phase: 2.1 },
  { shape: 'capsule', at: [-0.08, 0.075, -0.05], size: 0.014, speed: 0.6, phase: 3.4 },
  { shape: 'knot', at: [-0.24, 0.05, -0.12], size: 0.02, speed: 0.4, phase: 4.2 },
];

function geometryFor(shape: Piece['shape']): THREE.BufferGeometry {
  switch (shape) {
    case 'torus':
      return new THREE.TorusGeometry(1, 0.32, 48, 96);
    case 'capsule':
      return new THREE.CapsuleGeometry(0.6, 1.1, 16, 32);
    case 'knot':
      return new THREE.TorusKnotGeometry(0.8, 0.26, 160, 24);
    default:
      return new THREE.SphereGeometry(1, 64, 64);
  }
}

export function GlassOrbs({
  measurement,
  progress,
  pointer,
}: {
  measurement: AvatarMeasurement | null;
  progress?: MutableRefObject<number>;
  pointer?: MutableRefObject<{ x: number; y: number }>;
}) {
  const { gl } = useThree();
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const spread = useRef(0);
  const lean = useRef({ x: 0, y: 0 });

  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return env;
  }, [gl]);

  // At night, smoked glass: dark and see-through, lit only by its
  // reflections, so it sits in the graphite palette. By day, clear glass
  // with a cool grey-blue cast: pure white glass vanishes on white.
  const [theme] = useTheme();
  const day = theme === 'light';
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        envMap,
        envMapIntensity: day ? 1.6 : 1.6,
        color: new THREE.Color(day ? '#7d97b8' : '#0c0d0f'),
        metalness: 0,
        roughness: 0.015,
        transparent: true,
        opacity: day ? 0.32 : 0.55,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        iridescence: 0.3,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [180, 620],
        specularIntensity: 1,
      }),
    [envMap, day]
  );

  const geometries = useMemo(() => PIECES.map((p) => geometryFor(p.shape)), []);

  useEffect(
    () => () => {
      envMap.dispose();
      material.dispose();
      geometries.forEach((g) => g.dispose());
    },
    [envMap, material, geometries]
  );

  useFrame(({ clock }, dt) => {
    if (!measurement || !group.current) return;
    const { box, headWorldY, centerX, centerZ } = measurement;
    const H = box.max.y - box.min.y;
    const faceY = (headWorldY + box.max.y) / 2;
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 3);
    spread.current += ((progress?.current ?? 0) - spread.current) * k;
    lean.current.x += ((pointer?.current.x ?? 0) - lean.current.x) * k;
    lean.current.y += ((pointer?.current.y ?? 0) - lean.current.y) * k;

    const out = 1 + spread.current * 0.9;
    PIECES.forEach((p, i) => {
      const m = meshes.current[i];
      if (!m) return;
      const bob = Math.sin(t * p.speed + p.phase) * 0.012 * H;
      const depth = 1 + p.at[2] * 4; // nearer pieces move more: parallax
      m.position.set(
        centerX + p.at[0] * H * out - lean.current.x * 0.02 * H * depth,
        faceY + p.at[1] * H * out + bob + lean.current.y * 0.012 * H * depth,
        centerZ + p.at[2] * H
      );
      m.rotation.set(t * 0.21 * p.speed + p.phase, t * 0.34 * p.speed, Math.sin(t * 0.2 + p.phase) * 0.4);
      m.scale.setScalar(p.size * H * (1 - spread.current * 0.15));
    });
  });

  return (
    <group ref={group} visible={!!measurement}>
      {PIECES.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          geometry={geometries[i]}
          material={material}
          renderOrder={2}
        />
      ))}
    </group>
  );
}
