import * as THREE from 'three';

export interface PropCollider {
  type: 'cylinder' | 'box';
  center: THREE.Vector3;
  radius?: number;
  height?: number;
  size?: THREE.Vector3;
  box?: THREE.Box3;
}

export interface StreetPropsOptions {
  timeOfDay: 'sunset' | 'night' | 'day' | 'foggy';
  avenues: number[]; // X coordinates of avenues
  streets: number[]; // Z coordinates of cross-streets
  parkArea?: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface StreetPropsResult {
  group: THREE.Group;
  colliders: PropCollider[];
}

/**
 * Procedural generation of urban street props:
 * Trees, street lamps, fire hydrants, sidewalk benches, bus shelters, and mailboxes.
 */
export class StreetPropsGenerator {
  public static createProps(options: StreetPropsOptions): StreetPropsResult {
    const propsGroup = new THREE.Group();
    propsGroup.name = 'StreetPropsGroup';
    const colliders: PropCollider[] = [];

    const { timeOfDay, avenues, streets, parkArea } = options;

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
      tree.position.set(x, 0.08, z);

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

      const c1 = new THREE.Mesh(sphereGeo, foliageMat);
      c1.position.set(0, 4.4 * scale, 0);
      c1.scale.set(1.1, 1.25, 1.1);
      c1.castShadow = true;
      tree.add(c1);

      const c2 = new THREE.Mesh(sphereGeo, foliageMat);
      c2.position.set(0.7 * scale, 3.6 * scale, 0.4 * scale);
      c2.scale.set(0.9, 0.95, 0.9);
      c2.castShadow = true;
      tree.add(c2);

      const c3 = new THREE.Mesh(sphereGeo, foliageMat);
      c3.position.set(-0.6 * scale, 3.8 * scale, -0.5 * scale);
      c3.scale.set(0.85, 0.9, 0.85);
      c3.castShadow = true;
      tree.add(c3);

      // Register collision shape
      colliders.push({
        type: 'cylinder',
        center: new THREE.Vector3(x, 0, z),
        radius: 0.42 * scale,
        height: 4.2 * scale,
      });

      return tree;
    };

    // Helper: Create NYC curved streetlamp
    const createStreetLamp = (x: number, z: number, rotationY = 0): THREE.Group => {
      const lamp = new THREE.Group();
      lamp.position.set(x, 0.08, z);
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

      // Cantilever arm
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

      // Luminous bulb
      const bulbGeo = new THREE.PlaneGeometry(0.5, 0.24);
      bulbGeo.rotateX(Math.PI / 2);
      const bulbMesh = new THREE.Mesh(bulbGeo, lampBulbMat);
      bulbMesh.position.set(1.6, 5.73, 0);
      lamp.add(bulbMesh);

      // Register collision shape (pole)
      colliders.push({
        type: 'cylinder',
        center: new THREE.Vector3(x, 0, z),
        radius: 0.26,
        height: 6.2,
      });

      return lamp;
    };

    // Helper: Create NYC fire hydrant
    const createFireHydrant = (x: number, z: number): THREE.Group => {
      const hydrant = new THREE.Group();
      hydrant.position.set(x, 0.08, z);

      const bodyGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.72, 8);
      const bodyMesh = new THREE.Mesh(bodyGeo, hydrantRedMat);
      bodyMesh.position.y = 0.36;
      hydrant.add(bodyMesh);

      const capGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.18, 8);
      const capMesh = new THREE.Mesh(capGeo, silverMat);
      capMesh.position.y = 0.78;
      hydrant.add(capMesh);

