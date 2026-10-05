import * as THREE from 'three';
import { BuildingData } from './cityGenerator';

export interface FacilityResult {
  group: THREE.Group;
  buildings: BuildingData[];
  buildingMeshes: THREE.Mesh[];
  rooftopAnchors: THREE.Vector3[];
  update?: (dt: number, time: number) => void;
}

/**
 * Creates illuminated text sign canvas texture
 */
function createSignTexture(
  text: string,
  textColor: string,
  bgColor: string = '#0f172a',
  glowColor?: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 128);

  ctx.fillStyle = textColor;
  ctx.font = '900 48px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
  }

  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * Creates glowing 3D medical cross mesh
 */
function createMedicalCrossMesh(size: number = 4.2, color: number = 0xef4444): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const thickness = size * 0.28;

  // Vertical bar
  const vGeo = new THREE.BoxGeometry(thickness, size, 0.4);
  const vMesh = new THREE.Mesh(vGeo, mat);
  group.add(vMesh);

  // Horizontal bar
  const hGeo = new THREE.BoxGeometry(size, thickness, 0.4);
  const hMesh = new THREE.Mesh(hGeo, mat);
  group.add(hMesh);

  return group;
}

/**
 * 1. HEALTHCARE / HOSPITAL COMPLEX ("METRO GENERAL HOSPITAL & TRAUMA CENTER")
 * - Multi-wing clinical complex with clean composite panels & cyan medical glass
 * - Glowing Red Cross emblems and green emergency signage
 * - ER Emergency Ambulance Drop-Off Bay with covered ambulance canopy
 * - 2 Parked City Ambulances with emergency lightbars
 * - Rooftop LifeFlight Trauma Helipad with painted red cross, yellow perimeter ring, and windsock
 */
