import JSZip from 'jszip';
import * as THREE from 'three';

// Generate a Bambu Studio-compatible .3mf file from body + inlay geometries.
// Browser port of scripts/keycap/lib/threemf-writer.js — emits a Blob instead of
// a Node Buffer so it can be downloaded directly without any server storage.
export async function write3MF(
  bodyGeo: THREE.BufferGeometry,
  inlayGeo: THREE.BufferGeometry,
): Promise<Blob> {
  const zip = new JSZip();

  const bodyMesh = geometryToMeshXML(bodyGeo);
  const inlayMesh = geometryToMeshXML(inlayGeo);

  zip.file('3D/Objects/body.model', objectModelXML(1, bodyMesh));
  zip.file('3D/Objects/inlay.model', objectModelXML(3, inlayMesh));
  zip.file('3D/3dmodel.model', mainModelXML());
  zip.file('3D/_rels/3dmodel.model.rels', modelRelsXML());
  zip.file('_rels/.rels', rootRelsXML());
  zip.file('[Content_Types].xml', contentTypesXML());
  zip.file('Metadata/model_settings.config', modelSettingsXML());

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

interface MeshXML {
  verticesXML: string;
  trianglesXML: string;
}

function geometryToMeshXML(geometry: THREE.BufferGeometry): MeshXML {
  const pos = geometry.getAttribute('position');
  if (!pos) throw new Error('Geometry has no position attribute');

  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = geo.getAttribute('position');
  const vertCount = posAttr.count;
  const triCount = vertCount / 3;

  // Deduplicate vertices.
  const vertexMap = new Map<string, number>();
  const vertices: { x: number; y: number; z: number }[] = [];
  const indices: number[] = [];

  for (let i = 0; i < vertCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;

    let idx = vertexMap.get(key);
    if (idx === undefined) {
      idx = vertices.length;
      vertexMap.set(key, idx);
      vertices.push({ x, y, z });
    }
    indices.push(idx);
  }

  let verticesXML = '';
  for (const v of vertices) {
    verticesXML += `          <vertex x="${v.x}" y="${v.y}" z="${v.z}" />\n`;
  }

  let trianglesXML = '';
  for (let i = 0; i < triCount; i++) {
    trianglesXML += `          <triangle v1="${indices[i * 3]}" v2="${indices[i * 3 + 1]}" v3="${indices[i * 3 + 2]}" />\n`;
  }

  return { verticesXML, trianglesXML };
}

function objectModelXML(objectId: number, mesh: MeshXML): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="${objectId}" type="model">
      <mesh>
        <vertices>
${mesh.verticesXML}        </vertices>
        <triangles>
${mesh.trianglesXML}        </triangles>
      </mesh>
    </object>
  </resources>
</model>`;
}

function mainModelXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"
  requiredextensions="p">
  <metadata name="Application">Keycaps Generator</metadata>
  <resources>
    <object id="2" type="model">
      <components>
        <component p:path="/3D/Objects/body.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0" />
        <component p:path="/3D/Objects/inlay.model" objectid="3" transform="1 0 0 0 1 0 0 0 1 0 0 0" />
      </components>
    </object>
  </resources>
  <build>
    <item objectid="2" />
  </build>
</model>`;
}

function modelRelsXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/Objects/body.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
  <Relationship Target="/3D/Objects/inlay.model" Id="rel-2" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;
}

function rootRelsXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;
}

function contentTypesXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;
}

function modelSettingsXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="2">
    <metadata key="name" value="keycap"/>
    <metadata key="extruder" value="1"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="keycap_body"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="1"/>
    </part>
    <part id="3" subtype="normal_part">
      <metadata key="name" value="inlay"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="2"/>
    </part>
  </object>
</config>`;
}
