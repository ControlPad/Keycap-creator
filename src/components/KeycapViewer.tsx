import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { preprocessSVG } from '../lib/preprocessSVG';

interface KeycapViewerProps {
  stlUrl: string | null;
  baseColor: string;
  symbolColor: string;
  svgContent: string | null;
  scale: number;
  rotation: number;
  depth: number;
}

function KeycapBody({ stlUrl, baseColor }: { stlUrl: string; baseColor: string }) {
  const geometry = useLoader(STLLoader, stlUrl);

  const processedGeo = useMemo(() => {
    const geo = geometry.clone();
    geo.computeBoundingBox();
    const center = new THREE.Vector3();
    geo.boundingBox!.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
    geo.computeVertexNormals();
    return geo;
  }, [geometry]);

  return (
    <mesh geometry={processedGeo} renderOrder={1}>
      <meshStandardMaterial
        color={baseColor}
        stencilWrite={false}
        stencilRef={1}
        stencilFunc={THREE.NotEqualStencilFunc}
      />
    </mesh>
  );
}

function SvgOverlay({
  svgContent,
  symbolColor,
  stlUrl,
  scale: userScale,
  rotation: userRotation,
  depth,
}: {
  svgContent: string;
  symbolColor: string;
  stlUrl: string;
  scale: number;
  rotation: number;
  depth: number;
}) {
  const stlGeometry = useLoader(STLLoader, stlUrl);
  const [meshGroup, setMeshGroup] = useState<THREE.Group | null>(null);

  const topZ = useMemo(() => {
    const geo = stlGeometry.clone();
    geo.computeBoundingBox();
    const center = new THREE.Vector3();
    geo.boundingBox!.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
    geo.computeBoundingBox();
    return geo.boundingBox!.max.z;
  }, [stlGeometry]);

  useEffect(() => {
    const loader = new SVGLoader();
    const svgData = loader.parse(preprocessSVG(svgContent));
    const paths = svgData.paths;

    if (!paths || paths.length === 0) return;

    const group = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];
    const strokeFlatGeos: THREE.BufferGeometry[] = [];

    for (const path of paths) {
      const style = path.userData?.style;
      const fillColor = style?.fill;
      const strokeColor = style?.stroke;
      const hasFill = fillColor && fillColor !== 'none' && fillColor !== '';
      const hasStroke = strokeColor && strokeColor !== 'none' && strokeColor !== '';

      if (hasFill) {
        const shapes = SVGLoader.createShapes(path);
        for (const shape of shapes) {
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: depth + 0.1,
            bevelEnabled: false,
          });
          geometries.push(geo);
        }
      }

      if (hasStroke) {
        const strokeWidth = style.strokeWidth !== undefined ? parseFloat(String(style.strokeWidth)) : 2;
        for (const subPath of path.subPaths) {
          const points = subPath.getPoints(48);
          if (points.length < 2) continue;
          const strokeGeo = SVGLoader.pointsToStroke(points, {
            strokeColor: '#000000',
            strokeWidth,
            strokeLineCap: style.strokeLineCap || 'round',
            strokeLineJoin: style.strokeLineJoin || 'round',
            strokeMiterLimit: style.strokeMiterLimit || 4,
          });
          if (!strokeGeo) continue;
          strokeFlatGeos.push(strokeGeo);
        }
      }
    }

    if (strokeFlatGeos.length > 0) {
      let totalVerts = 0;
      for (const g of strokeFlatGeos) totalVerts += g.getAttribute('position').count;
      const flatPos = new Float32Array(totalVerts * 3);
      let off = 0;
      for (const g of strokeFlatGeos) {
        const p = g.getAttribute('position');
        flatPos.set(p.array as Float32Array, off);
        off += p.array.length;
      }

      const precision = 8;
      const vtxKey = (i: number) =>
        flatPos[i * 3].toFixed(precision) + ',' + flatPos[i * 3 + 1].toFixed(precision);
      const edgeCount = new Map<string, { count: number; i1: number; i2: number }>();
      const triCount = totalVerts / 3;
      for (let i = 0; i < triCount; i++) {
        const a = i * 3,
          b = i * 3 + 1,
          c = i * 3 + 2;
        const ka = vtxKey(a),
          kb = vtxKey(b),
          kc = vtxKey(c);
        for (const [k1, k2, i1, i2] of [
          [ka, kb, a, b],
          [kb, kc, b, c],
          [kc, ka, c, a],
        ] as [string, string, number, number][]) {
          const ek = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
          const prev = edgeCount.get(ek);
          if (prev) {
            prev.count++;
          } else {
            edgeCount.set(ek, { count: 1, i1, i2 });
          }
        }
      }

      const extPos = new Float32Array(totalVerts * 2 * 3);
      extPos.set(flatPos, 0);
      for (let i = 0; i < totalVerts; i++) {
        extPos[(totalVerts + i) * 3] = flatPos[i * 3];
        extPos[(totalVerts + i) * 3 + 1] = flatPos[i * 3 + 1];
        extPos[(totalVerts + i) * 3 + 2] = depth + 0.1;
      }

      const indices: number[] = [];
      for (let i = 0; i < triCount; i++) {
        const a = i * 3,
          b = i * 3 + 1,
          c = i * 3 + 2;
        indices.push(a, c, b);
      }
      for (let i = 0; i < triCount; i++) {
        const a = i * 3,
          b = i * 3 + 1,
          c = i * 3 + 2;
        indices.push(a + totalVerts, b + totalVerts, c + totalVerts);
      }
      for (const { count, i1, i2 } of edgeCount.values()) {
        if (count !== 1) continue;
        indices.push(i1, i2, i2 + totalVerts);
        indices.push(i1, i2 + totalVerts, i1 + totalVerts);
      }

      const extGeo = new THREE.BufferGeometry();
      extGeo.setAttribute('position', new THREE.BufferAttribute(extPos, 3));
      extGeo.setIndex(indices);
      geometries.push(extGeo);
    }

    if (geometries.length === 0) return;

    let totalVerts = 0;
    const nonIndexed = geometries.map((g) => {
      const ni = g.index ? g.toNonIndexed() : g.clone();
      totalVerts += ni.getAttribute('position').count;
      return ni;
    });
    const positions = new Float32Array(totalVerts * 3);
    let offset = 0;
    for (const g of nonIndexed) {
      const pos = g.getAttribute('position');
      positions.set(pos.array as Float32Array, offset);
      offset += pos.array.length;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    merged.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));

    merged.computeBoundingBox();
    const center = new THREE.Vector3();
    merged.boundingBox!.getCenter(center);
    const minZ = merged.boundingBox!.min.z;
    merged.translate(-center.x, -center.y, -minZ);

    const svgScale = (10 / 24) * userScale;
    merged.scale(svgScale, svgScale, 1);

    if (userRotation !== 0) {
      merged.applyMatrix4(new THREE.Matrix4().makeRotationZ((userRotation * Math.PI) / 180));
    }

    merged.translate(0, 0, topZ - 0.0905);
    merged.computeVertexNormals();

    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        color: symbolColor,
        stencilWrite: true,
        stencilRef: 1,
        stencilZPass: THREE.ReplaceStencilOp,
      }),
    );
    mesh.renderOrder = 0;

    group.add(mesh);
    setMeshGroup(group);

    return () => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
    };
  }, [svgContent, symbolColor, userScale, userRotation, depth, topZ]);

  if (!meshGroup) return null;
  return <primitive object={meshGroup} />;
}