export function createMetroHospital(cx: number, cz: number, buildingTextures: any): FacilityResult {
  const group = new THREE.Group();
  group.name = 'MetroGeneralHospital';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const rooftopAnchors: THREE.Vector3[] = [];

  const hospitalWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.35,
    metalness: 0.15,
  });

  const clinicalGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    map: buildingTextures.map,
    emissive: 0x0284c7,
    emissiveMap: buildingTextures.emissiveMap,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.5,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.8,
    metalness: 0.2,
  });

  // A. Main Hospital Bed Tower (Height 130m, 52m x 52m)
  const towerH = 130;
  const towerW = 54;
  const towerD = 54;
  const mainTowerMesh = new THREE.Mesh(
    new THREE.BoxGeometry(towerW, towerH, towerD),
    clinicalGlassMat
  );
  mainTowerMesh.position.set(cx, towerH / 2, cz);
  mainTowerMesh.castShadow = true;
  mainTowerMesh.receiveShadow = true;
  mainTowerMesh.userData = { isBuilding: true, height: towerH };
  group.add(mainTowerMesh);
  buildingMeshes.push(mainTowerMesh);

  buildings.push({
    box: new THREE.Box3().setFromObject(mainTowerMesh),
    mesh: mainTowerMesh,
    center: mainTowerMesh.position.clone(),
    size: new THREE.Vector3(towerW, towerH, towerD),
  });
  rooftopAnchors.push(new THREE.Vector3(cx, towerH, cz));

  // Glowing Red Medical Crosses on 4 sides of the tower top
  const crossOffsets = [
    { x: 0, z: towerD / 2 + 0.3, rotY: 0 },
    { x: 0, z: -towerD / 2 - 0.3, rotY: Math.PI },
    { x: towerW / 2 + 0.3, z: 0, rotY: Math.PI / 2 },
    { x: -towerW / 2 - 0.3, z: 0, rotY: -Math.PI / 2 },
  ];

  crossOffsets.forEach((pos) => {
    const cross = createMedicalCrossMesh(7.5, 0xef4444);
    cross.position.set(cx + pos.x, towerH - 12, cz + pos.z);
    cross.rotation.y = pos.rotY;
    group.add(cross);
  });

  // Illuminated Hospital Signage on front facade
  const hospTex = createSignTexture('METRO GENERAL HOSPITAL', '#ffffff', '#0369a1', '#38bdf8');
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 9),
    new THREE.MeshBasicMaterial({ map: hospTex, toneMapped: false })
  );
  signMesh.position.set(cx, towerH - 24, cz + towerD / 2 + 0.35);
  group.add(signMesh);

  // B. Rooftop Trauma Helipad (Radius 16m)
  const padRadius = 15;
  const padMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(padRadius, padRadius, 0.4, 32),
    roofMat
  );
  padMesh.position.set(cx, towerH + 0.2, cz);
  group.add(padMesh);

  // Helipad Canvas with Red Medical Cross & "H"
  const hCanvas = document.createElement('canvas');
  hCanvas.width = 512;
  hCanvas.height = 512;
  const hCtx = hCanvas.getContext('2d')!;
  hCtx.fillStyle = '#1e293b';
  hCtx.fillRect(0, 0, 512, 512);

  // Yellow warning circle
  hCtx.strokeStyle = '#eab308';
  hCtx.lineWidth = 20;
  hCtx.beginPath();
  hCtx.arc(256, 256, 220, 0, Math.PI * 2);
  hCtx.stroke();

  // Red Medical Cross background
  hCtx.fillStyle = '#ef4444';
  hCtx.fillRect(256 - 45, 256 - 150, 90, 300);
  hCtx.fillRect(256 - 150, 256 - 45, 300, 90);

  // Bold White "H"
  hCtx.fillStyle = '#ffffff';
  hCtx.font = '900 160px sans-serif';
  hCtx.textAlign = 'center';
  hCtx.textBaseline = 'middle';
  hCtx.fillText('H', 256, 262);

  const hTex = new THREE.CanvasTexture(hCanvas);
  const padPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(padRadius * 1.8, padRadius * 1.8),
    new THREE.MeshBasicMaterial({ map: hTex })
  );
  padPlane.rotation.x = -Math.PI / 2;
  padPlane.position.set(cx, towerH + 0.45, cz);
  group.add(padPlane);

  // Perimeter Helipad Green Beacon Lights
  const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const bx = cx + Math.cos(a) * (padRadius + 0.5);
    const bz = cz + Math.sin(a) * (padRadius + 0.5);
    const bMesh = new THREE.Mesh(beaconGeo, beaconMat);
    bMesh.position.set(bx, towerH + 0.35, bz);
    group.add(bMesh);
  }

  // C. Emergency ER Drop-off Pavilion (Ground wing, 14m tall)
  const erW = 42;
  const erH = 12;
  const erD = 22;
  const erMesh = new THREE.Mesh(
    new THREE.BoxGeometry(erW, erH, erD),
    hospitalWhiteMat
  );
  erMesh.position.set(cx, erH / 2, cz + towerD / 2 + erD / 2 - 2);
  erMesh.castShadow = true;
  erMesh.receiveShadow = true;
  group.add(erMesh);
  buildingMeshes.push(erMesh);

  buildings.push({
    box: new THREE.Box3().setFromObject(erMesh),
    mesh: erMesh,
    center: erMesh.position.clone(),
    size: new THREE.Vector3(erW, erH, erD),
    isRoofStructure: true,
  });
  rooftopAnchors.push(new THREE.Vector3(cx, erH, cz + towerD / 2 + erD / 2));

  // Glowing Red Emergency Entrance Sign
  const erSignTex = createSignTexture('EMERGENCY / AMBULANCE', '#ffffff', '#dc2626', '#ef4444');
  const erSignMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 5.5),
    new THREE.MeshBasicMaterial({ map: erSignTex, toneMapped: false })
  );
  erSignMesh.position.set(cx, erH - 2.5, cz + towerD / 2 + erD + 0.1);
  group.add(erSignMesh);

  // ER Drive-Through Canopy
  const canopyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(32, 0.45, 14),
    roofMat
  );
  canopyMesh.position.set(cx, 5.2, cz + towerD / 2 + erD + 7);
  group.add(canopyMesh);

  // Canopy support posts
  for (const cpx of [-14, 14]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 5.2, 8),
      roofMat
    );
    post.position.set(cx + cpx, 2.6, cz + towerD / 2 + erD + 13.5);
    group.add(post);
  }

  // 2 Parked City Ambulances at ER Bay
  const createAmbulance = (ax: number, az: number) => {
    const ambGroup = new THREE.Group();
    ambGroup.position.set(ax, 0, az);

    // White Van Body
    const ambBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 2.8), ambBodyMat);
    cab.position.set(0, 1.45, 1.6);
    ambGroup.add(cab);

    const box = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.6, 4.4), ambBodyMat);
    box.position.set(0, 1.7, -1.8);
    ambGroup.add(box);

    // Reflective Red Paramedic Stripe
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.35, 4.45), stripeMat);
    stripe.position.set(0, 1.6, -1.8);
    ambGroup.add(stripe);

    // Red Emergency Lightbar on cab roof
    const lbMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const lb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.4), lbMat);
    lb.position.set(0, 2.6, 1.4);
    ambGroup.add(lb);

    // Windshield
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.9), new THREE.MeshBasicMaterial({ color: 0x1e293b }));
    ws.position.set(0, 1.8, 3.01);
    ambGroup.add(ws);

    // Wheels
    const wGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12);
    wGeo.rotateZ(Math.PI / 2);
    const wMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    for (const wx of [-1.3, 1.3]) {
      for (const wz of [-2.4, 1.8]) {
        const w = new THREE.Mesh(wGeo, wMat);
        w.position.set(wx, 0.42, wz);
        ambGroup.add(w);
      }
    }

    group.add(ambGroup);
  };

  createAmbulance(cx - 8, cz + towerD / 2 + erD + 6);
  createAmbulance(cx + 8, cz + towerD / 2 + erD + 6);

  return { group, buildings, buildingMeshes, rooftopAnchors };
}

