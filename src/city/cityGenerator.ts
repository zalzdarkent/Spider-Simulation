import * as THREE from 'three';
import { RingCheckpoint } from '../types/physics';
import { StreetPropsGenerator, PropCollider } from './streetProps';
import { TrafficSystem } from './trafficSystem';
import { PedestrianSystem } from './pedestrianSystem';
import { createRoadNetwork } from './roadNetwork';
import { createAvengersTower } from './avengersTower';
import { createWaterSystem } from './waterSystem';
import { createMetroTrainSystem } from './metroTrainSystem';
import {
  createMetroHospital,
  createCommercialMall,
  createDailyBugleBuilding,
  createOscorpTower,
  createFinancialTwinTowers,
} from './specialFacilities';
import { CityObstacles } from '../physics/swingPhysics';

export interface BuildingData {
  box: THREE.Box3;
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  size: THREE.Vector3;
  isRoofStructure?: boolean;
}

export interface CityEnvironment {
  group: THREE.Group;
  buildings: BuildingData[];
  buildingMeshes: THREE.Mesh[];
  groundMesh: THREE.Mesh;
  checkpointRings: RingCheckpoint[];
  ringMeshes: THREE.Group[];
  collectRing: (id: number) => boolean;
  resetRings: () => void;
  updateRings: (time: number) => void;
  update?: (dt: number, time: number, heroPosition?: THREE.Vector3) => void;
  obstacles: CityObstacles;
}

/**
 * Creates high-definition procedural window facade texture and matching emissive map
 */
function createHDBuildingTextures(): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const width = 1024;
  const height = 2048;

  // Diffuse Color Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Emissive Glow Canvas
  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = width;
  emissiveCanvas.height = height;
  const eCtx = emissiveCanvas.getContext('2d')!;

  // 1. Dark graphite metallic structural facade background
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, width, height);

  // 2. High-resolution window grid
  const cols = 20;
  const rows = 80;
  const colW = width / cols;
  const rowH = height / rows;

  // Structural vertical steel columns
  ctx.fillStyle = '#0a0f1d';
  for (let c = 0; c <= cols; c++) {
    const x = c * colW;
    ctx.fillRect(x - 2, 0, 5, height);
  }

  // Horizontal floor divider spandrels
  ctx.fillStyle = '#1e293b';
  for (let r = 0; r <= rows; r++) {
    const y = r * rowH;
    ctx.fillRect(0, y - 3, width, 6);
  }

  // Windows with diverse architectural lighting
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isLit = Math.random() > 0.42;
      const wx = c * colW + 4;
      const wy = r * rowH + 4;
      const ww = colW - 8;
      const wh = rowH - 8;

      if (isLit) {
        // Diverse office lighting profiles
        const lightType = Math.random();
        let fillColor = '#fed7aa'; // Warm halogen
        let emissiveColor = '#f59e0b';

        if (lightType > 0.65) {
          fillColor = '#bae6fd'; // Cool cyan tech office
          emissiveColor = '#0ea5e9';
        } else if (lightType > 0.4) {
          fillColor = '#fef08a'; // Golden office desk
          emissiveColor = '#eab308';
        } else if (lightType > 0.2) {
          fillColor = '#e2e8f0'; // Bright fluorescent
          emissiveColor = '#94a3b8';
        }

        ctx.fillStyle = fillColor;
        ctx.globalAlpha = 0.75 + Math.random() * 0.25;
        ctx.fillRect(wx, wy, ww, wh);

        // Window blinds / mullion details
        if (Math.random() > 0.5) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
          const blindsHeight = wh * (0.2 + Math.random() * 0.5);
          ctx.fillRect(wx, wy, ww, blindsHeight);
        }

        // Emissive mask
        eCtx.fillStyle = emissiveColor;
        eCtx.globalAlpha = 0.85;
        eCtx.fillRect(wx, wy, ww, wh);
      } else {
        // Dark reflective glass with Fresnel depth gradient
        const grad = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(0.5, '#334155');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.95;
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 4);

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.repeat.set(2, 4);

  return { map, emissiveMap };
}