function PanLimitedControls() {
  const controlsRef = useRef<any>(null);
  const prevTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    prevTarget.current.copy(controls.target);
    const limit = 10;
    const onChange = () => {
      const t = controls.target;
      if (!t.equals(prevTarget.current)) {
        const cx = Math.max(-limit, Math.min(limit, t.x));
        const cy = Math.max(-limit, Math.min(limit, t.y));
        const cz = Math.max(-limit, Math.min(limit, t.z));
        if (cx !== t.x || cy !== t.y || cz !== t.z) {
          const dx = cx - t.x,
            dy = cy - t.y,
            dz = cz - t.z;
          t.set(cx, cy, cz);
          controls.object.position.x += dx;
          controls.object.position.y += dy;
          controls.object.position.z += dz;
        }
        prevTarget.current.copy(t);
      }
    };
    controls.addEventListener('change', onChange);
    return () => controls.removeEventListener('change', onChange);
  }, []);

  return (
    <OrbitControls ref={controlsRef} enablePan minDistance={16} maxDistance={60} target={[0, 0, 0]} />
  );
}

function Scene({ stlUrl, baseColor, symbolColor, svgContent, scale, rotation, depth }: KeycapViewerProps & { stlUrl: string }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.up.set(0, 0, 1);
    camera.position.set(0, -40, 40);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 10]} intensity={1} />
      <directionalLight position={[-5, -5, 5]} intensity={0.3} />
      <KeycapBody stlUrl={stlUrl} baseColor={baseColor} />
      {svgContent && (
        <SvgOverlay
          svgContent={svgContent}
          symbolColor={symbolColor}
          stlUrl={stlUrl}
          scale={scale}
          rotation={rotation}
          depth={depth}
        />
      )}
      <group position={[0, 0, -4.6]} rotation={[Math.PI / 2, 0, 0]}>
        <Grid
          args={[120, 120]}
          cellSize={3}
          cellThickness={0.5}
          cellColor="#888888"
          sectionSize={15}
          sectionThickness={1}
          sectionColor="#555555"
          fadeDistance={200}
          side={THREE.DoubleSide}
          infiniteGrid
        />
      </group>
      <PanLimitedControls />
    </>
  );
}

export default function KeycapViewer(props: KeycapViewerProps) {
  if (!props.stlUrl) {
    return (
      <div className="w-full aspect-[16/9] rounded-xl border border-primary-200 dark:border-primary-900/40 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <p className="text-sm text-gray-400">Kein 3D-Modell verfügbar</p>
      </div>
    );
  }

  return (
    <div className="w-full aspect-[16/9] rounded-xl border border-primary-200 dark:border-primary-900/40 bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <Canvas gl={{ stencil: true, antialias: true }} camera={{ fov: 40 }}>
        <Scene {...props} stlUrl={props.stlUrl} />
      </Canvas>
    </div>
  );
}