/**
 * 2. COMMERCIAL FACILITIES ("GRAND METROPOLIS PLAZA & SHOPPING MALL")
 * - 4-story luxury retail atrium with curved glass entrance
 * - Massive glowing commercial billboard screens ("METRO MALL", "CYBER MART", "SUPERSTORE", "MEGA ELECTRONICS")
 * - Ground floor storefront awnings & outdoor cafe patio with parasols and planters
 * - Rooftop Sky-Terrace & Lounge with wooden decking and pergolas
 */
export function createCommercialMall(cx: number, cz: number, buildingTextures: any): FacilityResult {
  const group = new THREE.Group();
  group.name = 'GrandMetropolisPlaza';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const rooftopAnchors: THREE.Vector3[] = [];

  const mallH = 46;
  const mallW = 66;
  const mallD = 66;

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7,
    metalness: 0.2,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    map: buildingTextures.map,
    emissive: 0x0284c7,
    emissiveMap: buildingTextures.emissiveMap,
    emissiveIntensity: 0.65,
    roughness: 0.15,
    metalness: 0.6,
  });

  // Main Mall Building Block
  const mallMesh = new THREE.Mesh(new THREE.BoxGeometry(mallW, mallH, mallD), glassMat);
  mallMesh.position.set(cx, mallH / 2, cz);
  mallMesh.castShadow = true;
  mallMesh.receiveShadow = true;
  mallMesh.userData = { isBuilding: true, height: mallH };
  group.add(mallMesh);
  buildingMeshes.push(mallMesh);

  buildings.push({
    box: new THREE.Box3().setFromObject(mallMesh),
    mesh: mallMesh,
    center: mallMesh.position.clone(),
    size: new THREE.Vector3(mallW, mallH, mallD),
  });
  rooftopAnchors.push(new THREE.Vector3(cx, mallH, cz));

  // Dramatic Curved Glass Entrance Canopy
  const atriumRadius = 18;
  const atriumH = 22;
  const atriumGeo = new THREE.CylinderGeometry(atriumRadius, atriumRadius, atriumH, 24, 1, false, 0, Math.PI);
  const atriumMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.6,
    transmission: 0.7,
    roughness: 0.1,
  });
  const atriumMesh = new THREE.Mesh(atriumGeo, atriumMat);
  atriumMesh.position.set(cx, atriumH / 2, cz + mallD / 2);
  group.add(atriumMesh);

  // Giant Illuminated Digital Billboards on Facades
  const ads = [
    { text: 'GRAND METRO MALL', color: '#f59e0b', bg: '#0f172a', z: mallD / 2 + 0.3, y: 34, w: 42, h: 10 },
    { text: 'CYBER MART 24/7', color: '#10b981', bg: '#022c22', z: -mallD / 2 - 0.3, y: 32, w: 38, h: 9 },
    { text: 'MEGA ELECTRONICS', color: '#38bdf8', bg: '#082f49', x: mallW / 2 + 0.3, y: 32, w: 38, h: 9 },
    { text: 'SUPERSTORE PLAZA', color: '#ec4899', bg: '#500724', x: -mallW / 2 - 0.3, y: 32, w: 38, h: 9 },
  ];

  ads.forEach((ad) => {
    const tex = createSignTexture(ad.text, ad.color, ad.bg, ad.color);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(ad.w, ad.h),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );

    if (ad.z !== undefined) {
      plane.position.set(cx, ad.y, cz + ad.z);
      if (ad.z < 0) plane.rotation.y = Math.PI;
    } else if (ad.x !== undefined) {
      plane.position.set(cx + ad.x, ad.y, cz);
      plane.rotation.y = ad.x > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    group.add(plane);
  });

  // Ground Floor Storefront Fabric Awnings (Striped red/white and blue/white)
  const awningMat1 = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
  const awningMat2 = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue; // Leave central entrance open
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.4, 3.2),
      i % 2 === 0 ? awningMat1 : awningMat2
    );
    awning.position.set(cx + i * 11, 4.8, cz + mallD / 2 + 1.6);
    awning.rotation.x = Math.PI / 10;
    group.add(awning);
  }

  // Rooftop Sky-Lounge (Decking, pergolas, planters)
  const deckMesh = new THREE.Mesh(
    new THREE.BoxGeometry(mallW - 8, 0.4, mallD - 8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
  );
  deckMesh.position.set(cx, mallH + 0.2, cz);
  deckMesh.receiveShadow = true;
  group.add(deckMesh);

  // Rooftop Pergola Canopy
  const pergolaMesh = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.35, 18),
    stoneMat
  );
  pergolaMesh.position.set(cx, mallH + 4.2, cz);
  group.add(pergolaMesh);

  for (const px of [-11, 11]) {
    for (const pz of [-8, 8]) {
      const pPost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.2, 8), stoneMat);
      pPost.position.set(cx + px, mallH + 2.1, cz + pz);
      group.add(pPost);
    }
  }

  return { group, buildings, buildingMeshes, rooftopAnchors };
}

