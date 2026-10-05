import * as THREE from 'three';
import { BuildingData } from './cityGenerator';

export interface MetroTrainSystem {
  group: THREE.Group;
  buildings: BuildingData[];
  buildingMeshes: THREE.Mesh[];
  update: (dt: number, time: number, heroPosition?: THREE.Vector3) => void;
  getTrainRoofBox: () => THREE.Box3 | null;
  getTrackHeight: () => number;
}

interface TrainCar {
  group: THREE.Group;
  mesh: THREE.Mesh;
  box: THREE.Box3;
  type: 'lead' | 'middle' | 'rear';
  offsetZ: number; // Offset relative to train origin
}

/**
 * Creates texture for train passenger windows with illuminated warm interior & commuter silhouettes
 */
function createTrainWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Stainless steel / metallic transit silver background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 128);

  // Blue transit stripe along the top and bottom
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 8, 512, 16);
  ctx.fillRect(0, 104, 512, 16);

  // 6 Illuminated Passenger Windows with warm yellow/cyan interior lighting
  const winCount = 6;
  const winW = 60;
  const winH = 56;
  const spacing = (512 - winCount * winW) / (winCount + 1);

  for (let i = 0; i < winCount; i++) {
    const wx = spacing + i * (winW + spacing);
    const wy = 36;

    // Window frame
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(wx - 3, wy - 3, winW + 6, winH + 6);

    // Warm interior light gradient
    const grad = ctx.createLinearGradient(wx, wy, wx, wy + winH);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(1, '#fed7aa');
    ctx.fillStyle = grad;
    ctx.fillRect(wx, wy, winW, winH);

    // Commuter silhouettes inside window
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    // Head & shoulders silhouette
    ctx.beginPath();
    ctx.arc(wx + 22, wy + 26, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(wx + 12, wy + 34, 20, 22);

    if (i % 2 === 1) {
      ctx.beginPath();
      ctx.arc(wx + 44, wy + 28, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(wx + 36, wy + 35, 16, 21);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * Creates digital LED destination display texture (e.g., "METRO BLUE LINE • EXPRESS")
 */
function createDestinationSignTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 256, 64);

  // LED border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 248, 56);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 8;
  ctx.fillText(text, 128, 32);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Creates high-detail elevated metro railway viaduct, stations, and animated commuter train
 */
export function createMetroTrainSystem(options: {
  avenueX: number;
  minZ: number;
  maxZ: number;
  timeOfDay: 'sunset' | 'night' | 'day' | 'foggy';
}): MetroTrainSystem {
  const group = new THREE.Group();
  group.name = 'MetroTrainSystem';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];

  const { avenueX, minZ, maxZ } = options;
  const trackHeight = 15.5; // High enough for double-decker buses and city traffic to pass under
  const viaductWidth = 8.8; // Dual track viaduct width
  const viaductLength = maxZ - minZ;

  // --- Shared Materials ---
  const concretePillarMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.85,
    metalness: 0.15,
  });

  const steelGirderMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.75,
  });

  const trackBedMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    metalness: 0.1,
  });

  const railSteelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.25,
    metalness: 0.9,
  });

  const thirdRailMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.4,
    metalness: 0.8,
  });

  const stationGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    transmission: 0.8,
  });

  const stationCanopyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.8,
  });

  // --- 1. Viaduct Support Piers (Columns & Heavy Concrete Crossbeams) ---
  const pillarSpacing = 42; // Every 42m along the avenue
  const pillarCount = Math.floor(viaductLength / pillarSpacing);
  const startZ = minZ + 20;

  for (let i = 0; i <= pillarCount; i++) {
    const pz = startZ + i * pillarSpacing;
    if (pz > maxZ - 10) break;

    // Twin concrete support columns on sidewalk edges (so traffic lanes in middle are open!)
    const colRadius = 0.75;
    const colHeight = trackHeight - 0.8;
    const colGeo = new THREE.CylinderGeometry(colRadius, colRadius * 1.1, colHeight, 16);

    for (const cx of [-viaductWidth / 2 + 0.4, viaductWidth / 2 - 0.4]) {
      const colMesh = new THREE.Mesh(colGeo, concretePillarMat);
      colMesh.position.set(avenueX + cx, colHeight / 2, pz);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      group.add(colMesh);

      // Decorative base plinth
      const baseGeo = new THREE.BoxGeometry(1.9, 1.2, 1.9);
      const baseMesh = new THREE.Mesh(baseGeo, concretePillarMat);
      baseMesh.position.set(avenueX + cx, 0.6, pz);
      group.add(baseMesh);
    }

    // Heavy transverse steel/concrete crossbeam spanning the street
    const beamGeo = new THREE.BoxGeometry(viaductWidth + 1.2, 1.4, 2.2);
    const beamMesh = new THREE.Mesh(beamGeo, steelGirderMat);
    beamMesh.position.set(avenueX, trackHeight - 0.7, pz);
    beamMesh.castShadow = true;
    group.add(beamMesh);

    // Diagonal support brackets
    for (const sign of [-1, 1]) {
      const bracketGeo = new THREE.BoxGeometry(0.5, 3.2, 0.5);
      const bracket = new THREE.Mesh(bracketGeo, steelGirderMat);
      bracket.position.set(avenueX + sign * (viaductWidth / 2 - 1.2), trackHeight - 2.1, pz);
      bracket.rotation.z = sign * (Math.PI / 4);
      group.add(bracket);
    }
  }

  // --- 2. Longitudinal Elevated Track Deck & Rails ---
  const deckSegments = Math.ceil(viaductLength / 60);
  const segLength = viaductLength / deckSegments;

  for (let s = 0; s < deckSegments; s++) {
    const segCenterZ = minZ + segLength * (s + 0.5);

    // Concrete track bed slab
    const slabGeo = new THREE.BoxGeometry(viaductWidth, 0.65, segLength);
    const slabMesh = new THREE.Mesh(slabGeo, trackBedMat);
    slabMesh.position.set(avenueX, trackHeight - 0.15, segCenterZ);
    slabMesh.receiveShadow = true;
    slabMesh.userData = { isBuilding: true, isRoof: true };
    group.add(slabMesh);
    buildingMeshes.push(slabMesh);

    const slabBox = new THREE.Box3().setFromObject(slabMesh);
    buildings.push({
      box: slabBox,
      mesh: slabMesh,
      center: slabMesh.position.clone(),
      size: new THREE.Vector3(viaductWidth, 0.65, segLength),
      isRoofStructure: true,
    });

    // Side safety parapets / steel guardrails
    const railWallGeo = new THREE.BoxGeometry(0.35, 1.2, segLength);
    for (const sideX of [-viaductWidth / 2 + 0.18, viaductWidth / 2 - 0.18]) {
      const wallMesh = new THREE.Mesh(railWallGeo, steelGirderMat);
      wallMesh.position.set(avenueX + sideX, trackHeight + 0.6, segCenterZ);
      wallMesh.castShadow = true;
      group.add(wallMesh);
    }
  }

  // Continuous Steel Rails (Dual tracks: Inbound X = -2.1, Outbound X = +2.1)
  const railGeo = new THREE.BoxGeometry(0.12, 0.18, viaductLength);
  for (const trackX of [-2.4, -1.8, 1.8, 2.4]) {
    const railMesh = new THREE.Mesh(railGeo, railSteelMat);
    railMesh.position.set(avenueX + trackX, trackHeight + 0.26, (minZ + maxZ) / 2);
    group.add(railMesh);
  }

  // Electrified Third Rails (Powered covered busbars)
  const thirdRailGeo = new THREE.BoxGeometry(0.16, 0.22, viaductLength);
  for (const tX of [-3.1, 3.1]) {
    const trMesh = new THREE.Mesh(thirdRailGeo, thirdRailMat);
    trMesh.position.set(avenueX + tX, trackHeight + 0.35, (minZ + maxZ) / 2);
    group.add(trMesh);
  }

  // --- 3. Elevated Metro Stations ---
  // Station 1: Central Midtown Transit Station (near Z = -52)
  // Station 2: North Park Metro Station (near Z = 208)
  const stationLocations = [
    { name: 'METRO CENTRAL STATION', z: -52, length: 72 },
    { name: 'NORTH PARK METRO', z: 208, length: 64 },
  ];

  stationLocations.forEach((st) => {
    const stGroup = new THREE.Group();
    stGroup.name = st.name;

    const platWidth = 3.6;
    const platHeight = 0.55;
    const platY = trackHeight + 0.45; // Flush with train passenger doors

    // Dual Passenger Platforms (East & West of tracks)
    for (const side of [-1, 1]) {
      const platX = avenueX + side * (viaductWidth / 2 + platWidth / 2);

      // Concrete platform slab
      const pGeo = new THREE.BoxGeometry(platWidth, platHeight, st.length);
      const pMesh = new THREE.Mesh(pGeo, concretePillarMat);
      pMesh.position.set(platX, platY, st.z);
      pMesh.receiveShadow = true;
      pMesh.userData = { isBuilding: true, isRoof: true };
      stGroup.add(pMesh);
      buildingMeshes.push(pMesh);

      buildings.push({
        box: new THREE.Box3().setFromObject(pMesh),
        mesh: pMesh,
        center: pMesh.position.clone(),
        size: new THREE.Vector3(platWidth, platHeight, st.length),
        isRoofStructure: true,
      });

      // Yellow tactile safety strip along platform edge
      const edgeGeo = new THREE.BoxGeometry(0.4, 0.05, st.length);
      const edgeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.position.set(platX - side * (platWidth / 2 - 0.25), platY + platHeight / 2 + 0.03, st.z);
      stGroup.add(edgeMesh);

      // Glass and steel aerodynamic passenger canopy
      const canopyY = platY + 3.8;
      const canopyGeo = new THREE.BoxGeometry(platWidth + 0.6, 0.25, st.length);
      const canopyMesh = new THREE.Mesh(canopyGeo, stationCanopyMat);
      canopyMesh.position.set(platX, canopyY, st.z);
      canopyMesh.castShadow = true;
      stGroup.add(canopyMesh);

      // Transparent curved glass skylights in canopy
      const glassGeo = new THREE.PlaneGeometry(platWidth - 0.4, st.length * 0.85);
      const glassMesh = new THREE.Mesh(glassGeo, stationGlassMat);
      glassMesh.rotation.x = -Math.PI / 2;
      glassMesh.position.set(platX, canopyY + 0.15, st.z);
      stGroup.add(glassMesh);

      // Canopy support posts
      const postCount = Math.floor(st.length / 14);
      for (let p = 0; p <= postCount; p++) {
        const pz = st.z - st.length / 2 + p * 14;
        const postGeo = new THREE.CylinderGeometry(0.14, 0.14, 3.6, 8);
        const postMesh = new THREE.Mesh(postGeo, steelGirderMat);
        postMesh.position.set(platX + side * (platWidth / 2 - 0.3), platY + 1.8, pz);
        stGroup.add(postMesh);
      }

      // Station Signs hanging from canopy
      const signTex = createDestinationSignTexture(st.name);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false });
      const signGeo = new THREE.PlaneGeometry(8, 1.8);
      for (const sOffset of [-18, 18]) {
        const signMesh = new THREE.Mesh(signGeo, signMat);
        signMesh.position.set(platX, canopyY - 0.9, st.z + sOffset);
        stGroup.add(signMesh);
        const signBack = signMesh.clone();
        signBack.rotation.y = Math.PI;
        stGroup.add(signBack);
      }

      // Platform Benches
      const benchGeo = new THREE.BoxGeometry(1.2, 0.45, 3.2);
      const benchMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
      for (const bOffset of [-12, 0, 12]) {
        const bench = new THREE.Mesh(benchGeo, benchMat);
        bench.position.set(platX + side * 0.5, platY + 0.45, st.z + bOffset);
        stGroup.add(bench);
      }

      // Pedestrian Stairs connecting platform down to street sidewalk
      const stairZ = st.z + side * (st.length / 2 - 4);
      const stairWidth = 2.4;
      const stairSteps = 16;
      for (let step = 0; step < stairSteps; step++) {
        const t = step / stairSteps;
        const stepY = platY * (1 - t);
        const stepZ = stairZ + (step * 0.9 * (side > 0 ? 1 : -1));
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, 0.4, 0.9), concretePillarMat);
        stepMesh.position.set(platX + side * 1.2, stepY, stepZ);
        stGroup.add(stepMesh);
      }
    }

    group.add(stGroup);
  });

  // --- 4. Animated Commuter Metro Train (4-car electric transit train) ---
  const trainGroup = new THREE.Group();
  trainGroup.name = 'MetroCommuterTrain';

  const carLength = 17.5;
  const carWidth = 3.2;
  const carHeight = 3.4;
  const carSpacing = 0.8;
  const trainCarCount = 4;
  const trainTotalLength = trainCarCount * (carLength + carSpacing);

  const windowTex = createTrainWindowTexture();
  const trainBodyMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, // Stainless steel commuter silver
    roughness: 0.25,
    metalness: 0.8,
  });

  const trainStripeMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7, // Vibrant electric cyan/blue livery
  });

  const trainWindowMat = new THREE.MeshStandardMaterial({
    map: windowTex,
    emissive: 0xffffff,
    emissiveMap: windowTex,
    emissiveIntensity: options.timeOfDay === 'night' ? 1.4 : 0.7,
    roughness: 0.2,
    metalness: 0.3,
  });

  const trainRoofMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.6,
    metalness: 0.4,
  });

  const trainCars: TrainCar[] = [];

  for (let c = 0; c < trainCarCount; c++) {
    const carGroup = new THREE.Group();
    const type: 'lead' | 'middle' | 'rear' =
      c === 0 ? 'lead' : c === trainCarCount - 1 ? 'rear' : 'middle';

    const offsetZ = -c * (carLength + carSpacing);

    // Main Car Body
    const bodyGeo = new THREE.BoxGeometry(carWidth, carHeight, carLength);
    const bodyMesh = new THREE.Mesh(bodyGeo, trainBodyMat);
    bodyMesh.position.y = carHeight / 2 + 0.6; // elevated above bogie
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    carGroup.add(bodyMesh);

    // Glowing window panels on both sides
    const winGeo = new THREE.PlaneGeometry(carLength * 0.9, carHeight * 0.45);
    // East side windows
    const winMeshE = new THREE.Mesh(winGeo, trainWindowMat);
    winMeshE.position.set(carWidth / 2 + 0.02, bodyMesh.position.y + 0.1, 0);
    winMeshE.rotation.y = Math.PI / 2;
    carGroup.add(winMeshE);

    // West side windows
    const winMeshW = new THREE.Mesh(winGeo, trainWindowMat);
    winMeshW.position.set(-carWidth / 2 - 0.02, bodyMesh.position.y + 0.1, 0);
    winMeshW.rotation.y = -Math.PI / 2;
    carGroup.add(winMeshW);

    // Colored livery stripe wrapping the bottom perimeter
    const stripeGeo = new THREE.BoxGeometry(carWidth + 0.04, 0.4, carLength + 0.04);
    const stripeMesh = new THREE.Mesh(stripeGeo, trainStripeMat);
    stripeMesh.position.y = bodyMesh.position.y - carHeight / 2 + 0.6;
    carGroup.add(stripeMesh);

    // Rooftop AC and HVAC condenser units
    for (const rz of [-carLength * 0.28, 0, carLength * 0.28]) {
      const acGeo = new THREE.BoxGeometry(carWidth * 0.65, 0.45, 3.2);
      const acMesh = new THREE.Mesh(acGeo, trainRoofMat);
      acMesh.position.set(0, bodyMesh.position.y + carHeight / 2 + 0.22, rz);
      carGroup.add(acMesh);
    }

    // Lead Car: Aerodynamic slanted nose, destination board, bright headlights
    if (type === 'lead') {
      const noseGeo = new THREE.CylinderGeometry(0.3, carWidth / 2, 2.4, 4);
      const noseMesh = new THREE.Mesh(noseGeo, trainBodyMat);
      noseMesh.rotation.y = Math.PI / 4;
      noseMesh.position.set(0, bodyMesh.position.y, carLength / 2 + 1.1);
      carGroup.add(noseMesh);

      // Windshield glass
      const wsGeo = new THREE.PlaneGeometry(carWidth * 0.8, 1.2);
      const wsMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const wsMesh = new THREE.Mesh(wsGeo, wsMat);
      wsMesh.position.set(0, bodyMesh.position.y + 0.5, carLength / 2 + 0.04);
      carGroup.add(wsMesh);

      // Dual High-Intensity Headlights
      const hlGeo = new THREE.SphereGeometry(0.24, 12, 12);
      const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (const hx of [-0.9, 0.9]) {
        const hl = new THREE.Mesh(hlGeo, hlMat);
        hl.position.set(hx, bodyMesh.position.y - 0.4, carLength / 2 + 0.3);
        carGroup.add(hl);
      }

      // Amber LED Destination Sign
      const destTex = createDestinationSignTexture('METRO BLUE LINE • EXP');
      const destGeo = new THREE.PlaneGeometry(2.2, 0.55);
      const destMesh = new THREE.Mesh(destGeo, new THREE.MeshBasicMaterial({ map: destTex, toneMapped: false }));
      destMesh.position.set(0, bodyMesh.position.y + 1.25, carLength / 2 + 0.08);
      carGroup.add(destMesh);
    }

    // Rear Car: Red LED Tail marker lights
    if (type === 'rear') {
      const tlGeo = new THREE.SphereGeometry(0.2, 12, 12);
      const tlMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      for (const tx of [-0.9, 0.9]) {
        const tl = new THREE.Mesh(tlGeo, tlMat);
        tl.position.set(tx, bodyMesh.position.y - 0.4, -carLength / 2 - 0.05);
        carGroup.add(tl);
      }
    }

    // Steel Wheel Bogies (Front & Rear of each car)
    const bogieGeo = new THREE.CylinderGeometry(0.42, 0.42, carWidth * 0.8, 12);
    bogieGeo.rotateZ(Math.PI / 2);
    for (const bz of [-carLength * 0.35, carLength * 0.35]) {
      const bogie = new THREE.Mesh(bogieGeo, steelGirderMat);
      bogie.position.set(0, 0.42, bz);
      carGroup.add(bogie);
    }

    carGroup.position.set(0, 0, offsetZ);
    trainGroup.add(carGroup);

    trainCars.push({
      group: carGroup,
      mesh: bodyMesh,
      box: new THREE.Box3(),
      type,
      offsetZ,
    });
  }

  // Position train on Outbound Track (X = avenueX + 2.1, Y = trackHeight)
  const trackCoordX = avenueX + 2.1;
  trainGroup.position.set(trackCoordX, trackHeight, minZ + 50);
  group.add(trainGroup);

  // Train animation state
  let trainZ = minZ + 50;
  let trainSpeed = 18.0; // Cruise speed in m/s (~65 km/h)
  let stationStopTimer = 0;
  const targetCruiseSpeed = 20.0;

  const update = (dt: number, _time: number, _heroPos?: THREE.Vector3) => {
    // 1. Station dwell logic
    let shouldDwell = false;
    for (const st of stationLocations) {
      const distToStation = Math.abs(trainZ - st.z);
      if (distToStation < 6.0 && stationStopTimer <= 0) {
        shouldDwell = true;
        break;
      }
    }

    if (shouldDwell) {
      // Decelerate and pause at platform
      trainSpeed = Math.max(0, trainSpeed - 12.0 * dt);
      if (trainSpeed < 0.5) {
        stationStopTimer = 4.5; // Dwell for 4.5 seconds
      }
    } else if (stationStopTimer > 0) {
      stationStopTimer -= dt;
      trainSpeed = 0;
    } else {
      // Accelerate back up to cruising speed
      trainSpeed = Math.min(targetCruiseSpeed, trainSpeed + 8.0 * dt);
    }

    // 2. Advance train position
    trainZ += trainSpeed * dt;
    if (trainZ > maxZ + trainTotalLength) {
      trainZ = minZ - 40; // Loop around from opposite side
      stationStopTimer = 0;
    }

    trainGroup.position.z = trainZ;

    // 3. Update collision bounding boxes for all train cars (for Spider-Man roof surfing!)
    trainCars.forEach((c) => {
      c.box.setFromObject(c.mesh);
    });
  };

  const getTrainRoofBox = (): THREE.Box3 | null => {
    // Returns compound box covering the active train cars
    if (trainCars.length === 0) return null;
    const compound = new THREE.Box3();
    trainCars.forEach((c) => compound.union(c.box));
    return compound;
  };

  return {
    group,
    buildings,
    buildingMeshes,
    update,
    getTrainRoofBox,
    getTrackHeight: () => trackHeight,
  };
}
