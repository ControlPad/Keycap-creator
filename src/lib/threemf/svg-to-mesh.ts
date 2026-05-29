import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { preprocessSVG } from '../preprocessSVG';

interface SvgToMeshOptions {
  depth?: number;
  scale?: number;
  rotation?: number;
  x?: number;
  y?: number;
  z?: number;
}

// Parse an SVG string into a single merged, extruded BufferGeometry positioned
// on top of the keycap. This mirrors the transforms in KeycapViewer's SvgOverlay
// so the exported 3MF matches the on-screen preview exactly.
//
// Browser port of the server-side scripts/keycap/lib/svg-to-mesh.js — the only
// change is that we rely on the browser's native DOMParser (SVGLoader uses it)
// instead of jsdom.
export function svgToMesh(
  svgString: string,
  { depth = 0.6, scale = 1, rotation = 0, x = 0, y = 0, z = 0 }: SvgToMeshOptions = {},
): THREE.BufferGeometry {
  const loader = new SVGLoader();
  const svgData = loader.parse(preprocessSVG(svgString));
  const paths = svgData.paths;

  if (!paths || paths.length === 0) {
    throw new Error('No paths found in SVG');
  }

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
          depth,
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

  // Merge all 2D strokes into one flat mesh, then extrude with outer-boundary walls only.
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
      extPos[(totalVerts + i) * 3 + 2] = depth;
    }

    const indices: number[] = [];
    for (let i = 0; i < triCount; i++) {
      const a = i * 3,
        b = i * 3 + 1,
        c = i * 3 + 2;
      indices.push(a, b, c);
      indices.push(a + totalVerts, c + totalVerts, b + totalVerts);
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

  if (geometries.length === 0) {
    throw new Error('No geometry could be generated from SVG');
  }

  const merged = mergeGeometries(geometries);

  // SVG coordinate system: Y goes down, flip via rotation to preserve winding.
  merged.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));

  // Center XY at origin, align bottom to z=0.
  merged.computeBoundingBox();
  const center = new THREE.Vector3();
  merged.boundingBox!.getCenter(center);
  const minZ = merged.boundingBox!.min.z;
  merged.translate(-center.x, -center.y, -minZ);

  // Apply user scale (map 24 SVG units to ~10mm).
  const svgScale = (10 / 24) * scale;
  merged.scale(svgScale, svgScale, 1);

  // Apply rotation around Z axis.
  if (rotation !== 0) {
    merged.applyMatrix4(new THREE.Matrix4().makeRotationZ((rotation * Math.PI) / 180));
  }

  // Position on keycap top face.
  merged.translate(x, y, z);

  merged.computeVertexNormals();
  return merged;
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 1) {
    const g = geometries[0];
    return g.index ? g.toNonIndexed() : g.clone();
  }

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
  return merged;
}