/**
 * Creates rooftop neon signs for authentic NYC skyscraper atmosphere
 */
function createNeonRooftopSign(text: string, colorHex: string): THREE.Group {
  const group = new THREE.Group();
  const width = 24;
  const height = 7;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 160);
  ctx.font = '900 84px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Neon text glow
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 256, 80);

  ctx.lineWidth = 4;
  ctx.strokeStyle = colorHex;
  ctx.strokeText(text, 256, 80);

  const tex = new THREE.CanvasTexture(canvas);
  const signMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const signGeo = new THREE.PlaneGeometry(width, height);
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.y = height / 2 + 1.5;
  group.add(signMesh);

  // Structural steel scaffolding supporting the billboard
  const scaffoldMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 });
  for (const sx of [-width / 2 + 1.5, width / 2 - 1.5]) {
    const postGeo = new THREE.CylinderGeometry(0.18, 0.18, height + 3, 6);
    const post = new THREE.Mesh(postGeo, scaffoldMat);
    post.position.set(sx, (height + 3) / 2, -0.4);
    group.add(post);

    const braceGeo = new THREE.CylinderGeometry(0.12, 0.12, height * 1.3, 6);
    const brace = new THREE.Mesh(braceGeo, scaffoldMat);
    brace.position.set(sx, height / 2, -1.8);
    brace.rotation.x = Math.PI / 5;
    group.add(brace);
  }

  return group;
}

