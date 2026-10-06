import * as THREE from 'three';
import { BuildingData } from './cityGenerator';
import { modelManager } from '../renderer/modelManager';

export interface AvengersTowerResult {
  group: THREE.Group;
  buildings: BuildingData[];
  buildingMeshes: THREE.Mesh[];
  rooftopAnchors: THREE.Vector3[];
  spireTip: THREE.Vector3;
  helipadCenter: THREE.Vector3;
}

/**
 * Creates glowing Stark Tower / Avengers "A" emblem texture
 */
function createAvengersLogoTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  // Outer circular glow
  const grad = ctx.createRadialGradient(size / 2, size / 2, size / 6, size / 2, size / 2, size / 2.1);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.95)');
  grad.addColorStop(0.5, 'rgba(2, 132, 199, 0.7)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  // Outer ring
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 24;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 32;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2.35, 0, Math.PI * 2);
  ctx.stroke();

  // The stylized Avengers "A"
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 24;

  ctx.beginPath();
  ctx.moveTo(256, 68);
  ctx.lineTo(354, 432);
  ctx.lineTo(294, 432);
  ctx.lineTo(262, 308);
  ctx.lineTo(194, 308);
  ctx.lineTo(158, 432);
  ctx.lineTo(98, 432);
  ctx.closePath();
  ctx.fill();

  // Internal cutout of the "A"
  ctx.fillStyle = '#020617';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(256, 150);
  ctx.lineTo(220, 260);
  ctx.lineTo(276, 260);
  ctx.closePath();
  ctx.fill();

  // Dynamic right-arrow crossbar slash
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(170, 290);
  ctx.lineTo(396, 290);
  ctx.lineTo(380, 314);
  ctx.lineTo(170, 314);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates high-visibility Helipad runway marking texture
 */
function createHelipadTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Dark non-slip carbon composite flight deck
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, size, size);

  // Outer circular yellow warning border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2.25, 0, Math.PI * 2);
  ctx.stroke();

  // Inner white landing ring
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2.8, 0, Math.PI * 2);
  ctx.stroke();

  // Bold "H" Helipad mark
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(size / 2 - 80, size / 2 - 90, 32, 180);
  ctx.fillRect(size / 2 + 48, size / 2 - 90, 32, 180);
  ctx.fillRect(size / 2 - 80, size / 2 - 20, 160, 40);

  // Red obstacle corner chevrons
  ctx.fillStyle = '#ef4444';
  const cw = 44;
  ctx.fillRect(16, 16, cw, 10);
  ctx.fillRect(16, 16, 10, cw);
  ctx.fillRect(size - 16 - cw, 16, cw, 10);
  ctx.fillRect(size - 26, 16, 10, cw);
  ctx.fillRect(16, size - 26, cw, 10);
  ctx.fillRect(16, size - 16 - cw, 10, cw);
  ctx.fillRect(size - 16 - cw, size - 26, cw, 10);
  ctx.fillRect(size - 26, size - 16 - cw, 10, cw);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds the complete Stark Tower / Avengers Tower using the high-fidelity
 * 3D model from src/model/stark_tower.glb with full lighting, helipad, and colliders.
 *
 * Positioned in Midtown Manhattan (cx = -52, cz = -156).
 * Height: ~314m, Cantilevered Helipad: ~238.5m.
 */
