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
 * Creates dynamic procedural window canvas texture for building facades
 */
function createBuildingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Background concrete / dark glass
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Structural vertical mullions
  ctx.fillStyle = '#0f172a';
  for (let x = 0; x < canvas.width; x += 32) {
    ctx.fillRect(x, 0, 4, canvas.height);
  }

  // Windows grid
  const cols = 16;
  const rows = 64;
  const colW = canvas.width / cols;
  const rowH = canvas.height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isLit = Math.random() > 0.45;
      if (isLit) {
        // Warm interior or cool cyan office glow
        const isWarm = Math.random() > 0.3;
        ctx.fillStyle = isWarm ? '#fed7aa' : '#93c5fd';
        ctx.globalAlpha = 0.5 + Math.random() * 0.4;
      } else {
        // Dark unlit glass reflection
        ctx.fillStyle = '#334155';
        ctx.globalAlpha = 0.9;
      }
      ctx.fillRect(c * colW + 4, r * rowH + 2, colW - 8, rowH - 4);
    }
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  return texture;
}

/**
 * Creates ground asphalt & road markings texture
 */
function createRoadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 512, 512);

  // Grid road lanes
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, 512, 512);

  // Dashed lane lines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

export function generateCity(timeOfDay: 'sunset' | 'night' | 'day' | 'foggy' = 'sunset'): CityEnvironment {
  const group = new THREE.Group();
  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];

  const buildingTexture = createBuildingTexture();
  const roadTexture = createRoadTexture();

  // Color palettes tuned for time of day
  const palette = {
    sunset: {
      facade: 0x2b3952,
      roof: 0x1a2333,
      trim: 0xf59e0b,
      ground: 0x0f172a,
    },
    night: {
      facade: 0x131a29,
      roof: 0x0b101c,
      trim: 0x06b6d4,
      ground: 0x030712,
    },
    day: {
      facade: 0x475569,
      roof: 0x334155,
      trim: 0x94a3b8,
      ground: 0x1e293b,
    },
    foggy: {
      facade: 0x334155,
      roof: 0x1e293b,
      trim: 0x64748b,
      ground: 0x0f172a,
    },
  }[timeOfDay];

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(1600, 1600);
  const groundMat = new THREE.MeshStandardMaterial({
    map: roadTexture,
    roughness: 0.85,
    metalness: 0.1,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // Common materials
  const buildingMat = new THREE.MeshStandardMaterial({
    color: palette.facade,
    map: buildingTexture,
    roughness: 0.4,
    metalness: 0.3,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: palette.roof,
    roughness: 0.8,
    metalness: 0.2,
  });

  const neonTrimMat = new THREE.MeshBasicMaterial({
    color: palette.trim,
  });

  // Generate Urban Blocks
  // Grid layout: 10 x 10 blocks, each block is separated by streets of width 36m
  const blockCount = 8;
  const blockSize = 65; // size of each building lot
  const streetWidth = 35;
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

      // Heights range between 45m to 190m
      const baseHeight = 55 + Math.random() * 55 + centerFactor * 85;
      const bWidth = blockSize * (0.75 + Math.random() * 0.25);
      const bDepth = blockSize * (0.75 + Math.random() * 0.25);

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

      // Architectural features: Roof setbacks, helipads, water towers, and antennas
      const featureChance = Math.random();
      if (featureChance > 0.4 && baseHeight > 70) {
        // Second tier / setback
        const tier2Height = 15 + Math.random() * 25;
        const tier2Width = bWidth * 0.65;
        const tier2Depth = bDepth * 0.65;
        const tier2Geo = new THREE.BoxGeometry(tier2Width, tier2Height, tier2Depth);
        const tier2Mesh = new THREE.Mesh(tier2Geo, buildingMat);
        tier2Mesh.position.set(cx, baseHeight + tier2Height / 2, cz);
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
        if (baseHeight > 110) {
          const trimGeo = new THREE.BoxGeometry(tier2Width + 0.6, 1.2, tier2Depth + 0.6);
          const trimMesh = new THREE.Mesh(trimGeo, neonTrimMat);
          trimMesh.position.set(cx, baseHeight + tier2Height, cz);
          group.add(trimMesh);

          // Antenna mast
          const mastGeo = new THREE.CylinderGeometry(0.3, 0.6, 18, 8);
          const mastMesh = new THREE.Mesh(mastGeo, roofMat);
          mastMesh.position.set(cx, baseHeight + tier2Height + 9, cz);
          group.add(mastMesh);

          // Beacon light at antenna tip
          const beaconGeo = new THREE.SphereGeometry(0.8, 8, 8);
          const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
          const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
          beaconMesh.position.set(cx, baseHeight + tier2Height + 18, cz);
          group.add(beaconMesh);
        }
      } else if (featureChance > 0.2) {
        // Water tower or HVAC units on roof
        const hvacGeo = new THREE.BoxGeometry(8, 4, 8);
        const hvacMesh = new THREE.Mesh(hvacGeo, roofMat);
        hvacMesh.position.set(cx + (Math.random() - 0.5) * (bWidth * 0.4), baseHeight + 2, cz + (Math.random() - 0.5) * (bDepth * 0.4));
        group.add(hvacMesh);
      }
    }
  }

  // Generate Aerial Ring Checkpoints Course for Ring Challenge mode
  // A scenic canyon flight route between towers
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
