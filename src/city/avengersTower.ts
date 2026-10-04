import * as THREE from 'three';
import { BuildingData } from './cityGenerator';

export interface AvengersTowerResult {
  group: THREE.Group;
  buildings: BuildingData[];
  buildingMeshes: THREE.Mesh[];
  rooftopAnchors: THREE.Vector3[];
  spireTip: THREE.Vector3;
  helipadCenter: THREE.Vector3;
}

/**
 * Creates high-definition procedural Avengers Tower glass texture
 */
function createAvengersGlassTexture(): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const width = 512;
  const height = 1024;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const eCanvas = document.createElement('canvas');
  eCanvas.width = width;
  eCanvas.height = height;
  const eCtx = eCanvas.getContext('2d')!;

  // Dark obsidian blue foundation
  ctx.fillStyle = '#060d1a';
  ctx.fillRect(0, 0, width, height);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, width, height);

  // High-tech vertical mullions
  const cols = 16;
  const rows = 64;
  const colW = width / cols;
  const rowH = height / rows;

  ctx.fillStyle = '#0f172a';
  for (let c = 0; c <= cols; c++) {
    ctx.fillRect(c * colW - 1, 0, 3, height);
  }

  // Windows with stark tech lighting (cyan & electric blue)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isLit = Math.random() > 0.35;
      const wx = c * colW + 3;
      const wy = r * rowH + 3;
      const ww = colW - 6;
      const wh = rowH - 6;

      if (isLit) {
        const cyanVariant = Math.random() > 0.4;
        const color = cyanVariant ? '#38bdf8' : '#60a5fa';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(wx, wy, ww, wh);

        eCtx.fillStyle = cyanVariant ? '#0284c7' : '#2563eb';
        eCtx.globalAlpha = 0.9;
        eCtx.fillRect(wx, wy, ww, wh);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.globalAlpha = 1.0;
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 6);

  const emissiveMap = new THREE.CanvasTexture(eCanvas);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.repeat.set(2, 6);

  return { map, emissiveMap };
}

/**
 * Creates the glowing Avengers "A" emblem texture
 */
function createAvengersLogoTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;

  // Outer glowing circle
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 30;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // The stylized Avengers "A"
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  // Left diagonal leg
  ctx.moveTo(cx, cy - radius * 0.85);
  ctx.lineTo(cx + 42, cy - radius * 0.85);
  ctx.lineTo(cx + 120, cy + radius * 0.85);
  ctx.lineTo(cx + 60, cy + radius * 0.85);
  ctx.lineTo(cx + 36, cy + radius * 0.28);
  ctx.lineTo(cx - 52, cy + radius * 0.28);
  ctx.lineTo(cx - 72, cy + radius * 0.85);
  ctx.lineTo(cx - 128, cy + radius * 0.85);
  ctx.closePath();
  ctx.fill();

  // Arrow cutout / crossbar pointing right
  ctx.fillStyle = '#060d1a';
  ctx.beginPath();
  ctx.moveTo(cx - 36, cy + radius * 0.12);
  ctx.lineTo(cx + 24, cy + radius * 0.12);
  ctx.lineTo(cx, cy - radius * 0.38);
  ctx.closePath();
  ctx.fill();

  // Arrowhead pointing right across circle
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.moveTo(cx + 18, cy + radius * 0.2);
  ctx.lineTo(cx + 155, cy + radius * 0.2);
  ctx.lineTo(cx + 115, cy - radius * 0.05);
  ctx.lineTo(cx + 145, cy + radius * 0.2);
  ctx.lineTo(cx + 115, cy + radius * 0.45);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Creates landing pad target decal for the Quinjet helipad
 */
function createHelipadTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Dark asphalt surface
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, size, size);

  // Outer yellow safety border
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#eab308';
  ctx.strokeRect(18, 18, size - 36, size - 36);

  // Big white circle
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
  ctx.stroke();

  // Inner yellow dashed ring
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#eab308';
  ctx.setLineDash([24, 16]);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bold "A" letter in center
  ctx.font = '900 180px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('A', size / 2, size / 2 + 10);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Builds the complete Avengers Tower (Stark Tower)
 * Centerpiece skyscraper: ~380m tall, cantilevered Quinjet helipad, glowing Avengers logos, crown, and spire.
 */