/**
 * 3. DAILY BUGLE SKYSCRAPER
 * - Art-deco high-rise with architectural setbacks (175m tall)
 * - Massive illuminated red "DAILY BUGLE" neon sign on rooftop truss
 * - Rotating 3D Golden Globe with antenna mast on top
 */
export function createDailyBugleBuilding(cx: number, cz: number, buildingTextures: any): FacilityResult {
  const group = new THREE.Group();
  group.name = 'DailyBugleBuilding';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const rooftopAnchors: THREE.Vector3[] = [];

  const brickMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b, // Art deco dark terracotta / brick
    roughness: 0.85,
    metalness: 0.1,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    map: buildingTextures.map,
    emissive: 0xf59e0b,
    emissiveMap: buildingTextures.emissiveMap,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.5,
  });

  // Base Tower (Height 130m)
  const baseH = 130;
  const baseW = 56;
  const baseD = 56;
  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, baseD), glassMat);
  baseMesh.position.set(cx, baseH / 2, cz);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);
  buildingMeshes.push(baseMesh);

  buildings.push({
    box: new THREE.Box3().setFromObject(baseMesh),
    mesh: baseMesh,
    center: baseMesh.position.clone(),
    size: new THREE.Vector3(baseW, baseH, baseD),
  });

  // Tier 2 Setback (Height 35m)
  const t2H = 35;
  const t2W = 40;
  const t2D = 40;
  const t2Mesh = new THREE.Mesh(new THREE.BoxGeometry(t2W, t2H, t2D), brickMat);
  t2Mesh.position.set(cx, baseH + t2H / 2, cz);
  t2Mesh.castShadow = true;
  t2Mesh.receiveShadow = true;
  group.add(t2Mesh);
  buildingMeshes.push(t2Mesh);

  buildings.push({
    box: new THREE.Box3().setFromObject(t2Mesh),
    mesh: t2Mesh,
    center: t2Mesh.position.clone(),
    size: new THREE.Vector3(t2W, t2H, t2D),
    isRoofStructure: true,
  });

  const roofY = baseH + t2H;
  rooftopAnchors.push(new THREE.Vector3(cx, roofY, cz));

  // Rooftop Steel Truss Billboard: "DAILY BUGLE"
  const signTex = createSignTexture('DAILY BUGLE', '#ffffff', '#b91c1c', '#ef4444');
  const signGeo = new THREE.PlaneGeometry(28, 8);
  const signMesh = new THREE.Mesh(
    signGeo,
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, toneMapped: false })
  );
  signMesh.position.set(cx, roofY + 6, cz);
  group.add(signMesh);

  // Steel Truss Scaffolding
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
  for (const sx of [-12, 12]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12, 6), steelMat);
    post.position.set(cx + sx, roofY + 6, cz);
    group.add(post);

    const diagonal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 14, 6), steelMat);
    diagonal.position.set(cx + sx, roofY + 6, cz - 3);
    diagonal.rotation.x = Math.PI / 6;
    group.add(diagonal);
  }

  // Rotating 3D Golden Globe on Top of Truss
  const globeGroup = new THREE.Group();
  globeGroup.position.set(cx, roofY + 16, cz);

  const globeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Golden bronze
      metalness: 0.9,
      roughness: 0.25,
    })
  );
  globeGroup.add(globeMesh);

  // Latitude ring around globe
  const ringMesh = new THREE.Mesh(
    new THREE.TorusGeometry(5.4, 0.22, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.15 })
  );
  ringMesh.rotation.x = Math.PI / 4;
  globeGroup.add(ringMesh);

  // Antenna Mast on Top of Globe
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.4, 18, 8),
    steelMat
  );
  mast.position.y = 11;
  globeGroup.add(mast);

  group.add(globeGroup);

  const update = (dt: number) => {
    globeGroup.rotation.y += 0.35 * dt; // Rotate globe majestically
  };

  return { group, buildings, buildingMeshes, rooftopAnchors, update };
}

