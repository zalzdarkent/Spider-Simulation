import * as THREE from 'three';

export interface StreetPropsOptions {
  timeOfDay: 'sunset' | 'night' | 'day' | 'foggy';
  avenues: number[]; // X coordinates of avenues
  streets: number[]; // Z coordinates of cross-streets
}

/**
 * Procedural generation of urban street props:
 * Trees, street lamps, fire hydrants, sidewalk benches, trash bins, bus shelters, and mailboxes.
 */
export class StreetPropsGenerator {
  public static createProps(options: StreetPropsOptions): THREE.Group {
    const propsGroup = new THREE.Group();
    propsGroup.name = 'StreetPropsGroup';

    const { timeOfDay, avenues, streets } = options;

    // Foliage colors adapted to time of day
    const foliageColors = {
      sunset: [0xd97706, 0xb45309, 0x15803d, 0xeab308],
      night: [0x14532d, 0x166534, 0x0f3b23],
      day: [0x16a34a, 0x22c55e, 0x15803d, 0x4ade80],
      foggy: [0x1e3a2b, 0x244f38, 0x2b593f],
    }[timeOfDay];

    // Shared materials for high performance and low draw calls
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3f220f,
      roughness: 0.9,
      metalness: 0.05,
    });

    const foliageMaterials = foliageColors.map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.65,
          metalness: 0.1,
          flatShading: true,
        })
    );

    const metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.75,
    });

    const lampBulbMat = new THREE.MeshBasicMaterial({
      color: timeOfDay === 'night' ? 0xffedd5 : timeOfDay === 'sunset' ? 0xfef08a : 0xf1f5f9,
    });

    const hydrantRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.4,
      metalness: 0.3,
    });

    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.25,
      metalness: 0.85,
    });

    const benchWoodMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      roughness: 0.8,
      metalness: 0.1,
    });

    const mailboxBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.35,
      metalness: 0.5,
    });

    const busAdMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    // Helper: Create stylized leafy city tree
    const createTree = (x: number, z: number, scale = 1.0): THREE.Group => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.24 * scale, 0.36 * scale, 3.8 * scale, 8);
      const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
      trunkMesh.position.y = (3.8 * scale) / 2;
      trunkMesh.castShadow = true;
      trunkMesh.receiveShadow = true;
      tree.add(trunkMesh);

      // Tree planter curb ring
      const ringGeo = new THREE.CylinderGeometry(1.05 * scale, 1.05 * scale, 0.14, 12);
      const ringMesh = new THREE.Mesh(ringGeo, metalDarkMat);
      ringMesh.position.y = 0.07;
      tree.add(ringMesh);

      // Multi-cluster foliage canopy
      const foliageMat = foliageMaterials[Math.floor(Math.random() * foliageMaterials.length)];
      const sphereGeo = new THREE.DodecahedronGeometry(1.7 * scale, 1);

      // Cluster 1: center top
      const c1 = new THREE.Mesh(sphereGeo, foliageMat);
      c1.position.set(0, 4.4 * scale, 0);
      c1.scale.set(1.1, 1.25, 1.1);
      c1.castShadow = true;
      tree.add(c1);

      // Cluster 2: offset side
      const c2 = new THREE.Mesh(sphereGeo, foliageMat);
      c2.position.set(0.7 * scale, 3.6 * scale, 0.4 * scale);
      c2.scale.set(0.9, 0.95, 0.9);
      c2.castShadow = true;
      tree.add(c2);

      // Cluster 3: opposite side
      const c3 = new THREE.Mesh(sphereGeo, foliageMat);
      c3.position.set(-0.6 * scale, 3.8 * scale, -0.5 * scale);
      c3.scale.set(0.85, 0.9, 0.85);
      c3.castShadow = true;
      tree.add(c3);

      return tree;
    };

    // Helper: Create NYC curved streetlamp
    const createStreetLamp = (x: number, z: number, rotationY = 0): THREE.Group => {
      const lamp = new THREE.Group();
      lamp.position.set(x, 0, z);
      lamp.rotation.y = rotationY;

      // Vertical pole
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 6.2, 8);
      const poleMesh = new THREE.Mesh(poleGeo, metalDarkMat);
      poleMesh.position.y = 3.1;
      lamp.add(poleMesh);

      // Base collar
      const baseGeo = new THREE.CylinderGeometry(0.35, 0.42, 0.7, 8);
      const baseMesh = new THREE.Mesh(baseGeo, metalDarkMat);
      baseMesh.position.y = 0.35;
      lamp.add(baseMesh);

      // Horizontal cantilever arm extending over road
      const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8);
      const armMesh = new THREE.Mesh(armGeo, metalDarkMat);
      armMesh.position.set(0.8, 6.0, 0);
      armMesh.rotation.z = Math.PI / 2.3;
      lamp.add(armMesh);

      // Lamp fixture housing
      const housingGeo = new THREE.BoxGeometry(0.65, 0.22, 0.35);
      const housingMesh = new THREE.Mesh(housingGeo, metalDarkMat);
      housingMesh.position.set(1.6, 5.85, 0);
      lamp.add(housingMesh);

      // Glowing luminaire lens
      const bulbGeo = new THREE.BoxGeometry(0.55, 0.08, 0.28);
      const bulbMesh = new THREE.Mesh(bulbGeo, lampBulbMat);
      bulbMesh.position.set(1.6, 5.75, 0);
      lamp.add(bulbMesh);

      return lamp;
    };

    // Helper: Create fire hydrant
    const createFireHydrant = (x: number, z: number): THREE.Group => {
      const hydrant = new THREE.Group();
      hydrant.position.set(x, 0, z);

      // Main barrel
      const barrelGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.85, 10);
      const barrelMesh = new THREE.Mesh(barrelGeo, hydrantRedMat);
      barrelMesh.position.y = 0.425;
      hydrant.add(barrelMesh);

      // Top dome cap
      const domeGeo = new THREE.SphereGeometry(0.2, 10, 8);
      const domeMesh = new THREE.Mesh(domeGeo, silverMat);
      domeMesh.position.y = 0.85;
      hydrant.add(domeMesh);

      // Side nozzle outlets
      const nozzleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8);
      const nozzleMesh = new THREE.Mesh(nozzleGeo, silverMat);
      nozzleMesh.position.y = 0.55;
      nozzleMesh.rotation.z = Math.PI / 2;
      hydrant.add(nozzleMesh);

      return hydrant;
    };

    // Helper: Create park / sidewalk bench
    const createBench = (x: number, z: number, rotationY = 0): THREE.Group => {
      const bench = new THREE.Group();
      bench.position.set(x, 0, z);
      bench.rotation.y = rotationY;

      // Wooden seat planks
      const seatGeo = new THREE.BoxGeometry(2.2, 0.08, 0.65);
      const seatMesh = new THREE.Mesh(seatGeo, benchWoodMat);
      seatMesh.position.set(0, 0.52, 0);
      bench.add(seatMesh);

      // Backrest
      const backGeo = new THREE.BoxGeometry(2.2, 0.55, 0.08);
      const backMesh = new THREE.Mesh(backGeo, benchWoodMat);
      backMesh.position.set(0, 0.85, -0.28);
      bench.add(backMesh);

      // Metal legs
      const legGeo = new THREE.BoxGeometry(0.08, 0.52, 0.62);
      for (const lx of [-0.95, 0.95]) {
        const leg = new THREE.Mesh(legGeo, metalDarkMat);
        leg.position.set(lx, 0.26, 0);
        bench.add(leg);
      }

      return bench;
    };

    // Helper: Create blue postal mailbox
    const createMailbox = (x: number, z: number): THREE.Group => {
      const box = new THREE.Group();
      box.position.set(x, 0, z);

      const bodyGeo = new THREE.BoxGeometry(0.55, 0.85, 0.45);
      const bodyMesh = new THREE.Mesh(bodyGeo, mailboxBlueMat);
      bodyMesh.position.y = 0.65;
      box.add(bodyMesh);

      const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6);
      for (const ox of [-0.2, 0.2]) {
        for (const oz of [-0.15, 0.15]) {
          const leg = new THREE.Mesh(legGeo, metalDarkMat);
          leg.position.set(ox, 0.125, oz);
          box.add(leg);
        }
      }

      return box;
    };

    // Helper: Create glass transit bus shelter
    const createBusShelter = (x: number, z: number, rotationY = 0): THREE.Group => {
      const shelter = new THREE.Group();
      shelter.position.set(x, 0, z);
      shelter.rotation.y = rotationY;

      // Steel pillars
      const postGeo = new THREE.BoxGeometry(0.12, 3.2, 0.12);
      for (const px of [-1.8, 1.8]) {
        for (const pz of [-0.7, 0.7]) {
          const post = new THREE.Mesh(postGeo, metalDarkMat);
          post.position.set(px, 1.6, pz);
          shelter.add(post);
        }
      }

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(4.2, 0.15, 1.9);
      const roofMesh = new THREE.Mesh(roofGeo, metalDarkMat);
      roofMesh.position.y = 3.25;
      shelter.add(roofMesh);

      // Back glass panel
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.5,
      });
      const glassGeo = new THREE.PlaneGeometry(3.6, 2.8);
      const backGlass = new THREE.Mesh(glassGeo, glassMat);
      backGlass.position.set(0, 1.5, -0.7);
      shelter.add(backGlass);

      // Advertising poster lightbox
      const adGeo = new THREE.PlaneGeometry(1.1, 2.2);
      const adMesh = new THREE.Mesh(adGeo, busAdMat);
      adMesh.position.set(1.75, 1.5, 0);
      adMesh.rotation.y = Math.PI / 2;
      shelter.add(adMesh);

      // Bench inside shelter
      const bench = createBench(0, 0, 0);
      bench.scale.set(0.7, 0.8, 0.7);
      shelter.add(bench);

      return shelter;
    };

    // Distribute props systematically along urban sidewalks:
    // Sidewalk offset from avenue/street centerline is typically ~15.5m
    const sidewalkOffset = 15.5;

    // 1. Plant along North-South Avenues
    avenues.forEach((ax, aIdx) => {
      for (let z = -360; z <= 360; z += 28) {
        // Leave intersections clear (|z - sz| > 18)
        const nearIntersection = streets.some((sz) => Math.abs(z - sz) < 20);
        if (nearIntersection) continue;

        // East & West sidewalks
        for (const side of [-1, 1]) {
          const px = ax + side * sidewalkOffset;
          const pz = z;

          const propType = Math.abs((z * 13 + aIdx * 7) % 100);

          if (propType < 40) {
            // Tree
            const treeScale = 0.85 + ((z + 500) % 30) * 0.01;
            propsGroup.add(createTree(px, pz, treeScale));
          } else if (propType < 65) {
            // Streetlamp (aimed facing toward the street)
            const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            propsGroup.add(createStreetLamp(px, pz, rotY));
          } else if (propType < 78) {
            // Bench
            const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            propsGroup.add(createBench(px, pz, rotY));
          } else if (propType < 88) {
            // Fire Hydrant
            propsGroup.add(createFireHydrant(px, pz));
          } else if (propType < 94) {
            // Mailbox
            propsGroup.add(createMailbox(px, pz));
          } else {
            // Bus stop shelter
            const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            propsGroup.add(createBusShelter(px, pz, rotY));
          }
        }
      }
    });

    // 2. Plant along East-West Cross-Streets
    streets.forEach((sz, sIdx) => {
      for (let x = -360; x <= 360; x += 32) {
        // Leave intersections clear
        const nearIntersection = avenues.some((ax) => Math.abs(x - ax) < 20);
        if (nearIntersection) continue;

        for (const side of [-1, 1]) {
          const px = x;
          const pz = sz + side * sidewalkOffset;

          const propType = Math.abs((x * 17 + sIdx * 11) % 100);

          if (propType < 45) {
            // Tree
            propsGroup.add(createTree(px, pz, 0.95));
          } else if (propType < 75) {
            // Streetlamp
            const rotY = side > 0 ? 0 : Math.PI;
            propsGroup.add(createStreetLamp(px, pz, rotY));
          } else if (propType < 90) {
            // Bench
            const rotY = side > 0 ? 0 : Math.PI;
            propsGroup.add(createBench(px, pz, rotY));
          } else {
            // Hydrant
            propsGroup.add(createFireHydrant(px, pz));
          }
        }
      }
    });

    return propsGroup;
  }
}
