import * as THREE from 'three';
import { RingCheckpoint } from '../types/physics';

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

  ctx.globalAlpha = 1.0;
  eCtx.globalAlpha = 1.0;

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 6);

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.repeat.set(2, 6);

  return { map, emissiveMap };
}

/**
 * Creates high-definition ground asphalt & road markings texture (1024x1024)
 */
function createHDRoadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Dark asphalt with subtle fine noise grain
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, 1024, 1024);

  // Surface texture noise
  for (let i = 0; i < 6000; i++) {
    const nx = Math.random() * 1024;
    const ny = Math.random() * 1024;
    const gray = Math.floor(20 + Math.random() * 25);
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.fillRect(nx, ny, 2, 2);
  }

  // 2. Concrete sidewalks around block perimeters
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 1024, 48); // Top sidewalk
  ctx.fillRect(0, 1024 - 48, 1024, 48); // Bottom sidewalk
  ctx.fillRect(0, 0, 48, 1024); // Left sidewalk
  ctx.fillRect(1024 - 48, 0, 48, 1024); // Right sidewalk

  // Curbstone borders
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, 1024 - 96, 1024 - 96);

  // 3. Yellow Double Center Divider Lines
  ctx.strokeStyle = '#eab308'; // Amber road paint
  ctx.lineWidth = 4;
  // Vertical center double lines
  ctx.beginPath();
  ctx.moveTo(508, 48);
  ctx.lineTo(508, 1024 - 48);
  ctx.moveTo(516, 48);
  ctx.lineTo(516, 1024 - 48);
  // Horizontal center double lines
  ctx.moveTo(48, 508);
  ctx.lineTo(1024 - 48, 508);
  ctx.moveTo(48, 516);
  ctx.lineTo(1024 - 48, 516);
  ctx.stroke();

  // 4. White Dashed Lane Dividers
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 4;
  ctx.setLineDash([28, 24]);

  ctx.beginPath();
  ctx.moveTo(278, 48);
  ctx.lineTo(278, 1024 - 48);
  ctx.moveTo(746, 48);
  ctx.lineTo(746, 1024 - 48);
  ctx.moveTo(48, 278);
  ctx.lineTo(1024 - 48, 278);
  ctx.moveTo(48, 746);
  ctx.lineTo(1024 - 48, 746);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5. Zebra Crosswalks at intersections
  ctx.fillStyle = '#f8fafc';
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(80 + i * 56, 52, 34, 18);
    ctx.fillRect(80 + i * 56, 1024 - 70, 34, 18);
    ctx.fillRect(52, 80 + i * 56, 18, 34);
    ctx.fillRect(1024 - 70, 80 + i * 56, 18, 34);
  }

  // 6. Manhole covers and storm drain grates
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(420, 420, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

/**
 * Creates procedural high-tech rooftop signage texture ("OSCORP", "DAILY BUGLE", etc.)
 */
function createSignageTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 120);

  ctx.fillStyle = color;
  ctx.font = 'bold 52px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillText(text, 256, 64);

  return new THREE.CanvasTexture(canvas);
}