/**
 * 4. OSCORP TOWER
 * - High-tech triangular faceted emerald green reflective glass skyscraper (240m tall)
 * - Glowing emerald green "OSCORP" logo on upper facades
 * - Cantilevered high-altitude observation deck & rooftop communications array
 */
export function createOscorpTower(cx: number, cz: number, buildingTextures: any): FacilityResult {
  const group = new THREE.Group();
  group.name = 'OscorpTower';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const rooftopAnchors: THREE.Vector3[] = [];

  const oscorpH = 240;
  const oscorpW = 54;
  const oscorpD = 54;

  const oscorpGlassMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b, // Deep emerald corporate green
    map: buildingTextures.map,
    emissive: 0x10b981,
    emissiveMap: buildingTextures.emissiveMap,
    emissiveIntensity: 0.8,
    roughness: 0.15,
    metalness: 0.65,
  });

  const towerMesh = new THREE.Mesh(
    new THREE.BoxGeometry(oscorpW, oscorpH, oscorpD),
    oscorpGlassMat
  );
  towerMesh.position.set(cx, oscorpH / 2, cz);
  towerMesh.castShadow = true;
  towerMesh.receiveShadow = true;
  group.add(towerMesh);
  buildingMeshes.push(towerMesh);

  buildings.push({
    box: new THREE.Box3().setFromObject(towerMesh),
    mesh: towerMesh,
    center: towerMesh.position.clone(),
    size: new THREE.Vector3(oscorpW, oscorpH, oscorpD),
  });
  rooftopAnchors.push(new THREE.Vector3(cx, oscorpH, cz));

  // Glowing Emerald "OSCORP" Neon Signs on 4 facades
  const oscorpTex = createSignTexture('OSCORP', '#ffffff', '#064e3b', '#10b981');
  const oscorpMat = new THREE.MeshBasicMaterial({ map: oscorpTex, toneMapped: false });
  const signW = 32;
  const signH = 8;

  for (const rotY of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const sMesh = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), oscorpMat);
    const r = oscorpW / 2 + 0.3;
    sMesh.position.set(
      cx + Math.sin(rotY) * r,
      oscorpH - 18,
      cz + Math.cos(rotY) * r
    );
    sMesh.rotation.y = rotY;
    group.add(sMesh);
  }

  // Cantilevered High-Altitude Observation Deck (at 180m)
  const deckMesh = new THREE.Mesh(
    new THREE.BoxGeometry(oscorpW + 12, 1.8, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 })
  );
  deckMesh.position.set(cx, 180, cz + oscorpD / 2 + 6);
  group.add(deckMesh);
  buildingMeshes.push(deckMesh);

  buildings.push({
    box: new THREE.Box3().setFromObject(deckMesh),
    mesh: deckMesh,
    center: deckMesh.position.clone(),
    size: new THREE.Vector3(oscorpW + 12, 1.8, 16),
    isRoofStructure: true,
  });
  rooftopAnchors.push(new THREE.Vector3(cx, 181, cz + oscorpD / 2 + 6));

  // Rooftop Spire & Satellite Communications Array
  const spireMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 1.2, 32, 8),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
  );
  spireMesh.position.set(cx, oscorpH + 16, cz);
  group.add(spireMesh);

  // Satellite Dishes
  const dishGeo = new THREE.CylinderGeometry(3.2, 0.4, 1.4, 16);
  const dishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
  for (const dx of [-14, 14]) {
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(cx + dx, oscorpH + 2.4, cz + 10);
    dish.rotation.x = Math.PI / 4;
    group.add(dish);
  }

  return { group, buildings, buildingMeshes, rooftopAnchors };
}

