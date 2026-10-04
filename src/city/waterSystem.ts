import * as THREE from 'three';

export interface WaterSystemOptions {
  islandWidth: number; // width of city island (e.g. 1040m, from -520 to +520)
  lakeCenter: THREE.Vector3;
  lakeRadiusX: number;
  lakeRadiusZ: number;
  timeOfDay: 'sunset' | 'night' | 'day' | 'foggy';
}

export interface WaterSystemResult {
  group: THREE.Group;
  update: (time: number) => void;
  isWaterAt: (x: number, z: number) => boolean;
  getWaterLevel: (x: number, z: number) => number;
  seawallColliders: { min: THREE.Vector3; max: THREE.Vector3 }[];
}

export function createWaterSystem(options: WaterSystemOptions): WaterSystemResult {
  const group = new THREE.Group();
  group.name = 'WaterSystem';

  const { islandWidth, lakeCenter, lakeRadiusX, lakeRadiusZ, timeOfDay } = options;
  const halfIsland = islandWidth / 2;

  // Color palette for water based on time of day
  const waterColors = {
    sunset: {
      deep: new THREE.Color(0x0f2942),
      surface: new THREE.Color(0x0369a1),
      sun: new THREE.Color(0xf59e0b),
      foam: new THREE.Color(0xfde68a),
    },
    night: {
      deep: new THREE.Color(0x030712),
      surface: new THREE.Color(0x082f49),
      sun: new THREE.Color(0x38bdf8),
      foam: new THREE.Color(0x93c5fd),
    },
    day: {
      deep: new THREE.Color(0x0369a1),
      surface: new THREE.Color(0x0284c7),
      sun: new THREE.Color(0xffffff),
      foam: new THREE.Color(0xffffff),
    },
    foggy: {
      deep: new THREE.Color(0x1e293b),
      surface: new THREE.Color(0x334155),
      sun: new THREE.Color(0x94a3b8),
      foam: new THREE.Color(0xcbd5e1),
    },
  }[timeOfDay];

  // -------------------------------------------------------------
  // 1. OCEAN & RIVERS SHADER MATERIAL (Hudson, East River, Bay)
  // -------------------------------------------------------------
  const waterUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: waterColors.deep },
    uSurfaceColor: { value: waterColors.surface },
    uSunColor: { value: waterColors.sun },
    uFoamColor: { value: waterColors.foam },
  };

  const oceanVertShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Organic dual sine wave displacement
      float wave1 = sin(pos.x * 0.035 + uTime * 1.6) * cos(pos.y * 0.035 + uTime * 1.3) * 0.22;
      float wave2 = sin(pos.x * 0.08 - uTime * 2.1) * cos(pos.y * 0.07 + uTime * 1.8) * 0.12;
      pos.z += wave1 + wave2;

      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPosition.xyz;
      vNormal = normalize(vec3(-wave1 * 0.3, 1.0, -wave2 * 0.3));

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const oceanFragShader = `
    uniform vec3 uDeepColor;
    uniform vec3 uSurfaceColor;
    uniform vec3 uSunColor;
    uniform vec3 uFoamColor;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fresnel = pow(1.0 - max(0.0, dot(viewDir, vec3(0.0, 1.0, 0.0))), 3.0);

      // Specular sunlight glint
      vec3 lightDir = normalize(vec3(0.5, 0.8, 0.4));
      vec3 halfVec = normalize(lightDir + viewDir);
      float spec = pow(max(0.0, dot(vNormal, halfVec)), 64.0) * 1.5;

      // Subtle caustics ripple
      float ripple = sin(vWorldPos.x * 0.5 + uTime * 2.0) * cos(vWorldPos.z * 0.5 + uTime * 1.8);
      float foam = step(0.85, ripple) * 0.15;

      vec3 baseColor = mix(uDeepColor, uSurfaceColor, fresnel * 0.75 + 0.25);
      vec3 finalColor = baseColor + uSunColor * spec + uFoamColor * foam;

      gl_FragColor = vec4(finalColor, 0.94);
    }
  `;

  const oceanMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: oceanVertShader,
    fragmentShader: oceanFragShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  // Massive surrounding ocean & river plane (4000m x 4000m)
  const oceanGeo = new THREE.PlaneGeometry(4200, 4200, 96, 96);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.y = -0.45;
  oceanMesh.name = 'SurroundingOcean';
  group.add(oceanMesh);

  // -------------------------------------------------------------
  // 2. CENTRAL PARK LAKE / POND
  // -------------------------------------------------------------
  const lakeGroup = new THREE.Group();
  lakeGroup.name = 'CentralParkLake';

  // Organic elliptical lake surface
  const lakeShape = new THREE.Shape();
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    // Add organic shoreline wobble
    const wobble = 1.0 + Math.sin(theta * 3) * 0.08 + Math.cos(theta * 5) * 0.05;
    const lx = Math.cos(theta) * lakeRadiusX * wobble;
    const lz = Math.sin(theta) * lakeRadiusZ * wobble;
    if (i === 0) lakeShape.moveTo(lx, lz);
    else lakeShape.lineTo(lx, lz);
  }

  const lakeGeo = new THREE.ShapeGeometry(lakeShape);
  lakeGeo.rotateX(-Math.PI / 2);

  const lakeMat = new THREE.MeshStandardMaterial({
    color: waterColors.surface,
    roughness: 0.15,
    metalness: 0.85,
    transparent: true,
    opacity: 0.88,
  });

  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.position.set(lakeCenter.x, -0.15, lakeCenter.z);
  lakeMesh.receiveShadow = true;
  lakeGroup.add(lakeMesh);

  // Sandy / pebble shoreline border
  const shoreMat = new THREE.MeshStandardMaterial({
    color: 0x78716c, // River stones & sand
    roughness: 0.9,
    metalness: 0.1,
  });
  const shoreRingGeo = new THREE.RingGeometry(lakeRadiusX * 0.95, lakeRadiusX * 1.15, 48);
  shoreRingGeo.rotateX(-Math.PI / 2);
  const shoreRing = new THREE.Mesh(shoreRingGeo, shoreMat);
  shoreRing.position.set(lakeCenter.x, -0.05, lakeCenter.z);
  lakeGroup.add(shoreRing);

  // Wooden Boat Dock extending into Central Park Lake
  const dockMat = new THREE.MeshStandardMaterial({
    color: 0x854d0e, // Weathered cedar dock wood
    roughness: 0.85,
    metalness: 0.05,
  });
  const dockGeo = new THREE.BoxGeometry(6.0, 0.35, 18.0);
  const dockMesh = new THREE.Mesh(dockGeo, dockMat);
  dockMesh.position.set(lakeCenter.x, 0.05, lakeCenter.z - lakeRadiusZ * 0.82);
  dockMesh.castShadow = true;
  dockMesh.receiveShadow = true;
  lakeGroup.add(dockMesh);

  // Wooden dock pilings
  for (const dx of [-2.6, 2.6]) {
    for (let dz = -7.5; dz <= 7.5; dz += 5.0) {
      const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.8, 8);
      const post = new THREE.Mesh(postGeo, dockMat);
      post.position.set(lakeCenter.x + dx, -0.4, lakeCenter.z - lakeRadiusZ * 0.82 + dz);
      lakeGroup.add(post);
    }
  }

  group.add(lakeGroup);

  // -------------------------------------------------------------
  // 3. SEAWALL PROMENADE & WATERFRONT PIERS (Manhattan Shoreline)
  // -------------------------------------------------------------
  const seawallGroup = new THREE.Group();
  seawallGroup.name = 'SeawallPromenade';

  const graniteMat = new THREE.MeshStandardMaterial({
    color: 0x475569, // Granite seawall blocks
    roughness: 0.7,
    metalness: 0.25,
  });

  const railingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Cast iron railing
    roughness: 0.4,
    metalness: 0.8,
  });

  const seawallColliders: { min: THREE.Vector3; max: THREE.Vector3 }[] = [];
  const wallThick = 2.4;
  const wallHeight = 0.9;

  // 4 Sides around the island (West: Hudson River, East: East River, South/North: Bay)
  const sides = [
    { name: 'west', center: new THREE.Vector3(-halfIsland, wallHeight / 2, 0), size: new THREE.Vector3(wallThick, wallHeight, islandWidth) },
    { name: 'east', center: new THREE.Vector3(halfIsland, wallHeight / 2, 0), size: new THREE.Vector3(wallThick, wallHeight, islandWidth) },
    { name: 'south', center: new THREE.Vector3(0, wallHeight / 2, -halfIsland), size: new THREE.Vector3(islandWidth, wallHeight, wallThick) },
    { name: 'north', center: new THREE.Vector3(0, wallHeight / 2, halfIsland), size: new THREE.Vector3(islandWidth, wallHeight, wallThick) },
  ];

  sides.forEach((s) => {
    const wallGeo = new THREE.BoxGeometry(s.size.x, s.size.y, s.size.z);
    const wallMesh = new THREE.Mesh(wallGeo, graniteMat);
    wallMesh.position.copy(s.center);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    seawallGroup.add(wallMesh);

    seawallColliders.push({
      min: new THREE.Vector3(s.center.x - s.size.x / 2, 0, s.center.z - s.size.z / 2),
      max: new THREE.Vector3(s.center.x + s.size.x / 2, wallHeight, s.center.z + s.size.z / 2),
    });
  });

  // Waterfront Piers extending into the Hudson & East rivers
  const pierPositions = [
    { x: -halfIsland - 22, z: -150, len: 44, w: 14, name: 'HudsonPier1' },
    { x: -halfIsland - 22, z: 150, len: 44, w: 14, name: 'HudsonPier2' },
    { x: halfIsland + 22, z: -150, len: 44, w: 14, name: 'EastRiverPier1' },
    { x: halfIsland + 22, z: 150, len: 44, w: 14, name: 'EastRiverPier2' },
  ];

  pierPositions.forEach((p) => {
    const pierGeo = new THREE.BoxGeometry(p.len, 0.6, p.w);
    const pierMesh = new THREE.Mesh(pierGeo, dockMat);
    pierMesh.position.set(p.x, 0.12, p.z);
    pierMesh.castShadow = true;
    pierMesh.receiveShadow = true;
    seawallGroup.add(pierMesh);

    // Pilings underneath pier
    for (let px = -p.len / 2 + 3; px <= p.len / 2 - 3; px += 8) {
      for (const pz of [-p.w / 2 + 1.2, p.w / 2 - 1.2]) {
        const pilingGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.5, 8);
        const piling = new THREE.Mesh(pilingGeo, dockMat);
        piling.position.set(p.x + px, -0.6, p.z + pz);
        seawallGroup.add(piling);
      }
    }
  });

  group.add(seawallGroup);

  // -------------------------------------------------------------
  // 4. WATER PHYSICS & COLLISION HELPERS
  // -------------------------------------------------------------
  const isWaterAt = (x: number, z: number): boolean => {
    // 1. Surrounding ocean / rivers (outside the city seawall perimeter)
    if (Math.abs(x) > halfIsland - 2 || Math.abs(z) > halfIsland - 2) {
      // Check if on pier
      for (const p of pierPositions) {
        if (Math.abs(x - p.x) <= p.len / 2 && Math.abs(z - p.z) <= p.w / 2) {
          return false; // Standing on pier deck!
        }
      }
      return true;
    }

    // 2. Central Park lake
    const dx = x - lakeCenter.x;
    const dz = z - lakeCenter.z;
    const normalizedDistSq = (dx * dx) / (lakeRadiusX * lakeRadiusX) + (dz * dz) / (lakeRadiusZ * lakeRadiusZ);
    if (normalizedDistSq < 1.0) {
      // Check if on the wooden dock
      if (Math.abs(dx) <= 3.0 && Math.abs(z - (lakeCenter.z - lakeRadiusZ * 0.82)) <= 9.0) {
        return false; // Standing on dock!
      }
      return true;
    }

    return false;
  };

  const getWaterLevel = (x: number, z: number): number => {
    const dx = x - lakeCenter.x;
    const dz = z - lakeCenter.z;
    if ((dx * dx) / (lakeRadiusX * lakeRadiusX) + (dz * dz) / (lakeRadiusZ * lakeRadiusZ) < 1.1) {
      return -0.15; // Central park lake level
    }
    return -0.45; // Ocean / River level
  };

  const update = (time: number) => {
    waterUniforms.uTime.value = time;
  };

  return {
    group,
    update,
    isWaterAt,
    getWaterLevel,
    seawallColliders,
  };
}