export function createAvengersTower(x: number, z: number): AvengersTowerResult {
  const group = new THREE.Group();
  group.name = 'StarkTower_Complex';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const rooftopAnchors: THREE.Vector3[] = [];

  // Dedicated container for the GLB model (or placeholder while loading)
  const glbContainer = new THREE.Group();
  glbContainer.name = 'StarkTower_GLB_Slot';
  group.add(glbContainer);

  // Pad coordinates in world space (calculated from model dimensions and rotation)
  const padX = x + 3.0; // -49.0
  const padY = 238.5;
  const padZ = z + 17.0; // -139.0
  const helipadCenter = new THREE.Vector3(padX, padY, padZ);

  // Observation deck & spire tip
  const spireTip = new THREE.Vector3(x, 332, z);
  rooftopAnchors.push(helipadCenter);
  rooftopAnchors.push(new THREE.Vector3(x, 314.5, z));
  rooftopAnchors.push(spireTip);

  // Helper to mount and configure the Stark Tower GLB instance
  const mountStarkTowerGLB = () => {
    const instance = modelManager.createStarkTowerInstance();
    if (!instance) return false;

    // Clear previous children in slot
    while (glbContainer.children.length > 0) {
      glbContainer.remove(glbContainer.children[0]);
    }

    // Orient and scale the tower:
    // Cantilever helipad faces South (+Z) towards the Midtown avenue
    instance.rotation.y = -Math.PI / 2;
    instance.scale.set(6.6, 14.5, 6.6);
    instance.position.set(x, 0, z);
    instance.updateMatrixWorld(true);

    instance.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData = { isBuilding: true, isStarkTower: true };
        buildingMeshes.push(m);
      }
    });

    glbContainer.add(instance);
    return true;
  };

  // 1. Try mounting the GLB immediately if already loaded
  const mounted = mountStarkTowerGLB();

  // If not loaded yet, set up an event listener to mount once stark_tower.glb arrives
  if (!mounted) {
    // Temporary sleek blue glass silhouette while GLB finishes decoding
    const placeholderMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4,
    });
    const placeholderGeo = new THREE.BoxGeometry(46, 310, 58);
    const placeholderMesh = new THREE.Mesh(placeholderGeo, placeholderMat);
    placeholderMesh.position.set(x, 155, z);
    placeholderMesh.castShadow = true;
    placeholderMesh.receiveShadow = true;
    placeholderMesh.userData = { isBuilding: true, isStarkTower: true };
    glbContainer.add(placeholderMesh);
    buildingMeshes.push(placeholderMesh);

    modelManager.onModelsLoaded(() => {
      mountStarkTowerGLB();
    });
  }

  // -------------------------------------------------------------
  // 2. HELIPAD DECAL & RUNWAY LIGHTING (y = 238.5m)
  // -------------------------------------------------------------
  const helipadTex = createHelipadTexture();
  const helipadMat = new THREE.MeshBasicMaterial({
    map: helipadTex,
    toneMapped: false,
  });
  const helipadPlaneGeo = new THREE.PlaneGeometry(28, 28);
  helipadPlaneGeo.rotateX(-Math.PI / 2);
  const helipadPlane = new THREE.Mesh(helipadPlaneGeo, helipadMat);
  helipadPlane.position.set(padX, padY + 0.1, padZ);
  group.add(helipadPlane);

  // Perimeter runway guide lights (cyan LEDs)
  const ledGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8);
  const ledMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    toneMapped: false,
  });
  const padRadius = 13.5;
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(padX + Math.cos(angle) * padRadius, padY + 0.25, padZ + Math.sin(angle) * padRadius);
    group.add(led);
  }

  // -------------------------------------------------------------
  // 3. ILLUMINATED AVENGERS "A" LOGOS
  // -------------------------------------------------------------
  const logoTex = createAvengersLogoTexture();
  const logoMat = new THREE.MeshBasicMaterial({
    map: logoTex,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  });

  // South Logo (facing Midtown Avenue)
  const logoGeo = new THREE.PlaneGeometry(24, 24);
  const southLogo = new THREE.Mesh(logoGeo, logoMat);
  southLogo.position.set(x, 272, z + 24.5);
  group.add(southLogo);

  // East Logo
  const eastLogo = new THREE.Mesh(logoGeo, logoMat);
  eastLogo.position.set(x + 22.5, 272, z);
  eastLogo.rotation.y = Math.PI / 2;
  group.add(eastLogo);

  // West Logo
  const westLogo = new THREE.Mesh(logoGeo, logoMat);
  westLogo.position.set(x - 22.5, 272, z);
  westLogo.rotation.y = -Math.PI / 2;
  group.add(westLogo);

  // -------------------------------------------------------------
  // 4. TOP COMMUNICATIONS SPIRE & WARNING BEACON (y = 314m - 335m)
  // -------------------------------------------------------------
  const spireGeo = new THREE.CylinderGeometry(0.3, 1.2, 22, 8);
  const spireMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.9,
  });
  const spireMesh = new THREE.Mesh(spireGeo, spireMat);
  spireMesh.position.set(x, 323, z);
  spireMesh.castShadow = true;
  group.add(spireMesh);

  // Flashing aeronautical obstacle red beacons
  const beaconGeo = new THREE.SphereGeometry(0.9, 12, 12);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xff0044,
    toneMapped: false,
  });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.set(x, 334.5, z);
  group.add(beaconMesh);

  // -------------------------------------------------------------
  // 5. GROUND LEVEL PLAZA & ENTRANCE PODIUM
  // -------------------------------------------------------------
  const podiumMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.8,
  });
  const podiumGeo = new THREE.BoxGeometry(64, 8, 64);
  const podiumMesh = new THREE.Mesh(podiumGeo, podiumMat);
  podiumMesh.position.set(x, 4, z);
  podiumMesh.receiveShadow = true;
  podiumMesh.userData = { isBuilding: true };
  group.add(podiumMesh);
  buildingMeshes.push(podiumMesh);

  // Entrance canopy facing South
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.25,
    metalness: 0.85,
  });
  const canopyGeo = new THREE.BoxGeometry(26, 1.2, 10);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.position.set(x, 8.5, z + 32);
  group.add(canopyMesh);

  // Glowing "STARK TOWER" street signage on the canopy
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 64;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.fillStyle = '#0f172a';
  sCtx.fillRect(0, 0, 512, 64);
  sCtx.fillStyle = '#38bdf8';
  sCtx.font = 'bold 34px "Chakra Petch", sans-serif';
  sCtx.textAlign = 'center';
  sCtx.textBaseline = 'middle';
  sCtx.shadowColor = '#00f0ff';
  sCtx.shadowBlur = 12;
  sCtx.fillText('STARK TOWER', 256, 32);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false });
  const signGeo = new THREE.PlaneGeometry(24, 3);
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.set(x, 8.5, z + 37.1);
  group.add(signMesh);

  // -------------------------------------------------------------
  // 6. ACCURATE PHYSICS COLLIDERS FOR WALL-RUNNING & LANDING
  // -------------------------------------------------------------
  // Ground podium box
  const podiumBox = new THREE.Box3().setFromObject(podiumMesh);
  buildings.push({
    box: podiumBox,
    mesh: podiumMesh,
    center: new THREE.Vector3(x, 4, z),
    size: new THREE.Vector3(64, 8, 64),
  });

  // Main tower shaft collider (ground to 220m)
  const shaftGeo = new THREE.BoxGeometry(44, 212, 54);
  const shaftDummy = new THREE.Mesh(shaftGeo);
  shaftDummy.position.set(x, 110, z);
  const shaftBox = new THREE.Box3().setFromObject(shaftDummy);
  buildings.push({
    box: shaftBox,
    mesh: shaftDummy,
    center: new THREE.Vector3(x, 110, z),
    size: new THREE.Vector3(44, 212, 54),
  });

  // Cantilevered Helipad platform collider (y = 238.5m)
  const padColGeo = new THREE.BoxGeometry(32, 8, 30);
  const padColMesh = new THREE.Mesh(padColGeo);
  padColMesh.position.set(padX, padY - 3.8, padZ);
  const padColBox = new THREE.Box3().setFromObject(padColMesh);
  buildings.push({
    box: padColBox,
    mesh: padColMesh,
    center: new THREE.Vector3(padX, padY - 3.8, padZ),
    size: new THREE.Vector3(32, 8, 30),
    isRoofStructure: true,
  });

  // Upper crown wedge collider (y = 220m to 300m)
  const crownGeo = new THREE.BoxGeometry(38, 80, 42);
  const crownDummy = new THREE.Mesh(crownGeo);
  crownDummy.position.set(x, 260, z - 2);
  const crownBox = new THREE.Box3().setFromObject(crownDummy);
  buildings.push({
    box: crownBox,
    mesh: crownDummy,
    center: new THREE.Vector3(x, 260, z - 2),
    size: new THREE.Vector3(38, 80, 42),
    isRoofStructure: true,
  });

  // Top observation deck collider (y = 300m to 316m)
  const topDeckGeo = new THREE.BoxGeometry(20, 6, 20);
  const topDeckDummy = new THREE.Mesh(topDeckGeo);
  topDeckDummy.position.set(x, 313, z);
  const topDeckBox = new THREE.Box3().setFromObject(topDeckDummy);
  buildings.push({
    box: topDeckBox,
    mesh: topDeckDummy,
    center: new THREE.Vector3(x, 313, z),
    size: new THREE.Vector3(20, 6, 20),
    isRoofStructure: true,
  });

  return {
    group,
    buildings,
    buildingMeshes,
    rooftopAnchors,
    spireTip,
    helipadCenter,
  };
}
