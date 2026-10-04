import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface RoadNetworkOptions {
  avenues: number[];
  streets: number[];
  blockCount: number;
  blockSize: number;
  streetWidth: number;
  originOffset: number;
  timeOfDay: 'sunset' | 'night' | 'day' | 'foggy';
  parkBlocks?: { ix: number; iz: number }[];
}

export interface RoadNetworkResult {
  group: THREE.Group;
  groundMesh: THREE.Mesh;
}

/**
 * Procedural Realistic Asphalt Texture
 */
function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep dark urban asphalt base
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  // Microscopic gravel and bitumen noise grain
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const tone = Math.floor(18 + Math.random() * 22);
    ctx.fillStyle = `rgb(${tone},${tone},${tone})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 60);
  return texture;
}

/**
 * Procedural Concrete Paver Sidewalk Texture
 */
function createSidewalkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Light concrete stone slab base (clearly distinct from dark asphalt road!)
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 512, 512);

  // Surface texture noise
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const g = Math.floor(130 + Math.random() * 35);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Modern square concrete paver joints (grid lines)
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4;
  const step = 64; // 8x8 grid of square pavers
  for (let p = 0; p <= 512; p += step) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

export function createRoadNetwork(options: RoadNetworkOptions): RoadNetworkResult {
  const networkGroup = new THREE.Group();
  networkGroup.name = 'RoadNetworkGroup';

  const { avenues, streets, blockCount, blockSize, streetWidth, originOffset } = options;
  const gridStep = blockSize + streetWidth; // 104m
  const roadWidth = 22; // width of asphalt roadway for vehicles (between -11 and +11)
  const sidewalkPlatSize = blockSize + 14; // 82m x 82m platform (extends 7m outside 68m building lot)
  const curbHeight = 0.08; // slightly raised sidewalk curb

  // -------------------------------------------------------------
  // 1. BASE ASPHALT ROADWAY GROUND PLANE
  // -------------------------------------------------------------
  const asphaltTexture = createAsphaltTexture();
  const groundGeo = new THREE.PlaneGeometry(1800, 1800);
  const groundMat = new THREE.MeshStandardMaterial({
    map: asphaltTexture,
    color: 0x181e2b,
    roughness: 0.88,
    metalness: 0.12,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = true;
  networkGroup.add(groundMesh);

  // -------------------------------------------------------------
  // 2. ELEVATED CONCRETE SIDEWALK PLATFORMS (TROTOAR)
  // -------------------------------------------------------------
  const sidewalkTexture = createSidewalkTexture();
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTexture,
    color: 0xa8b4c4,
    roughness: 0.72,
    metalness: 0.08,
  });

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x475569, // Darker granite curbstones
    roughness: 0.65,
    metalness: 0.2,
  });

  const parkMat = new THREE.MeshStandardMaterial({
    color: 0x166534, // Lush Central Park green grass
    roughness: 0.9,
    metalness: 0.05,
  });

  const sidewalkGeos: THREE.BufferGeometry[] = [];
  const parkGeos: THREE.BufferGeometry[] = [];
  const curbGeos: THREE.BufferGeometry[] = [];

  for (let ix = 0; ix < blockCount; ix++) {
    for (let iz = 0; iz < blockCount; iz++) {
      const cx = ix * gridStep - originOffset;
      const cz = iz * gridStep - originOffset;

      const isPark = options.parkBlocks?.some((p) => p.ix === ix && p.iz === iz);

      // Platform top surface (82m x 82m)
      const platGeo = new THREE.BoxGeometry(sidewalkPlatSize, curbHeight, sidewalkPlatSize);
      platGeo.translate(cx, curbHeight / 2, cz);

      if (isPark) {
        parkGeos.push(platGeo);
      } else {
        sidewalkGeos.push(platGeo);
      }

      // Granite curb borders (framing the road edges)
      const curbThick = 0.35;
      const curbLen = sidewalkPlatSize;

      // North & South curb strips
      for (const sz of [-sidewalkPlatSize / 2, sidewalkPlatSize / 2]) {
        const cGeo = new THREE.BoxGeometry(curbLen, curbHeight * 1.05, curbThick);
        cGeo.translate(cx, curbHeight / 2, cz + sz);
        curbGeos.push(cGeo);
      }
      // East & West curb strips
      for (const sx of [-sidewalkPlatSize / 2, sidewalkPlatSize / 2]) {
        const cGeo = new THREE.BoxGeometry(curbThick, curbHeight * 1.05, curbLen);
        cGeo.translate(cx + sx, curbHeight / 2, cz);
        curbGeos.push(cGeo);
      }
    }
  }

  if (sidewalkGeos.length > 0) {
    const mergedSidewalk = BufferGeometryUtils.mergeGeometries(sidewalkGeos);
    const sidewalkMesh = new THREE.Mesh(mergedSidewalk, sidewalkMat);
    sidewalkMesh.receiveShadow = true;
    networkGroup.add(sidewalkMesh);
  }

  if (parkGeos.length > 0) {
    const mergedPark = BufferGeometryUtils.mergeGeometries(parkGeos);
    const parkMesh = new THREE.Mesh(mergedPark, parkMat);
    parkMesh.receiveShadow = true;
    networkGroup.add(parkMesh);
  }

  if (curbGeos.length > 0) {
    const mergedCurbs = BufferGeometryUtils.mergeGeometries(curbGeos);
    const curbMesh = new THREE.Mesh(mergedCurbs, curbMat);
    curbMesh.receiveShadow = true;
    networkGroup.add(curbMesh);
  }

  // -------------------------------------------------------------
  // 3. CRISP ROAD MARKINGS (DOUBLE YELLOW LINES, DASHES, CROSSWALKS)
  // -------------------------------------------------------------
  const yellowGeos: THREE.BufferGeometry[] = [];
  const whiteGeos: THREE.BufferGeometry[] = [];

  const markingY = 0.015; // slightly above asphalt

  // --- Avenues (North-South along Z) ---
  for (const ax of avenues) {
    for (let sIdx = 0; sIdx < streets.length - 1; sIdx++) {
      const z1 = streets[sIdx];
      const z2 = streets[sIdx + 1];

      // Road block between intersection 1 and intersection 2
      // Intersection box is 22m x 22m, so ends at z1 + 11 and z2 - 11
      const startZ = z1 + 11;
      const endZ = z2 - 11;

      // A) Double yellow center divider lines (between stop lines)
      const lineStartZ = startZ + 4.5;
      const lineEndZ = endZ - 4.5;
      const lineLen = lineEndZ - lineStartZ;
      const lineMidZ = (lineStartZ + lineEndZ) / 2;

      for (const off of [-0.15, 0.15]) {
        const yellowLine = new THREE.PlaneGeometry(0.18, lineLen);
        yellowLine.rotateX(-Math.PI / 2);
        yellowLine.translate(ax + off, markingY, lineMidZ);
        yellowGeos.push(yellowLine);
      }

      // B) White dashed lane divider lines (dividing driving lanes)
      for (const laneOff of [-5.2, 5.2]) {
        const dashLen = 2.8;
        const dashGap = 3.2;
        const totalStep = dashLen + dashGap;
        for (let dz = lineStartZ; dz <= lineEndZ - dashLen; dz += totalStep) {
          const dash = new THREE.PlaneGeometry(0.16, dashLen);
          dash.rotateX(-Math.PI / 2);
          dash.translate(ax + laneOff, markingY, dz + dashLen / 2);
          whiteGeos.push(dash);
        }
      }

      // C) Crosswalks & Stop lines at intersection borders
      // South entrance crosswalk
      addCrosswalk(whiteGeos, ax, startZ + 1.8, 'x', roadWidth);
      addStopLine(whiteGeos, ax, startZ + 3.8, 'x', roadWidth);

      // North entrance crosswalk
      addCrosswalk(whiteGeos, ax, endZ - 1.8, 'x', roadWidth);
      addStopLine(whiteGeos, ax, endZ - 3.8, 'x', roadWidth);
    }
  }

  // --- Streets (East-West along X) ---
  for (const sz of streets) {
    for (let aIdx = 0; aIdx < avenues.length - 1; aIdx++) {
      const x1 = avenues[aIdx];
      const x2 = avenues[aIdx + 1];

      const startX = x1 + 11;
      const endX = x2 - 11;

      // A) Double yellow center divider lines
      const lineStartX = startX + 4.5;
      const lineEndX = endX - 4.5;
      const lineLen = lineEndX - lineStartX;
      const lineMidX = (lineStartX + lineEndX) / 2;

      for (const off of [-0.15, 0.15]) {
        const yellowLine = new THREE.PlaneGeometry(lineLen, 0.18);
        yellowLine.rotateX(-Math.PI / 2);
        yellowLine.translate(lineMidX, markingY, sz + off);
        yellowGeos.push(yellowLine);
      }

      // B) White dashed lane dividers
      for (const laneOff of [-5.2, 5.2]) {
        const dashLen = 2.8;
        const dashGap = 3.2;
        const totalStep = dashLen + dashGap;
        for (let dx = lineStartX; dx <= lineEndX - dashLen; dx += totalStep) {
          const dash = new THREE.PlaneGeometry(dashLen, 0.16);
          dash.rotateX(-Math.PI / 2);
          dash.translate(dx + dashLen / 2, markingY, sz + laneOff);
          whiteGeos.push(dash);
        }
      }

      // C) Crosswalks & Stop lines
      addCrosswalk(whiteGeos, startX + 1.8, sz, 'z', roadWidth);
      addStopLine(whiteGeos, startX + 3.8, sz, 'z', roadWidth);

      addCrosswalk(whiteGeos, endX - 1.8, sz, 'z', roadWidth);
      addStopLine(whiteGeos, endX - 3.8, sz, 'z', roadWidth);
    }
  }

  // Materials for crisp markings
  const yellowMarkingMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b, // Amber yellow highway paint
    toneMapped: false,
  });

  const whiteMarkingMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc, // Bright white reflective road paint
    toneMapped: false,
  });

  if (yellowGeos.length > 0) {
    const mergedYellow = BufferGeometryUtils.mergeGeometries(yellowGeos);
    const yellowMesh = new THREE.Mesh(mergedYellow, yellowMarkingMat);
    networkGroup.add(yellowMesh);
  }

  if (whiteGeos.length > 0) {
    const mergedWhite = BufferGeometryUtils.mergeGeometries(whiteGeos);
    const whiteMesh = new THREE.Mesh(mergedWhite, whiteMarkingMat);
    networkGroup.add(whiteMesh);
  }

  return { group: networkGroup, groundMesh };
}

/**
 * Helper to generate bold Zebra Crosswalk stripes
 */
function addCrosswalk(
  list: THREE.BufferGeometry[],
  coordX: number,
  coordZ: number,
  roadDir: 'x' | 'z',
  roadWidth: number
) {
  const stripeCount = 10;
  const stripeWidth = 0.85; // width of each stripe
  const stripeLen = 3.0; // length of crosswalk
  const span = roadWidth - 3.0; // cross across the asphalt width
  const step = span / (stripeCount - 1);

  for (let i = 0; i < stripeCount; i++) {
    const off = -span / 2 + i * step;
    if (roadDir === 'x') {
      // Road is crossing X axis (horizontal stripe along Z)
      const p = new THREE.PlaneGeometry(stripeWidth, stripeLen);
      p.rotateX(-Math.PI / 2);
      p.translate(coordX + off, 0.016, coordZ);
      list.push(p);
    } else {
      // Road is crossing Z axis (vertical stripe along X)
      const p = new THREE.PlaneGeometry(stripeLen, stripeWidth);
      p.rotateX(-Math.PI / 2);
      p.translate(coordX, 0.016, coordZ + off);
      list.push(p);
    }
  }
}

/**
 * Helper to generate white Stop Line bar
 */
function addStopLine(
  list: THREE.BufferGeometry[],
  coordX: number,
  coordZ: number,
  roadDir: 'x' | 'z',
  roadWidth: number
) {
  const barWidth = roadWidth - 4.0;
  const barThick = 0.45;
  if (roadDir === 'x') {
    const p = new THREE.PlaneGeometry(barWidth, barThick);
    p.rotateX(-Math.PI / 2);
    p.translate(coordX, 0.016, coordZ);
    list.push(p);
  } else {
    const p = new THREE.PlaneGeometry(barThick, barWidth);
    p.rotateX(-Math.PI / 2);
    p.translate(coordX, 0.016, coordZ);
    list.push(p);
  }
}
