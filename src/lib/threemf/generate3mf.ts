import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { svgToMesh } from './svg-to-mesh';
import { csgSubtract } from './csg-engine';
import { write3MF } from './threemf-writer';

interface Generate3MFParams {
  stlUrl: string;
  svg: string;
  depth: number;
  scale: number;
  rotation: number;
}

// Load the keycap STL and apply the same centering + 180° X rotation the viewer
// uses, so the body that gets engraved matches what's on screen.
async function loadKeycapBody(stlUrl: string): Promise<THREE.BufferGeometry> {
  const res = await fetch(stlUrl);
  if (!res.ok) throw new Error(`STL konnte nicht geladen werden (${res.status})`);
  const buffer = await res.arrayBuffer();

  const geo = new STLLoader().parse(buffer);
  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  geo.boundingBox!.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
  geo.computeBoundingBox();
  return geo;
}

// Run the full engraving pipeline entirely in the browser and return a .3mf Blob.
// No server, no storage — mirrors scripts/keycap/generate-3mf.js.
export async function generateKeycap3MF({
  stlUrl,
  svg,
  depth,
  scale,
  rotation,
}: Generate3MFParams): Promise<Blob> {
  // Always add 0.1 so the SVG sits slightly inside the keycap (matches viewer).
  const extrudeDepth = depth + 0.1;

  const bodyGeo = await loadKeycapBody(stlUrl);
  const topZ = bodyGeo.boundingBox!.max.z;

  const svgGeo = svgToMesh(svg, {
    depth: extrudeDepth,
    scale,
    rotation,
    x: 0,
    y: 0,
    z: topZ - 0.0905,
  });

  const engravedBody = csgSubtract(bodyGeo, svgGeo);
  const inlayGeo = svgGeo.clone();

  return write3MF(engravedBody, inlayGeo);
}

// Trigger a browser download for a generated Blob.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