export function createAvengersTower(x: number, z: number): AvengersTowerResult {
  const group = new THREE.Group();
  group.name = 'AvengersTower';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const rooftopAnchors: THREE.Vector3[] = [];

  const { map, emissiveMap } = createAvengersGlassTexture();
  const glassMat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.8,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.85,
  });

  const glowingCyanMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    toneMapped: false,
  });

  // -------------------------------------------------------------
  // 1. MAIN LOWER & MID SHAFT (0m to 215m)
  // -------------------------------------------------------------
  const baseWidth = 56;
  const baseDepth = 52;
  const baseHeight = 215;

  const baseGeo = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
  const baseMesh = new THREE.Mesh(baseGeo, glassMat);
  baseMesh.position.set(x, baseHeight / 2, z);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.userData = { isBuilding: true, isAvengersTower: true };
  group.add(baseMesh);
  buildingMeshes.push(baseMesh);

  const baseBox = new THREE.Box3().setFromObject(baseMesh);
  buildings.push({
    box: baseBox,
    mesh: baseMesh,
    center: new THREE.Vector3(x, baseHeight / 2, z),
    size: new THREE.Vector3(baseWidth, baseHeight, baseDepth),
  });

  // -------------------------------------------------------------
  // 2. CANTILEVERED QUINJET HELIPAD (y = 205m - 215m)
  // Extends 36m outward to the South (+Z)
  // -------------------------------------------------------------
  const padWidth = 48;
  const padLength = 38;
  const padThick = 4.5;
  const padY = 210;
  const padZ = z + baseDepth / 2 + padLength / 2 - 2;

  const padGeo = new THREE.BoxGeometry(padWidth, padThick, padLength);
  const padMesh = new THREE.Mesh(padGeo, darkMetalMat);
  padMesh.position.set(x, padY, padZ);
  padMesh.castShadow = true;
  padMesh.receiveShadow = true;
  padMesh.userData = { isBuilding: true, isHelipad: true };
  group.add(padMesh);
  buildingMeshes.push(padMesh);

  const padBox = new THREE.Box3().setFromObject(padMesh);
  buildings.push({
    box: padBox,
    mesh: padMesh,
    center: new THREE.Vector3(x, padY, padZ),
    size: new THREE.Vector3(padWidth, padThick, padLength),
    isRoofStructure: true,
  });

  // Helipad decal surface on top
  const helipadTex = createHelipadTexture();
  const helipadMat = new THREE.MeshBasicMaterial({
    map: helipadTex,
    toneMapped: false,
  });
  const helipadPlaneGeo = new THREE.PlaneGeometry(padWidth * 0.88, padLength * 0.88);
  helipadPlaneGeo.rotateX(-Math.PI / 2);
  const helipadPlane = new THREE.Mesh(helipadPlaneGeo, helipadMat);
  helipadPlane.position.set(x, padY + padThick / 2 + 0.05, padZ);
  group.add(helipadPlane);

  // Perimeter landing guide lights (cyan LEDs)
  for (let lx = -padWidth / 2 + 2; lx <= padWidth / 2 - 2; lx += 6) {
    for (const lz of [-padLength / 2 + 1, padLength / 2 - 1]) {
      const ledGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8);
      const led = new THREE.Mesh(ledGeo, glowingCyanMat);
      led.position.set(x + lx, padY + padThick / 2 + 0.2, padZ + lz);
      group.add(led);
    }
  }

  // Cantilever structural angled trusses underneath
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.9,
  });
  for (const tx of [-14, 14]) {
    const strutGeo = new THREE.CylinderGeometry(0.9, 0.9, 36, 8);
    const strut = new THREE.Mesh(strutGeo, trussMat);
    strut.position.set(x + tx, padY - 14, padZ - 8);
    strut.rotation.x = Math.PI / 4.2;
    group.add(strut);
  }

  // -------------------------------------------------------------
  // 3. UPPER PROW / CROWN SECTION (y = 215m to 310m)
  // Narrowing aerodynamic wedge
  // -------------------------------------------------------------
  const crownHeight = 95;
  const crownBottomW = 44;
  const crownTopW = 24;
  const crownBottomD = 40;
  const crownTopD = 20;

  // Use trapezoidal / tapered box approximation
  const crownGeo = new THREE.CylinderGeometry(crownTopW / 2, crownBottomW / 2, crownHeight, 4);
  crownGeo.rotateY(Math.PI / 4);
  const crownMesh = new THREE.Mesh(crownGeo, glassMat);
  const crownY = baseHeight + crownHeight / 2;
  crownMesh.position.set(x, crownY, z - 4);
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  crownMesh.userData = { isBuilding: true };
  group.add(crownMesh);
  buildingMeshes.push(crownMesh);

  const crownBox = new THREE.Box3().setFromObject(crownMesh);
  buildings.push({
    box: crownBox,
    mesh: crownMesh,
    center: new THREE.Vector3(x, crownY, z - 4),
    size: new THREE.Vector3(crownBottomW, crownHeight, crownBottomD),
    isRoofStructure: true,
  });

  // Top observation deck at y = 310m
  const topDeckGeo = new THREE.BoxGeometry(22, 3, 18);
  const topDeckMesh = new THREE.Mesh(topDeckGeo, darkMetalMat);
  topDeckMesh.position.set(x, 310, z - 4);
  group.add(topDeckMesh);

  const topDeckBox = new THREE.Box3().setFromObject(topDeckMesh);
  buildings.push({
    box: topDeckBox,
    mesh: topDeckMesh,
    center: new THREE.Vector3(x, 310, z - 4),
    size: new THREE.Vector3(22, 3, 18),
    isRoofStructure: true,
  });

  rooftopAnchors.push(new THREE.Vector3(x, 311.5, z - 4));
  rooftopAnchors.push(new THREE.Vector3(x, padY + padThick / 2, padZ));

  // -------------------------------------------------------------
  // 4. GIANT ILLUMINATED AVENGERS "A" LOGOS
  // Mounted on the South face (facing Helipad) and East/West flanks
  // -------------------------------------------------------------
  const logoTex = createAvengersLogoTexture();
  const logoMat = new THREE.MeshBasicMaterial({
    map: logoTex,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  });

  // South Logo (above the helipad)
  const logoGeo = new THREE.PlaneGeometry(24, 24);
  const southLogo = new THREE.Mesh(logoGeo, logoMat);
  southLogo.position.set(x, 252, z + crownBottomD / 2 - 2);
  group.add(southLogo);

  // East Logo
  const eastLogo = new THREE.Mesh(logoGeo, logoMat);
  eastLogo.position.set(x + crownBottomW / 2 - 1, 252, z - 4);
  eastLogo.rotation.y = Math.PI / 2;
  group.add(eastLogo);

  // West Logo
  const westLogo = new THREE.Mesh(logoGeo, logoMat);
  westLogo.position.set(x - crownBottomW / 2 + 1, 252, z - 4);
  westLogo.rotation.y = -Math.PI / 2;
  group.add(westLogo);

  // -------------------------------------------------------------
  // 5. SUPER COMMUNICATIONS SPIRE (y = 310m to 380m)
  // Tallest needle in NYC with flashing aeronautical red beacon
  // -------------------------------------------------------------
  const spireHeight = 70;
  const spireGeo = new THREE.CylinderGeometry(0.2, 1.2, spireHeight, 8);
  const spireMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.9,
  });
  const spireMesh = new THREE.Mesh(spireGeo, spireMat);
  const spireY = 310 + spireHeight / 2;
  spireMesh.position.set(x, spireY, z - 4);
  spireMesh.castShadow = true;
  group.add(spireMesh);

  // Red beacon light at tip (y = 380m)
  const beaconGeo = new THREE.SphereGeometry(0.8, 12, 12);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xff0044,
    toneMapped: false,
  });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.set(x, 310 + spireHeight, z - 4);
  group.add(beaconMesh);

  const spireTip = new THREE.Vector3(x, 380, z - 4);
  rooftopAnchors.push(spireTip);

  const helipadCenter = new THREE.Vector3(x, padY + padThick / 2, padZ);

  return {
    group,
    buildings,
    buildingMeshes,
    rooftopAnchors,
    spireTip,
    helipadCenter,
  };
}