export function generateCity(timeOfDay: 'sunset' | 'night' | 'day' | 'foggy' = 'sunset'): CityEnvironment {
  const group = new THREE.Group();
  group.name = 'CityEnvironment';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const buildingTextures = createHDBuildingTextures();

  // Dynamic color palette per time of day
  const palette = {
    sunset: {
      facade: 0x242838,
      roof: 0x181a24,
      trim: 0xf59e0b,
      emissiveIntensity: 0.85,
      ground: 0x1e293b,
    },
    night: {
      facade: 0x0f172a,
      roof: 0x090d16,
      trim: 0x38bdf8,
      emissiveIntensity: 1.25,
      ground: 0x090d16,
    },
    day: {
      facade: 0x475569,
      roof: 0x334155,
      trim: 0xe2e8f0,
      emissiveIntensity: 0.25,
      ground: 0x1e293b,
    },
    foggy: {
      facade: 0x475569,
      roof: 0x1e293b,
      trim: 0x38bdf8,
      emissiveIntensity: 0.45,
      ground: 0x0f172a,
    },
  }[timeOfDay];

  // Expanded Urban Grid dimensions: 10x10 city grid (100 blocks = 1040m wide Manhattan island)
  const blockCount = 10;
  const blockSize = 68; // size of each building lot
  const streetWidth = 36;
  const gridStep = blockSize + streetWidth; // 104m
  const originOffset = ((blockCount - 1) * gridStep) / 2; // 468m
  const islandWidth = blockCount * gridStep; // 1040m

  // Central Park coordinates: 2x2 blocks in North-Central Manhattan (centered around X = 0, Z = 208)
  const parkBlocks = [
    { ix: 4, iz: 6 },
    { ix: 5, iz: 6 },
    { ix: 4, iz: 7 },
    { ix: 5, iz: 7 },
  ];

  // Avengers Tower coordinate: Midtown Manhattan
  const avengersBlock = { ix: 4, iz: 3 };

  // Metro General Hospital & Trauma Center (Healthcare facility with ER & Helipad)
  const hospitalBlock = { ix: 3, iz: 6 };

  // Grand Metropolis Plaza & Shopping Mall (Commercial Retail & Atrium)
  const mallBlock = { ix: 6, iz: 4 };

  // Daily Bugle Building (Art-deco skyscraper with rotating globe and red neon)
  const dailyBugleBlock = { ix: 5, iz: 3 };

  // Oscorp Corporate Tower (High-tech emerald green glass spire)
  const oscorpBlock = { ix: 3, iz: 4 };

  // Financial District Twin Towers & Skybridge
  const financialTowersBlock = { ix: 6, iz: 2 };

  // Callbacks for dynamic landmark animations (e.g. rotating Daily Bugle globe)
  const facilityUpdates: ((dt: number, time: number) => void)[] = [];

  // Calculate avenue (N-S) and street (E-W) coordinates
  const avenues: number[] = [];
  const streets: number[] = [];
  for (let i = 0; i < blockCount - 1; i++) {
    const coord = (i + 0.5) * gridStep - originOffset;
    avenues.push(coord);
    streets.push(coord);
  }

  // Realistic Road Network: Asphalt Roadways, Elevated Concrete Sidewalks, Park Greenery, and Crisp Markings
  const roadNetwork = createRoadNetwork({
    avenues,
    streets,
    blockCount,
    blockSize,
    streetWidth,
    originOffset,
    timeOfDay,
    parkBlocks,
  });
  group.add(roadNetwork.group);
  const groundMesh = roadNetwork.groundMesh;

  // Surrounding Ocean, Hudson River, East River, Central Park Lake, and Waterfront Promenade
  const lakeCenter = new THREE.Vector3(0, 0, (6.5 * gridStep) - originOffset);
  const lakeRadiusX = 56;
  const lakeRadiusZ = 46;

  const waterSystem = createWaterSystem({
    islandWidth,
    lakeCenter,
    lakeRadiusX,
    lakeRadiusZ,
    timeOfDay,
  });
  group.add(waterSystem.group);

  // Common HD building materials
  const buildingMat = new THREE.MeshStandardMaterial({
    color: palette.facade,
    map: buildingTextures.map,
    emissive: 0xffffff,
    emissiveMap: buildingTextures.emissiveMap,
    emissiveIntensity: palette.emissiveIntensity,
    roughness: 0.35,
    metalness: 0.45,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: palette.roof,
    roughness: 0.75,
    metalness: 0.3,
  });

  const waterTankMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.8,
    metalness: 0.1,
  });

  const steelStiltMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.8,
  });

  const neonTrimMat = new THREE.MeshBasicMaterial({
    color: palette.trim,
  });

  // Skyscraper rooftop signs list
  const corporateSigns = [
    { text: 'OSCORP', color: '#10b981' },
    { text: 'DAILY BUGLE', color: '#ef4444' },
    { text: 'BAXTER', color: '#38bdf8' },
    { text: 'RAND CORP', color: '#f59e0b' },
    { text: 'WEBSWING', color: '#06b6d4' },
  ];
  let signIdx = 0;

  // Track rooftop points for spawning aerial checkpoints
  const rooftopAnchors: THREE.Vector3[] = [];

  for (let ix = 0; ix < blockCount; ix++) {
    for (let iz = 0; iz < blockCount; iz++) {
      const cx = ix * gridStep - originOffset + (Math.random() - 0.5) * 6;
      const cz = iz * gridStep - originOffset + (Math.random() - 0.5) * 6;

      // 1. Central Park Cutout (No skyscrapers! Open lake, lawn, and park trees)
      const isPark = parkBlocks.some((p) => p.ix === ix && p.iz === iz);
      if (isPark) {
        continue;
      }

      // 2. Avengers Tower (Soaring 380m Stark skyscraper with Quinjet helipad & illuminated logos)
      if (ix === avengersBlock.ix && iz === avengersBlock.iz) {
        const avengersTower = createAvengersTower(cx, cz);
        group.add(avengersTower.group);
        buildings.push(...avengersTower.buildings);
        buildingMeshes.push(...avengersTower.buildingMeshes);
        rooftopAnchors.push(...avengersTower.rooftopAnchors);
        continue;
      }

      // 3. Healthcare Infrastructure: Metro General Hospital & Emergency Trauma Center
      if (ix === hospitalBlock.ix && iz === hospitalBlock.iz) {
        const hospital = createMetroHospital(cx, cz, buildingTextures);
        group.add(hospital.group);
        buildings.push(...hospital.buildings);
        buildingMeshes.push(...hospital.buildingMeshes);
        rooftopAnchors.push(...hospital.rooftopAnchors);
        if (hospital.update) facilityUpdates.push(hospital.update);
        continue;
      }

      // 4. Commercial Infrastructure: Grand Metropolis Plaza & Shopping Mall
      if (ix === mallBlock.ix && iz === mallBlock.iz) {
        const mall = createCommercialMall(cx, cz, buildingTextures);
        group.add(mall.group);
        buildings.push(...mall.buildings);
        buildingMeshes.push(...mall.buildingMeshes);
        rooftopAnchors.push(...mall.rooftopAnchors);
        if (mall.update) facilityUpdates.push(mall.update);
        continue;
      }

      // 5. Office / News Headquarters: The Daily Bugle Building
      if (ix === dailyBugleBlock.ix && iz === dailyBugleBlock.iz) {
        const dailyBugle = createDailyBugleBuilding(cx, cz, buildingTextures);
        group.add(dailyBugle.group);
        buildings.push(...dailyBugle.buildings);
        buildingMeshes.push(...dailyBugle.buildingMeshes);
        rooftopAnchors.push(...dailyBugle.rooftopAnchors);
        if (dailyBugle.update) facilityUpdates.push(dailyBugle.update);
        continue;
      }

      // 6. Corporate High-Tech Spire: Oscorp Industries Tower
      if (ix === oscorpBlock.ix && iz === oscorpBlock.iz) {
        const oscorp = createOscorpTower(cx, cz, buildingTextures);
        group.add(oscorp.group);
        buildings.push(...oscorp.buildings);
        buildingMeshes.push(...oscorp.buildingMeshes);
        rooftopAnchors.push(...oscorp.rooftopAnchors);
        if (oscorp.update) facilityUpdates.push(oscorp.update);
        continue;
      }

      // 7. Corporate Financial District: Financial Twin Towers & High-Altitude Skybridge
      if (ix === financialTowersBlock.ix && iz === financialTowersBlock.iz) {
        const finTowers = createFinancialTwinTowers(cx, cz, buildingTextures);
        group.add(finTowers.group);
        buildings.push(...finTowers.buildings);
        buildingMeshes.push(...finTowers.buildingMeshes);
        rooftopAnchors.push(...finTowers.rooftopAnchors);
        if (finTowers.update) facilityUpdates.push(finTowers.update);
        continue;
      }

      // 8. Regular Skyscraper generation
      const distFromCenter = Math.sqrt(cx * cx + cz * cz);
      const centerFactor = Math.max(0.3, 1.0 - distFromCenter / 550);

      const baseHeight = 60 + Math.random() * 65 + centerFactor * 105;
      const bWidth = blockSize * (0.76 + Math.random() * 0.24);
      const bDepth = blockSize * (0.76 + Math.random() * 0.24);

      // Main tower body
      const towerGeo = new THREE.BoxGeometry(bWidth, baseHeight, bDepth);
      const towerMesh = new THREE.Mesh(towerGeo, buildingMat);
      towerMesh.position.set(cx, baseHeight / 2, cz);
      towerMesh.castShadow = true;
      towerMesh.receiveShadow = true;

      towerMesh.userData = { isBuilding: true, height: baseHeight };
      group.add(towerMesh);
      buildingMeshes.push(towerMesh);

      // Bounding box for physics collision
      const box = new THREE.Box3();
      box.setFromObject(towerMesh);
      buildings.push({
        box,
        mesh: towerMesh,
        center: new THREE.Vector3(cx, baseHeight / 2, cz),
        size: new THREE.Vector3(bWidth, baseHeight, bDepth),
      });

      rooftopAnchors.push(new THREE.Vector3(cx, baseHeight, cz));

      // Architectural features: Roof setbacks, helipads, water towers, antennas, neon signs
      const featureChance = Math.random();

      if (featureChance > 0.35 && baseHeight > 75) {
        // Second tier / architectural setback
        const tier2Height = 18 + Math.random() * 26;
        const tier2Width = bWidth * 0.68;
        const tier2Depth = bDepth * 0.68;
        const tier2Geo = new THREE.BoxGeometry(tier2Width, tier2Height, tier2Depth);
        const tier2Mesh = new THREE.Mesh(tier2Geo, buildingMat);
        tier2Mesh.position.set(cx, baseHeight + tier2Height / 2, cz);
        tier2Mesh.castShadow = true;
        tier2Mesh.receiveShadow = true;
        tier2Mesh.userData = { isBuilding: true };
        group.add(tier2Mesh);
        buildingMeshes.push(tier2Mesh);

        const tier2Box = new THREE.Box3();
        tier2Box.setFromObject(tier2Mesh);
        buildings.push({
          box: tier2Box,
          mesh: tier2Mesh,
          center: new THREE.Vector3(cx, baseHeight + tier2Height / 2, cz),
          size: new THREE.Vector3(tier2Width, tier2Height, tier2Depth),
          isRoofStructure: true,
        });

        // Glowing neon roof perimeter trim
        const trimGeo = new THREE.BoxGeometry(tier2Width + 0.8, 0.45, tier2Depth + 0.8);
        const trimMesh = new THREE.Mesh(trimGeo, neonTrimMat);
        trimMesh.position.set(cx, baseHeight + tier2Height, cz);
        group.add(trimMesh);

        rooftopAnchors.push(new THREE.Vector3(cx, baseHeight + tier2Height, cz));
      }

      // Rooftop props
      const propRoll = Math.random();
      const roofY = baseHeight;

      if (propRoll > 0.72) {
        // Helipad
        const padRadius = Math.min(bWidth, bDepth) * 0.34;
        const padGeo = new THREE.CylinderGeometry(padRadius, padRadius, 0.35, 24);
        const padMesh = new THREE.Mesh(padGeo, roofMat);
        padMesh.position.set(cx, roofY + 0.18, cz);
        padMesh.receiveShadow = true;
        group.add(padMesh);

        // Helipad "H" Marking
        const hCanvas = document.createElement('canvas');
        hCanvas.width = 256;
        hCanvas.height = 256;
        const hCtx = hCanvas.getContext('2d')!;
        hCtx.fillStyle = '#0f172a';
        hCtx.fillRect(0, 0, 256, 256);
        hCtx.strokeStyle = '#eab308';
        hCtx.lineWidth = 14;
        hCtx.beginPath();
        hCtx.arc(128, 128, 108, 0, Math.PI * 2);
        hCtx.stroke();
        hCtx.fillStyle = '#f8fafc';
        hCtx.font = 'bold 120px sans-serif';
        hCtx.textAlign = 'center';
        hCtx.textBaseline = 'middle';
        hCtx.fillText('H', 128, 132);

        const hTex = new THREE.CanvasTexture(hCanvas);
        const hMat = new THREE.MeshBasicMaterial({ map: hTex });
        const hPlane = new THREE.Mesh(new THREE.PlaneGeometry(padRadius * 1.6, padRadius * 1.6), hMat);
        hPlane.rotation.x = -Math.PI / 2;
        hPlane.position.set(cx, roofY + 0.36, cz);
        group.add(hPlane);
      } else if (propRoll > 0.45) {
        // NYC Wooden Water Tower
        const tankHeight = 5.2;
        const tankRadius = 2.4;
        const tankGeo = new THREE.CylinderGeometry(tankRadius, tankRadius, tankHeight, 16);
        const tankMesh = new THREE.Mesh(tankGeo, waterTankMat);
        tankMesh.position.set(cx + 6, roofY + 3.2 + tankHeight / 2, cz + 6);
        tankMesh.castShadow = true;
        group.add(tankMesh);

        // Conical Roof cap
        const capGeo = new THREE.ConeGeometry(tankRadius * 1.15, 2.2, 16);
        const capMesh = new THREE.Mesh(capGeo, roofMat);
        capMesh.position.set(cx + 6, roofY + 3.2 + tankHeight + 1.1, cz + 6);
        group.add(capMesh);

        // Steel Stilt Legs
        for (const ox of [-1.8, 1.8]) {
          for (const oz of [-1.8, 1.8]) {
            const stiltGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6);
            const stilt = new THREE.Mesh(stiltGeo, steelStiltMat);
            stilt.position.set(cx + 6 + ox, roofY + 1.6, cz + 6 + oz);
            stilt.castShadow = true;
            group.add(stilt);
          }
        }
      } else if (propRoll > 0.25 && signIdx < corporateSigns.length) {
        // Corporate Neon Billboard
        const sInfo = corporateSigns[signIdx++];
        const sign = createNeonRooftopSign(sInfo.text, sInfo.color);
        sign.position.set(cx, roofY, cz);
        group.add(sign);
      } else {
        // Transmission Antenna / Spire
        const antHeight = 22 + Math.random() * 20;
        const antGeo = new THREE.CylinderGeometry(0.12, 0.45, antHeight, 8);
        const antMesh = new THREE.Mesh(antGeo, steelStiltMat);
        antMesh.position.set(cx, roofY + antHeight / 2, cz);
        antMesh.castShadow = true;
        group.add(antMesh);

        // Red flashing warning beacon light
        const lightGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
        const lightMesh = new THREE.Mesh(lightGeo, lightMat);
        lightMesh.position.set(cx, roofY + antHeight, cz);
        group.add(lightMesh);
      }
    }
  }

  // Waypoints for aerial web-swinging ring challenges: through avenues, Central Park Lake, and Avengers Tower!
  const courseWaypoints: [number, number, number][] = [
    [0, 36, -60],
    [-52, 218, -156], // Avengers Tower Helipad pass!
    [-104, 85, -50],
    [-208, 62, 50],
    [-104, 52, 120],
    [0, 38, 208], // Central Park Lake sweep!
    [104, 58, 140],
    [208, 70, 40],
    [104, 55, -80],
    [0, 48, -120],
  ];

  const checkpointRings: RingCheckpoint[] = [];
  const ringMeshes: THREE.Group[] = [];

  courseWaypoints.forEach((pt, idx) => {
    const ringGroup = new THREE.Group();
    ringGroup.position.set(pt[0], pt[1], pt[2]);

    const ringGeo = new THREE.TorusGeometry(5.4, 0.45, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringGroup.add(ringMesh);

    const innerGeo = new THREE.RingGeometry(0.1, 5.0, 24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    ringGroup.add(innerMesh);

    const nextPt = courseWaypoints[(idx + 1) % courseWaypoints.length];
    const lookTarget = new THREE.Vector3(nextPt[0], nextPt[1], nextPt[2]);
    ringGroup.lookAt(lookTarget);

    group.add(ringGroup);
    ringMeshes.push(ringGroup);

    checkpointRings.push({
      id: idx,
      position: pt,
      radius: 5.4,
      normal: [0, 0, 1],
      collected: false,
    });
  });

  const collectRing = (id: number): boolean => {
    const ring = checkpointRings.find((r) => r.id === id);
    if (ring && !ring.collected) {
      ring.collected = true;
      const meshGroup = ringMeshes[id];
      if (meshGroup) {
        meshGroup.visible = false;
      }
      return true;
    }
    return false;
  };

  const resetRings = () => {
    checkpointRings.forEach((r, idx) => {
      r.collected = false;
      if (ringMeshes[idx]) {
        ringMeshes[idx].visible = true;
        ringMeshes[idx].scale.set(1, 1, 1);
      }
    });
  };

  const updateRings = (time: number) => {
    ringMeshes.forEach((meshGroup, idx) => {
      if (!checkpointRings[idx].collected) {
        meshGroup.rotation.z = time * 1.5 + idx * 0.4;
        const pulse = 1.0 + Math.sin(time * 3 + idx) * 0.08;
        meshGroup.scale.set(pulse, pulse, 1);
      }
    });
  };

  // Generate Street Props (Trees, Street Lamps, Benches, Hydrants, Bus Shelters, Mailboxes)
  const parkArea = {
    minX: 4 * gridStep - originOffset - 36,
    maxX: 5 * gridStep - originOffset + 36,
    minZ: 6 * gridStep - originOffset - 36,
    maxZ: 7 * gridStep - originOffset + 36,
  };

  const streetPropsResult = StreetPropsGenerator.createProps({
    timeOfDay,
    avenues,
    streets,
    parkArea,
  });
  group.add(streetPropsResult.group);

  // Generate Elevated Metro Railway, Viaduct, Stations & Commuter Train
  const metroTrain = createMetroTrainSystem({
    avenueX: avenues[3] ?? -104,
    minZ: streets.length > 0 ? streets[0] - 25 : -450,
    maxZ: streets.length > 0 ? streets[streets.length - 1] + 25 : 450,
    timeOfDay,
  });
  group.add(metroTrain.group);
  buildings.push(...metroTrain.buildings);
  buildingMeshes.push(...metroTrain.buildingMeshes);

  // Generate Dynamic Traffic Fleet (Taxis, Buses, Police Cruisers, Sedans, Delivery Vans, Parked Cars)
  const trafficSystem = new TrafficSystem({
    timeOfDay,
    avenues,
    streets,
  });
  group.add(trafficSystem.group);

  // Generate Pedestrian NPCs (Sidewalk Walkers, Rooftop Citizens, Cheering Reactions)
  const pedestrianSystem = new PedestrianSystem({
    avenues,
    streets,
    rooftops: rooftopAnchors,
  });
  group.add(pedestrianSystem.group);

  // Consolidate static and dynamic obstacle colliders
  const staticColliders: PropCollider[] = [
    ...streetPropsResult.colliders,
  ];

  waterSystem.seawallColliders.forEach((w) => {
    staticColliders.push({
      type: 'box',
      center: new THREE.Vector3((w.min.x + w.max.x) / 2, (w.min.y + w.max.y) / 2, (w.min.z + w.max.z) / 2),
      box: new THREE.Box3(w.min, w.max),
    });
  });

  const obstacles: CityObstacles = {
    staticColliders,
    getVehicleColliders: () => {
      const colliders = trafficSystem.getColliders();
      const trainBox = metroTrain.getTrainRoofBox();
      if (trainBox) {
        colliders.push({ box: trainBox, isMoving: true });
      }
      return colliders;
    },
    getPedestrianColliders: () => pedestrianSystem.getColliders(),
    isWaterAt: (x, z) => waterSystem.isWaterAt(x, z),
    getWaterLevel: (x, z) => waterSystem.getWaterLevel(x, z),
  };

  const update = (dt: number, time: number, heroPosition?: THREE.Vector3) => {
    updateRings(time);
    waterSystem.update(time);
    metroTrain.update(dt, time, heroPosition);
    facilityUpdates.forEach((fn) => fn(dt, time));
    trafficSystem.update(dt);
    pedestrianSystem.update(dt, heroPosition);
  };

  return {
    group,
    buildings,
    buildingMeshes,
    groundMesh,
    checkpointRings,
    ringMeshes,
    collectRing,
    resetRings,
    updateRings,
    update,
    obstacles,
  };
}