      const nozzleGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8);
      nozzleGeo.rotateZ(Math.PI / 2);
      const nozzleMesh = new THREE.Mesh(nozzleGeo, silverMat);
      nozzleMesh.position.y = 0.44;
      hydrant.add(nozzleMesh);

      colliders.push({
        type: 'cylinder',
        center: new THREE.Vector3(x, 0, z),
        radius: 0.32,
        height: 0.85,
      });

      return hydrant;
    };

    // Helper: Create wooden sidewalk bench
    const createBench = (x: number, z: number, rotationY = 0): THREE.Group => {
      const bench = new THREE.Group();
      bench.position.set(x, 0.08, z);
      bench.rotation.y = rotationY;

      // Cast iron legs
      for (const lx of [-0.85, 0.85]) {
        const legGeo = new THREE.BoxGeometry(0.08, 0.45, 0.6);
        const legMesh = new THREE.Mesh(legGeo, metalDarkMat);
        legMesh.position.set(lx, 0.225, 0);
        bench.add(legMesh);
      }

      // Wooden slats
      for (let s = -0.22; s <= 0.22; s += 0.11) {
        const slatGeo = new THREE.BoxGeometry(1.9, 0.04, 0.08);
        const slat = new THREE.Mesh(slatGeo, benchWoodMat);
        slat.position.set(0, 0.46, s);
        bench.add(slat);
      }

      // Backrest slats
      for (let b = 0.58; b <= 0.82; b += 0.11) {
        const backGeo = new THREE.BoxGeometry(1.9, 0.08, 0.04);
        const back = new THREE.Mesh(backGeo, benchWoodMat);
        back.position.set(0, b, -0.28);
        bench.add(back);
      }

      colliders.push({
        type: 'box',
        center: new THREE.Vector3(x, 0.45, z),
        box: new THREE.Box3(
          new THREE.Vector3(x - 1.0, 0, z - 0.5),
          new THREE.Vector3(x + 1.0, 0.9, z + 0.5)
        ),
      });

      return bench;
    };

    // Helper: Create modern glass bus shelter
    const createBusShelter = (x: number, z: number, rotationY = 0): THREE.Group => {
      const shelter = new THREE.Group();
      shelter.position.set(x, 0.08, z);
      shelter.rotation.y = rotationY;

      // Steel posts
      for (const px of [-1.5, 1.5]) {
        for (const pz of [-0.9, 0.9]) {
          const postGeo = new THREE.BoxGeometry(0.12, 2.6, 0.12);
          const post = new THREE.Mesh(postGeo, metalDarkMat);
          post.position.set(px, 1.3, pz);
          shelter.add(post);
        }
      }

      // Cantilever roof (solid walkable roof!)
      const roofGeo = new THREE.BoxGeometry(3.4, 0.16, 2.2);
      const roof = new THREE.Mesh(roofGeo, metalDarkMat);
      roof.position.set(0, 2.6, 0);
      shelter.add(roof);

      // Back & side tempered glass panels
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
      });

      const backGlassGeo = new THREE.BoxGeometry(3.0, 2.2, 0.05);
      const backGlass = new THREE.Mesh(backGlassGeo, glassMat);
      backGlass.position.set(0, 1.3, -0.9);
      shelter.add(backGlass);

      // Side illuminated digital ad panel
      const adGeo = new THREE.BoxGeometry(0.08, 1.8, 1.6);
      const adMesh = new THREE.Mesh(adGeo, busAdMat);
      adMesh.position.set(1.5, 1.3, 0);
      shelter.add(adMesh);

      colliders.push({
        type: 'box',
        center: new THREE.Vector3(x, 1.3, z),
        box: new THREE.Box3(
          new THREE.Vector3(x - 1.7, 0, z - 1.1),
          new THREE.Vector3(x + 1.7, 2.7, z + 1.1)
        ),
      });

      return shelter;
    };

    // Helper: Create USPS Mailbox
    const createMailbox = (x: number, z: number): THREE.Group => {
      const box = new THREE.Group();
      box.position.set(x, 0.08, z);

      const bodyGeo = new THREE.BoxGeometry(0.65, 0.9, 0.65);
      const body = new THREE.Mesh(bodyGeo, mailboxBlueMat);
      body.position.y = 0.55;
      box.add(body);

      const topGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.65, 12);
      topGeo.rotateZ(Math.PI / 2);
      const top = new THREE.Mesh(topGeo, mailboxBlueMat);
      top.position.y = 1.0;
      box.add(top);

      colliders.push({
        type: 'box',
        center: new THREE.Vector3(x, 0.6, z),
        box: new THREE.Box3(
          new THREE.Vector3(x - 0.4, 0, z - 0.4),
          new THREE.Vector3(x + 0.4, 1.2, z + 0.4)
        ),
      });

      return box;
    };

    const sidewalkOffset = 15.5;
    const minZ = streets.length > 0 ? streets[0] - 20 : -450;
    const maxZ = streets.length > 0 ? streets[streets.length - 1] + 20 : 450;
    const minX = avenues.length > 0 ? avenues[0] - 20 : -450;
    const maxX = avenues.length > 0 ? avenues[avenues.length - 1] + 20 : 450;

    // 1. Plant along North-South Avenues
    avenues.forEach((ax, aIdx) => {
      for (let z = minZ; z <= maxZ; z += 28) {
        const nearIntersection = streets.some((sz) => Math.abs(z - sz) < 20);
        if (nearIntersection) continue;

        // Skip if inside Central Park
        if (parkArea && ax >= parkArea.minX && ax <= parkArea.maxX && z >= parkArea.minZ && z <= parkArea.maxZ) {
          continue;
        }

        for (const side of [-1, 1]) {
          const px = ax + side * sidewalkOffset;
          const pz = z;

          const propType = Math.abs((z * 13 + aIdx * 7) % 100);

          if (propType < 40) {
            const treeScale = 0.85 + ((z + 500) % 30) * 0.01;
            propsGroup.add(createTree(px, pz, treeScale));
          } else if (propType < 65) {
            const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            propsGroup.add(createStreetLamp(px, pz, rotY));
          } else if (propType < 78) {
            const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            propsGroup.add(createBench(px, pz, rotY));
          } else if (propType < 88) {
            propsGroup.add(createFireHydrant(px, pz));
          } else if (propType < 94) {
            propsGroup.add(createMailbox(px, pz));
          } else {
            const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            propsGroup.add(createBusShelter(px, pz, rotY));
          }
        }
      }
    });

    // 2. Plant along East-West Cross-Streets
    streets.forEach((sz, sIdx) => {
      for (let x = minX; x <= maxX; x += 32) {
        const nearIntersection = avenues.some((ax) => Math.abs(x - ax) < 20);
        if (nearIntersection) continue;

        // Skip if inside Central Park
        if (parkArea && x >= parkArea.minX && x <= parkArea.maxX && sz >= parkArea.minZ && sz <= parkArea.maxZ) {
          continue;
        }

        for (const side of [-1, 1]) {
          const px = x;
          const pz = sz + side * sidewalkOffset;

          const propType = Math.abs((x * 17 + sIdx * 11) % 100);

          if (propType < 45) {
            propsGroup.add(createTree(px, pz, 0.95));
          } else if (propType < 75) {
            const rotY = side > 0 ? 0 : Math.PI;
            propsGroup.add(createStreetLamp(px, pz, rotY));
          } else if (propType < 90) {
            const rotY = side > 0 ? 0 : Math.PI;
            propsGroup.add(createBench(px, pz, rotY));
          } else {
            propsGroup.add(createFireHydrant(px, pz));
          }
        }
      }
    });

    // 3. Central Park Scenic Trees & Benches (around the lake)
    if (parkArea) {
      const parkCenterX = (parkArea.minX + parkArea.maxX) / 2;
      const parkCenterZ = (parkArea.minZ + parkArea.maxZ) / 2;

      // Ring of park trees
      for (let angle = 0; angle < Math.PI * 2; angle += 0.35) {
        const r = 68 + Math.sin(angle * 4) * 14;
        const tx = parkCenterX + Math.cos(angle) * r;
        const tz = parkCenterZ + Math.sin(angle) * r;
        propsGroup.add(createTree(tx, tz, 1.25 + Math.sin(angle * 3) * 0.2));

        if (Math.abs(Math.sin(angle * 2)) > 0.6) {
          propsGroup.add(createBench(tx + 4, tz + 4, angle + Math.PI / 2));
        }
      }
    }

    return { group: propsGroup, colliders };
  }
}
