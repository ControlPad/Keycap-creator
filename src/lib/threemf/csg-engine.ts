import * as THREE from 'three';
import { SUBTRACTION, Evaluator, Brush } from 'three-bvh-csg';

// Ensure geometry has normals and UVs (required by three-bvh-csg).
function ensureAttributes(geo: THREE.BufferGeometry): void {
  if (!geo.getAttribute('normal')) {
    geo.computeVertexNormals();
  }
  if (!geo.getAttribute('uv')) {
    const count = geo.getAttribute('position').count;
    const uvs = new Float32Array(count * 2);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
}

// CSG boolean subtraction: body - cutter. Returns the resulting geometry, or the
// original body on failure (fallback = no engraving rather than a broken export).
export function csgSubtract(
  bodyGeometry: THREE.BufferGeometry,
  cutterGeometry: THREE.BufferGeometry,
): THREE.BufferGeometry {
  try {
    const bodyGeo = bodyGeometry.index ? bodyGeometry.toNonIndexed() : bodyGeometry.clone();
    const cutterGeo = cutterGeometry.index ? cutterGeometry.toNonIndexed() : cutterGeometry.clone();

    ensureAttributes(bodyGeo);
    ensureAttributes(cutterGeo);

    const bodyBrush = new Brush(bodyGeo);
    bodyBrush.updateMatrixWorld();

    const cutterBrush = new Brush(cutterGeo);
    cutterBrush.updateMatrixWorld();

    const evaluator = new Evaluator();
    const result = evaluator.evaluate(bodyBrush, cutterBrush, SUBTRACTION);
    const resultGeo = result.geometry;
    resultGeo.computeVertexNormals();
    return resultGeo;
  } catch (err) {
    console.warn('CSG subtraction failed, using fallback (no engraving):', (err as Error).message);
    return bodyGeometry;
  }
}
