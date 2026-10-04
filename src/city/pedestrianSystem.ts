import * as THREE from 'three';

export interface Pedestrian {
  group: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  head: THREE.Mesh;
  walkCycle: number;
  cadence: number;
  speed: number;
  direction: number; // 1 or -1
  axis: 'x' | 'z';
  minBound: number;
  maxBound: number;
  isRooftop?: boolean;
  baseRotY: number;
  isCheering: boolean;
}

export interface PedestrianOptions {
  avenues: number[];
  streets: number[];
  rooftops: THREE.Vector3[];
}

export class PedestrianSystem {
  public group: THREE.Group;
  private pedestrians: Pedestrian[] = [];

  constructor(options: PedestrianOptions) {
    this.group = new THREE.Group();
    this.group.name = 'PedestrianSystemGroup';
    this.initPedestrians(options);
  }

  private initPedestrians(options: PedestrianOptions) {
    const { avenues, streets, rooftops } = options;

    // Skin tones
    const skinTones = [0xfbcfe8, 0xfde047, 0xfbbf24, 0xd97706, 0x92400e, 0x78350f];

    // Clothes colors
    const shirtColors = [
      0xef4444, // Red jacket
      0x3b82f6, // Blue shirt
      0x10b981, // Emerald hoodie
      0xf59e0b, // Amber coat
      0x8b5cf6, // Violet tee
      0xec4899, // Pink sweater
      0xf1f5f9, // White polo
      0x1e293b, // Charcoal suit
    ];

    const pantColors = [
      0x1e293b, // Dark jeans
      0x334155, // Navy pants
      0x475569, // Grey denim
      0x94a3b8, // Light khaki
      0x0f172a, // Black slacks
    ];

    const hairColors = [0x090d16, 0x451a03, 0x78350f, 0xd97706, 0x94a3b8];

    // Common geometries
    const headGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const hairGeo = new THREE.SphereGeometry(0.19, 12, 12);
    const torsoGeo = new THREE.BoxGeometry(0.44, 0.65, 0.28);
    const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
    const legGeo = new THREE.BoxGeometry(0.16, 0.72, 0.16);

    const createPedestrianModel = (isRooftop = false) => {
      const pGroup = new THREE.Group();

      const skinColor = skinTones[Math.floor(Math.random() * skinTones.length)];
      const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
      const pantColor = pantColors[Math.floor(Math.random() * pantColors.length)];
      const hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];

      const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
      const pantMat = new THREE.MeshStandardMaterial({ color: pantColor, roughness: 0.8 });
      const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });

      // Torso
      const torso = new THREE.Mesh(torsoGeo, shirtMat);
      torso.position.y = 1.05;
      torso.castShadow = true;
      pGroup.add(torso);

      // Head & Hair
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 1.55, 0);
      head.castShadow = true;
      pGroup.add(head);

      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.set(0, 1.6, -0.02);
      hair.scale.set(1.02, 0.85, 1.02);
      pGroup.add(hair);

      // Left Arm
      const leftArm = new THREE.Mesh(armGeo, shirtMat);
      leftArm.position.set(-0.3, 1.05, 0);
      pGroup.add(leftArm);

      // Right Arm
      const rightArm = new THREE.Mesh(armGeo, shirtMat);
      rightArm.position.set(0.3, 1.05, 0);
      pGroup.add(rightArm);

      // Left Leg
      const leftLeg = new THREE.Mesh(legGeo, pantMat);
      leftLeg.position.set(-0.13, 0.36, 0);
      pGroup.add(leftLeg);

      // Right Leg
      const rightLeg = new THREE.Mesh(legGeo, pantMat);
      rightLeg.position.set(0.13, 0.36, 0);
      pGroup.add(rightLeg);

      return { pGroup, leftArm, rightArm, leftLeg, rightLeg, head };
    };

    // Spawn sidewalk pedestrians along North-South Avenues
    const sidewalkOffset = 16.2;

    avenues.forEach((ax, aIdx) => {
      for (const side of [-1, 1]) {
        const swX = ax + side * sidewalkOffset;
        const count = 4;

        for (let i = 0; i < count; i++) {
          const { pGroup, leftArm, rightArm, leftLeg, rightLeg, head } = createPedestrianModel();
          const startZ = -340 + ((i * 180 + aIdx * 60) % 680);
          pGroup.position.set(swX, 0, startZ);

          const dir = (i + aIdx) % 2 === 0 ? 1 : -1;
          const baseRot = dir > 0 ? 0 : Math.PI;
          pGroup.rotation.y = baseRot;

          this.group.add(pGroup);

          this.pedestrians.push({
            group: pGroup,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            head,
            walkCycle: Math.random() * Math.PI * 2,
            cadence: 4.8 + Math.random() * 2.0,
            speed: 2.2 + Math.random() * 1.6,
            direction: dir,
            axis: 'z',
            minBound: -360,
            maxBound: 360,
            baseRotY: baseRot,
            isCheering: false,
          });
        }
      }
    });

    // Spawn cross-street pedestrians along East-West Streets
    streets.forEach((sz, sIdx) => {
      for (const side of [-1, 1]) {
        const swZ = sz + side * sidewalkOffset;
        const count = 3;

        for (let i = 0; i < count; i++) {
          const { pGroup, leftArm, rightArm, leftLeg, rightLeg, head } = createPedestrianModel();
          const startX = -320 + ((i * 220 + sIdx * 70) % 640);
          pGroup.position.set(startX, 0, swZ);

          const dir = (i + sIdx) % 2 === 0 ? 1 : -1;
          const baseRot = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          pGroup.rotation.y = baseRot;

          this.group.add(pGroup);

          this.pedestrians.push({
            group: pGroup,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            head,
            walkCycle: Math.random() * Math.PI * 2,
            cadence: 4.8 + Math.random() * 2.0,
            speed: 2.2 + Math.random() * 1.6,
            direction: dir,
            axis: 'x',
            minBound: -360,
            maxBound: 360,
            baseRotY: baseRot,
            isCheering: false,
          });
        }
      }
    });

    // Spawn rooftop citizens on tall buildings (observation decks & helipads)
    rooftops.slice(0, 16).forEach((roofPos, idx) => {
      const roofCount = 1 + (idx % 2);
      for (let r = 0; r < roofCount; r++) {
        const { pGroup, leftArm, rightArm, leftLeg, rightLeg, head } = createPedestrianModel(true);
        const ox = (Math.random() - 0.5) * 16;
        const oz = (Math.random() - 0.5) * 16;
        pGroup.position.set(roofPos.x + ox, roofPos.y, roofPos.z + oz);

        const rot = Math.random() * Math.PI * 2;
        pGroup.rotation.y = rot;

        this.group.add(pGroup);

        this.pedestrians.push({
          group: pGroup,
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          head,
          walkCycle: Math.random() * Math.PI * 2,
          cadence: 2.5,
          speed: 0, // Standing on rooftop looking out at city
          direction: 0,
          axis: 'z',
          minBound: -400,
          maxBound: 400,
          isRooftop: true,
          baseRotY: rot,
          isCheering: false,
        });
      }
    });
  }

  public update(dt: number, heroPosition?: THREE.Vector3) {
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];

      // Check distance to Spider-Man for friendly superhero reaction!
      let shouldCheer = false;
      if (heroPosition) {
        const dist = p.group.position.distanceTo(heroPosition);
        // If Spider-Man is nearby (< 18m), pedestrians look and cheer!
        if (dist < 18.0) {
          shouldCheer = true;
        }
      }

      p.isCheering = shouldCheer;

      if (shouldCheer && heroPosition) {
        // Stop walking and face Spider-Man
        const toHero = new THREE.Vector3().subVectors(heroPosition, p.group.position);
        const lookAngle = Math.atan2(toHero.x, toHero.z);
        p.group.rotation.y = THREE.MathUtils.lerp(p.group.rotation.y, lookAngle, 0.15);

        // Raise arms up and wave / cheer!
        p.walkCycle += dt * 7.0;
        const wave = Math.sin(p.walkCycle) * 0.45;
        p.leftArm.rotation.x = -2.4 + wave;
        p.rightArm.rotation.x = -2.4 - wave;
        p.leftArm.rotation.z = -0.4;
        p.rightArm.rotation.z = 0.4;

        // Reset legs to standing
        p.leftLeg.rotation.x = 0;
        p.rightLeg.rotation.x = 0;

        // Head looks up at hero
        const elev = Math.atan2(toHero.y, Math.hypot(toHero.x, toHero.z));
        p.head.rotation.x = THREE.MathUtils.clamp(-elev, -0.6, 0.4);
      } else {
        // Normal locomotion or rooftop sightseeing
        p.group.rotation.y = THREE.MathUtils.lerp(p.group.rotation.y, p.baseRotY, 0.1);
        p.head.rotation.x = THREE.MathUtils.lerp(p.head.rotation.x, 0, 0.1);

        if (p.speed > 0) {
          p.walkCycle += dt * p.cadence;
          const stride = Math.sin(p.walkCycle);

          // Move along sidewalk
          if (p.axis === 'z') {
            p.group.position.z += p.direction * p.speed * dt;
            if (p.direction > 0 && p.group.position.z > p.maxBound) {
              p.direction = -1;
              p.baseRotY = Math.PI;
            } else if (p.direction < 0 && p.group.position.z < p.minBound) {
              p.direction = 1;
              p.baseRotY = 0;
            }
          } else {
            p.group.position.x += p.direction * p.speed * dt;
            if (p.direction > 0 && p.group.position.x > p.maxBound) {
              p.direction = -1;
              p.baseRotY = -Math.PI / 2;
            } else if (p.direction < 0 && p.group.position.x < p.minBound) {
              p.direction = 1;
              p.baseRotY = Math.PI / 2;
            }
          }

          // Natural pedestrian arm and leg swings
          p.leftLeg.rotation.x = stride * 0.6;
          p.rightLeg.rotation.x = -stride * 0.6;
          p.leftArm.rotation.x = -stride * 0.5;
          p.rightArm.rotation.x = stride * 0.5;
          p.leftArm.rotation.z = -0.1;
          p.rightArm.rotation.z = 0.1;
        } else {
          // Rooftop sightseeing: subtle idle breathing & looking around
          p.walkCycle += dt * 1.5;
          p.leftArm.rotation.x = THREE.MathUtils.lerp(p.leftArm.rotation.x, 0.1, 0.1);
          p.rightArm.rotation.x = THREE.MathUtils.lerp(p.rightArm.rotation.x, 0.1, 0.1);
          p.leftLeg.rotation.x = 0;
          p.rightLeg.rotation.x = 0;
          p.head.rotation.y = Math.sin(p.walkCycle * 0.5) * 0.35;
        }
      }
    }
  }
}