/**
 * 5. FINANCIAL TWIN TOWERS & HIGH-ALTITUDE SKYBRIDGE
 * - Twin corporate glass towers (210m tall)
 * - Enclosed 2-story glass skybridge at 110m height connecting them!
 * - Spider-Man can swing through the canyon underneath the skybridge or land on top!
 */
export function createFinancialTwinTowers(cx: number, cz: number, buildingTextures: any): FacilityResult {
  const group = new THREE.Group();
  group.name = 'FinancialTwinTowers';

  const buildings: BuildingData[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const rooftopAnchors: THREE.Vector3[] = [];

  const towerH = 210;
  const towerW = 26;
  const towerD = 52;
  const towerSpacing = 28; // 28m gap between the twin towers

  const corporateGlassMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a, // Corporate navy reflective glass
    map: buildingTextures.map,
    emissive: 0x60a5fa,
    emissiveMap: buildingTextures.emissiveMap,
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.7,
  });

  // Tower 1 (West) & Tower 2 (East)
  for (const side of [-1, 1]) {
    const tx = cx + side * (towerW / 2 + towerSpacing / 2);
    const tMesh = new THREE.Mesh(
      new THREE.BoxGeometry(towerW, towerH, towerD),
      corporateGlassMat
    );
    tMesh.position.set(tx, towerH / 2, cz);
    tMesh.castShadow = true;
    tMesh.receiveShadow = true;
    group.add(tMesh);
    buildingMeshes.push(tMesh);

    buildings.push({
      box: new THREE.Box3().setFromObject(tMesh),
      mesh: tMesh,
      center: tMesh.position.clone(),
      size: new THREE.Vector3(towerW, towerH, towerD),
    });
    rooftopAnchors.push(new THREE.Vector3(tx, towerH, cz));
  }

  // Enclosed 2-Story High-Altitude Skybridge connecting the towers at Y = 110m
  const bridgeH = 8.5;
  const bridgeW = towerSpacing + 4;
  const bridgeD = 14;
  const bridgeY = 112;

  const bridgeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeW, bridgeH, bridgeD),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.7,
      transmission: 0.6,
      roughness: 0.2,
    })
  );
  bridgeMesh.position.set(cx, bridgeY, cz);
  bridgeMesh.castShadow = true;
  group.add(bridgeMesh);
  buildingMeshes.push(bridgeMesh);

  buildings.push({
    box: new THREE.Box3().setFromObject(bridgeMesh),
    mesh: bridgeMesh,
    center: bridgeMesh.position.clone(),
    size: new THREE.Vector3(bridgeW, bridgeH, bridgeD),
    isRoofStructure: true,
  });
  rooftopAnchors.push(new THREE.Vector3(cx, bridgeY + bridgeH / 2, cz));

  // Steel Truss Framework under Skybridge
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
  const trussMesh = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeW, 1.2, bridgeD),
    steelMat
  );
  trussMesh.position.set(cx, bridgeY - bridgeH / 2 - 0.6, cz);
  group.add(trussMesh);

  return { group, buildings, buildingMeshes, rooftopAnchors };
}
