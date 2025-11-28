import React, { useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { PlanData, Wall, Opening } from '../types';

interface Props {
  data: PlanData;
}

const Wall3D: React.FC<{ wall: Wall }> = ({ wall }) => {
  const shape = new THREE.Shape();
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  const thickness = wall.thickness;

  // Create a rectangular shape for the wall footprint
  shape.moveTo(0, -thickness / 2);
  shape.lineTo(length, -thickness / 2);
  shape.lineTo(length, thickness / 2);
  shape.lineTo(0, thickness / 2);
  shape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: wall.height,
    bevelEnabled: false,
  };

  const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);

  return (
    <mesh
      position={[wall.start.x, 0, wall.start.y]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial color="#cccccc" />
    </mesh>
  );
};

const PlanContent: React.FC<{ data: PlanData }> = ({ data }) => {
  return (
    <>
      {data.walls.map((wall) => (
        <Wall3D key={wall.id} wall={wall} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
    </>
  );
};

export const ThreeDView: React.FC<Props> = ({ data }) => {
  return (
    <div className="flex-1 bg-white dark:bg-slate-900 h-full w-full">
      <Canvas shadows camera={{ position: [200, 200, 200], fov: 50 }}>
        <color attach="background" args={['#f0f0f0']} />
        <ambientLight intensity={0.5} />
        <directionalLight
          castShadow
          position={[100, 200, 150]}
          intensity={1.5}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <PlanContent data={data} />
        <OrbitControls makeDefault />
        <Grid infiniteGrid sectionColor={'#d0d0d0'} />
      </Canvas>
    </div>
  );
};