export function generateCity(timeOfDay: 'sunset' | 'night' | 'day' | 'foggy' = 'sunset'): CityEnvironment {
  const group = new THREE.Group();
  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];

  const buildingTextures = createHDBuildingTextures();
  const roadTexture = createHDRoadTexture();

  // Color palettes tuned for time of day with rich HD atmosphere
  const palette = {
    sunset: {
      facade: 0x334155,
      roof: 0x1e293b,
      trim: 0xf59e0b,
      emissiveIntensity: 0.65,
      ground: 0x0f172a,
    },
    night: {
      facade: 0x1e293b,
      roof: 0x0f172a,
      trim: 0x06b6d4,
      emissiveIntensity: 1.1,
      ground: 0x030712,
    },
    day: {
      facade: 0x64748b,
      roof: 0x334155,
      trim: 0x0284c7,
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

  // Ground plane with HD road textures
  const groundGeo = new THREE.PlaneGeometry(1800, 1800);
  const groundMat = new THREE.MeshStandardMaterial({
    map: roadTexture,
    roughness: 0.85,
    metalness: 0.15,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

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
    color: 0x78350f, // Rich cedar wood
    roughness: 0.8,
    metalness: 0.1,
  });

  const steelStiltMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Industrial steel
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
    { text: 'AVENGERS', color: '#06b6d4' },
    { text: 'STARK', color: '#f59e0b' },
    { text: 'WEBSWING', color: '#38bdf8' },
  ];
  let signIdx = 0;

  // Generate Urban Blocks
  const blockCount = 8;
  const blockSize = 68; // size of each building lot
  const streetWidth = 36;
  const gridStep = blockSize + streetWidth;
  const originOffset = ((blockCount - 1) * gridStep) / 2;

  // Track rooftop points for spawning aerial checkpoints
  const rooftopAnchors: THREE.Vector3[] = [];

  for (let ix = 0; ix < blockCount; ix++) {
    for (let iz = 0; iz < blockCount; iz++) {
      const cx = ix * gridStep - originOffset + (Math.random() - 0.5) * 6;
      const cz = iz * gridStep - originOffset + (Math.random() - 0.5) * 6;

      // Distance from center determines skyline height (higher in central financial district)
      const distFromCenter = Math.sqrt(cx * cx + cz * cz);
      const centerFactor = Math.max(0.3, 1.0 - distFromCenter / 450);

      // Heights range between 55m to 210m
      const baseHeight = 60 + Math.random() * 60 + centerFactor * 90;
      const bWidth = blockSize * (0.76 + Math.random() * 0.24);
      const bDepth = blockSize * (0.76 + Math.random() * 0.24);

      // Main tower body
      const towerGeo = new THREE.BoxGeometry(bWidth, baseHeight, bDepth);
      const towerMesh = new THREE.Mesh(towerGeo, buildingMat);
      towerMesh.position.set(cx, baseHeight / 2, cz);
      towerMesh.castShadow = true;
      towerMesh.receiveShadow = true;

      // User data for raycasting identification
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

        // Glowing crown trim on high-rises
        if (baseHeight > 105) {
          const trimGeo = new THREE.BoxGeometry(tier2Width + 0.8, 1.4, tier2Depth + 0.8);
          const trimMesh = new THREE.Mesh(trimGeo, neonTrimMat);
          trimMesh.position.set(cx, baseHeight + tier2Height, cz);
          group.add(trimMesh);

          // Tall antenna spire
          const mastGeo = new THREE.CylinderGeometry(0.3, 0.7, 22, 8);
          const mastMesh = new THREE.Mesh(mastGeo, roofMat);
          mastMesh.position.set(cx, baseHeight + tier2Height + 11, cz);
          group.add(mastMesh);

          // Pulsing red beacon light at antenna tip
          const beaconGeo = new THREE.SphereGeometry(0.9, 12, 12);
          const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
          const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
          beaconMesh.position.set(cx, baseHeight + tier2Height + 22, cz);
          group.add(beaconMesh);

          // Select megatowers get an illuminated neon corporate sign
          if (signIdx < corporateSigns.length && Math.random() > 0.4) {
            const signData = corporateSigns[signIdx++];
            const signTex = createSignageTexture(signData.text, signData.color);
            const signGeo = new THREE.PlaneGeometry(tier2Width * 0.85, 9);
            const signMat = new THREE.MeshBasicMaterial({
              map: signTex,
              side: THREE.DoubleSide,
            });
            const signMesh = new THREE.Mesh(signGeo, signMat);
            signMesh.position.set(cx, baseHeight + tier2Height - 5, cz + tier2Depth / 2 + 0.3);
            group.add(signMesh);
          }
        }
      } else if (featureChance > 0.55) {
        // Helipad on flat rooftop
        const helipadGeo = new THREE.CylinderGeometry(11, 11, 0.4, 24);
        const helipadMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.8,
          metalness: 0.2,
        });
        const helipadMesh = new THREE.Mesh(helipadGeo, helipadMat);
        helipadMesh.position.set(cx, baseHeight + 0.2, cz);
        group.add(helipadMesh);

        // Helipad yellow circle border
        const ringGeo = new THREE.RingGeometry(8.5, 9.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(cx, baseHeight + 0.42, cz);
        group.add(ringMesh);
      } else if (featureChance > 0.25) {
        // Classic NYC Wooden Cedar Water Tower on rooftop
        const tankGroup = new THREE.Group();
        tankGroup.position.set(
          cx + (Math.random() - 0.5) * (bWidth * 0.35),
          baseHeight,
          cz + (Math.random() - 0.5) * (bDepth * 0.35)
        );

        // Steel support stilts
        const stiltGeo = new THREE.CylinderGeometry(0.2, 0.2, 5, 6);
        for (let s = 0; s < 4; s++) {
          const stilt = new THREE.Mesh(stiltGeo, steelStiltMat);
          const angle = (s * Math.PI) / 2;
          stilt.position.set(Math.cos(angle) * 2.2, 2.5, Math.sin(angle) * 2.2);
          tankGroup.add(stilt);
        }

        // Wooden cylinder barrel
        const barrelGeo = new THREE.CylinderGeometry(2.8, 2.8, 5.5, 16);
        const barrelMesh = new THREE.Mesh(barrelGeo, waterTankMat);
        barrelMesh.position.y = 7.75;
        tankGroup.add(barrelMesh);

        // Conical roof cap
        const capGeo = new THREE.ConeGeometry(3.1, 2.2, 16);
        const capMesh = new THREE.Mesh(capGeo, roofMat);
        capMesh.position.y = 11.5;
        tankGroup.add(capMesh);

        group.add(tankGroup);
      } else {
        // Heavy industrial rooftop HVAC chillers with circular fans
        const hvacGeo = new THREE.BoxGeometry(9, 4.5, 9);
        const hvacMesh = new THREE.Mesh(hvacGeo, roofMat);
        hvacMesh.position.set(
          cx + (Math.random() - 0.5) * (bWidth * 0.4),
          baseHeight + 2.25,
          cz + (Math.random() - 0.5) * (bDepth * 0.4)
        );
        group.add(hvacMesh);

        // Circular fan exhaust on top
        const fanGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.8, 16);
        const fanMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.3 });
        const fanMesh = new THREE.Mesh(fanGeo, fanMat);
        fanMesh.position.set(hvacMesh.position.x, baseHeight + 4.9, hvacMesh.position.z);
        group.add(fanMesh);
      }
    }
  }

  // Generate Aerial Ring Checkpoints Course for Ring Challenge mode
  const checkpointRings: RingCheckpoint[] = [];
  const ringMeshes: THREE.Group[] = [];

  const courseWaypoints: [number, number, number][] = [
    [0, 55, 60],
    [50, 48, 110],
    [100, 62, 70],
    [140, 75, 0],
    [110, 58, -80],
    [30, 45, -120],
    [-60, 52, -100],
    [-110, 68, -40],
    [-90, 54, 40],
    [-30, 48, 90],
    [0, 65, 140],
    [70, 72, 170],
  ];

  courseWaypoints.forEach((pt, idx) => {
    const ringGroup = new THREE.Group();
    ringGroup.position.set(pt[0], pt[1], pt[2]);

    // Torus ring geometry
    const ringGeo = new THREE.TorusGeometry(5.2, 0.45, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringGroup.add(ringMesh);

    // Inner glowing ring pulse
    const innerGeo = new THREE.RingGeometry(0.1, 4.8, 24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    ringGroup.add(innerMesh);

    // Orient ring toward next waypoint
    const nextPt = courseWaypoints[(idx + 1) % courseWaypoints.length];
    const lookTarget = new THREE.Vector3(nextPt[0], nextPt[1], nextPt[2]);
    ringGroup.lookAt(lookTarget);

    group.add(ringGroup);
    ringMeshes.push(ringGroup);

    checkpointRings.push({
      id: idx,
      position: pt,
      radius: 5.2,
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
  };
}
