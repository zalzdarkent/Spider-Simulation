import * as THREE from 'three';
import { modelManager } from '../renderer/modelManager';

export type PedestrianReaction =
  | 'wave_single'
  | 'take_photo'
  | 'cheer_double'
  | 'point'
  | 'thumbs_up'
  | 'shocked'
  | 'busy_commuter';

const REACTION_DIALOGUES: Record<PedestrianReaction, { emoji: string; lines: string[] }> = {
  wave_single: {
    emoji: '👋',
    lines: ['Hey Spider-Man!', 'Yo Spidey!', 'NYC loves you!', 'Looking good today!'],
  },
  take_photo: {
    emoji: '📸',
    lines: ['Say cheese, Spidey!', "Wait 'til Peter sees this!", 'Smile for the camera!', 'Gotta post this!'],
  },
  cheer_double: {
    emoji: '🕷️',
    lines: ['WOOHOO! SPIDER-MAN!!', "You're my hero!", 'DO A BACKFLIP!', 'SAVE NYC SPIDEY!'],
  },
  point: {
    emoji: '👉',
    lines: ["Look! It's Spider-Man!", 'Over here, Spidey!', 'Mom, look! Up there!'],
  },
  thumbs_up: {
    emoji: '👍',
    lines: ['Keep up the great work!', 'Nice suit, Spidey!', 'Stay safe out there!'],
  },
  shocked: {
    emoji: '😲',
    lines: ['Whoa! You scared me!', 'Did you fall from the sky?!', 'Is that the real Spider-Man?!'],
  },
  busy_commuter: {
    emoji: '🚶',
    lines: ['Nice tights, kid.', 'Late for the subway!', 'Just another day in NYC.', "I'm walkin' here!"],
  },
};

const REACTION_WEIGHTS: { type: PedestrianReaction; weight: number }[] = [
  { type: 'wave_single', weight: 26 },
  { type: 'take_photo', weight: 20 },
  { type: 'point', weight: 16 },
  { type: 'cheer_double', weight: 14 },
  { type: 'thumbs_up', weight: 12 },
  { type: 'busy_commuter', weight: 12 },
];

function getRandomReactionType(): PedestrianReaction {
  const total = REACTION_WEIGHTS.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of REACTION_WEIGHTS) {
    if (roll < r.weight) return r.type;
    roll -= r.weight;
  }
  return 'wave_single';
}

function createSpeechBubbleSprite(emoji: string, text: string): THREE.Sprite | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const x = 16, y = 8, w = 480, h = 88, r = 22;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);

  // Comic tail pointing down towards the NPC's head
  const tailX = x + w / 2;
  ctx.lineTo(tailX + 14, y + h);
  ctx.lineTo(tailX, y + h + 22);
  ctx.lineTo(tailX - 14, y + h);

  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  // Dark slate backdrop
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.fill();

  // Vibrant cyan border
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
  ctx.stroke();

  // Render emoji
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 32, y + h / 2);

  // Render text
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(text, 86, y + h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.001, 0.001, 1);
  sprite.position.set(0, 2.35, 0);
  sprite.visible = false;
  return sprite;
}

function createPhoneMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.12, 0.22, 0.025);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.2,
    metalness: 0.8,
  });
  const phone = new THREE.Mesh(geo, bodyMat);
  phone.name = 'SmartphoneProp';

  const screenGeo = new THREE.PlaneGeometry(0.1, 0.19);
  const screenMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.name = 'SmartphoneScreen';
  screen.position.set(0, 0, 0.013);
  phone.add(screen);

  phone.visible = false;
  return phone;
}

export interface Pedestrian {
  group: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  head: THREE.Object3D;
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
  isGlb?: boolean;

  // Varied reaction personality system
  reactionType: PedestrianReaction;
  reactionDistance: number;
  reactionWeight: number;
  animTime: number;
  initialY: number;
  bubbleSprite?: THREE.Sprite;
  phoneMesh?: THREE.Mesh;
  photoFlashTimer: number;
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

    modelManager.onModelsLoaded(() => {
      this.upgradeToGLB();
    });
  }

  private upgradeToGLB() {
    this.pedestrians.forEach((p) => {
      if (p.isGlb) return;
      const npcInstance = modelManager.createNpcInstance();
      if (npcInstance) {
        // Detach custom props (speech bubble, phone) before clearing children
        if (p.bubbleSprite && p.bubbleSprite.parent === p.group) {
          p.group.remove(p.bubbleSprite);
        }

        while (p.group.children.length > 0) {
          p.group.remove(p.group.children[0]);
        }

        p.group.add(npcInstance.group);
        if (npcInstance.leftArm) p.leftArm = npcInstance.leftArm;
        if (npcInstance.rightArm) p.rightArm = npcInstance.rightArm;
        if (npcInstance.leftLeg) p.leftLeg = npcInstance.leftLeg;
        if (npcInstance.rightLeg) p.rightLeg = npcInstance.rightLeg;
        if (npcInstance.head) p.head = npcInstance.head;

        // Re-attach speech bubble
        if (p.bubbleSprite) {
          p.group.add(p.bubbleSprite);
        }

        // Attach phone prop to right arm if photographer
        if (p.reactionType === 'take_photo') {
          if (!p.phoneMesh) p.phoneMesh = createPhoneMesh();
          if (p.rightArm) {
            p.phoneMesh.position.set(0, -0.65, 0.12);
            p.phoneMesh.rotation.set(-0.2, 0, 0);
            p.rightArm.add(p.phoneMesh);
          }
        }

        p.isGlb = true;
      }
    });
  }

  private initPedestrians(options: PedestrianOptions) {
    const { avenues, streets, rooftops } = options;

    // Skin tones
    const skinTones = [0xfbcfe8, 0xfde047, 0xfbbf24, 0xd97706, 0x92400e, 0x78350f];

    // Clothes colors
    const shirtColors = [
      0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0xf1f5f9, 0x1e293b,
    ];

    const pantColors = [0x1e293b, 0x334155, 0x475569, 0x94a3b8, 0x0f172a];
    const hairColors = [0x090d16, 0x451a03, 0x78350f, 0xd97706, 0x94a3b8];

    // Common fallback geometries
    const headGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const hairGeo = new THREE.SphereGeometry(0.19, 12, 12);
    const torsoGeo = new THREE.BoxGeometry(0.44, 0.65, 0.28);
    const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
    const legGeo = new THREE.BoxGeometry(0.16, 0.72, 0.16);

    const createPedestrianModel = (_isRooftop = false) => {
      const glbNpc = modelManager.createNpcInstance();
      if (glbNpc && glbNpc.leftArm && glbNpc.rightArm && glbNpc.leftLeg && glbNpc.rightLeg && glbNpc.head) {
        return {
          pGroup: glbNpc.group,
          leftArm: glbNpc.leftArm,
          rightArm: glbNpc.rightArm,
          leftLeg: glbNpc.leftLeg,
          rightLeg: glbNpc.rightLeg,
          head: glbNpc.head,
          isGlb: true,
        };
      }

      const pGroup = new THREE.Group();
      const skinColor = skinTones[Math.floor(Math.random() * skinTones.length)];
      const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
      const pantColor = pantColors[Math.floor(Math.random() * pantColors.length)];
      const hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];

      const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
      const pantMat = new THREE.MeshStandardMaterial({ color: pantColor, roughness: 0.8 });
      const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });

      const torso = new THREE.Mesh(torsoGeo, shirtMat);
      torso.position.y = 1.05;
      torso.castShadow = true;
      pGroup.add(torso);

      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 1.55, 0);
      head.castShadow = true;
      pGroup.add(head);

      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.set(0, 1.6, -0.02);
      hair.scale.set(1.02, 0.85, 1.02);
      pGroup.add(hair);

      const leftArm = new THREE.Mesh(armGeo, shirtMat);
      leftArm.position.set(-0.3, 1.05, 0);
      pGroup.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, shirtMat);
      rightArm.position.set(0.3, 1.05, 0);
      pGroup.add(rightArm);

      const leftLeg = new THREE.Mesh(legGeo, pantMat);
      leftLeg.position.set(-0.13, 0.36, 0);
      pGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, pantMat);
      rightLeg.position.set(0.13, 0.36, 0);
      pGroup.add(rightLeg);

      return { pGroup, leftArm, rightArm, leftLeg, rightLeg, head, isGlb: false };
    };

    const attachReactionFeatures = (
      pGroup: THREE.Group,
      rightArm: THREE.Object3D,
      reactionType: PedestrianReaction
    ) => {
      // Speech bubble sprite
      const dialInfo = REACTION_DIALOGUES[reactionType];
      const randomLine = dialInfo.lines[Math.floor(Math.random() * dialInfo.lines.length)];
      const bubbleSprite = createSpeechBubbleSprite(dialInfo.emoji, randomLine);
      if (bubbleSprite) {
        pGroup.add(bubbleSprite);
      }

      // Smartphone prop for photographers
      let phoneMesh: THREE.Mesh | undefined;
      if (reactionType === 'take_photo') {
        phoneMesh = createPhoneMesh();
        phoneMesh.position.set(0, -0.65, 0.12);
        phoneMesh.rotation.set(-0.2, 0, 0);
        rightArm.add(phoneMesh);
      }

      // Reaction detection distance based on personality
      let reactionDist = 10.0;
      switch (reactionType) {
        case 'cheer_double':
        case 'point':
          reactionDist = 13.0 + Math.random() * 3.5; // Notices from farther away
          break;
        case 'wave_single':
        case 'take_photo':
        case 'thumbs_up':
          reactionDist = 9.0 + Math.random() * 3.0;
          break;
        case 'shocked':
          reactionDist = 7.0 + Math.random() * 2.5;
          break;
        case 'busy_commuter':
          reactionDist = 6.0 + Math.random() * 2.0; // Only glances when very close
          break;
      }

      return { bubbleSprite: bubbleSprite || undefined, phoneMesh, reactionDist };
    };

    // Spawn sidewalk pedestrians along North-South Avenues
    const sidewalkOffset = 16.2;

    avenues.forEach((ax, aIdx) => {
      for (const side of [-1, 1]) {
        const swX = ax + side * sidewalkOffset;
        const count = 4;

        for (let i = 0; i < count; i++) {
          const { pGroup, leftArm, rightArm, leftLeg, rightLeg, head, isGlb } = createPedestrianModel();
          const startZ = -340 + ((i * 180 + aIdx * 60) % 680);
          const initialY = 0.08;
          pGroup.position.set(swX, initialY, startZ);

          const dir = (i + aIdx) % 2 === 0 ? 1 : -1;
          const baseRot = dir > 0 ? 0 : Math.PI;
          pGroup.rotation.y = baseRot;

          this.group.add(pGroup);

          const reactionType = getRandomReactionType();
          const { bubbleSprite, phoneMesh, reactionDist } = attachReactionFeatures(
            pGroup,
            rightArm,
            reactionType
          );

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
            isGlb,
            reactionType,
            reactionDistance: reactionDist,
            reactionWeight: 0,
            animTime: Math.random() * 10,
            initialY,
            bubbleSprite,
            phoneMesh,
            photoFlashTimer: 0,
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
          const { pGroup, leftArm, rightArm, leftLeg, rightLeg, head, isGlb } = createPedestrianModel();
          const startX = -320 + ((i * 220 + sIdx * 70) % 640);
          const initialY = 0.08;
          pGroup.position.set(startX, initialY, swZ);

          const dir = (i + sIdx) % 2 === 0 ? 1 : -1;
          const baseRot = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          pGroup.rotation.y = baseRot;

          this.group.add(pGroup);

          const reactionType = getRandomReactionType();
          const { bubbleSprite, phoneMesh, reactionDist } = attachReactionFeatures(
            pGroup,
            rightArm,
            reactionType
          );

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
            isGlb,
            reactionType,
            reactionDistance: reactionDist,
            reactionWeight: 0,
            animTime: Math.random() * 10,
            initialY,
            bubbleSprite,
            phoneMesh,
            photoFlashTimer: 0,
          });
        }
      }
    });

    // Spawn rooftop citizens on tall buildings (observation decks & helipads)
    rooftops.slice(0, 16).forEach((roofPos, idx) => {
      const roofCount = 1 + (idx % 2);
      for (let r = 0; r < roofCount; r++) {
        const { pGroup, leftArm, rightArm, leftLeg, rightLeg, head, isGlb } = createPedestrianModel(true);
        const ox = (Math.random() - 0.5) * 16;
        const oz = (Math.random() - 0.5) * 16;
        const initialY = roofPos.y;
        pGroup.position.set(roofPos.x + ox, initialY, roofPos.z + oz);

        const rot = Math.random() * Math.PI * 2;
        pGroup.rotation.y = rot;

        this.group.add(pGroup);

        const reactionType = getRandomReactionType();
        const { bubbleSprite, phoneMesh, reactionDist } = attachReactionFeatures(
          pGroup,
          rightArm,
          reactionType
        );

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
          isGlb,
          reactionType,
          reactionDistance: reactionDist,
          reactionWeight: 0,
          animTime: Math.random() * 10,
          initialY,
          bubbleSprite,
          phoneMesh,
          photoFlashTimer: 0,
        });
      }
    });
  }

  public update(dt: number, heroPosition?: THREE.Vector3) {
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      p.animTime += dt;

      // Check distance to Spider-Man
      let isHeroClose = false;
      if (heroPosition) {
        const dist = p.group.position.distanceTo(heroPosition);
        if (dist < p.reactionDistance) {
          isHeroClose = true;
        }
      }

      // Smoothly blend reaction weight (0.0 = normal walking/idle, 1.0 = full reaction)
      const targetWeight = isHeroClose ? 1.0 : 0.0;
      p.reactionWeight = THREE.MathUtils.lerp(p.reactionWeight, targetWeight, dt * 5.0);
      p.isCheering = p.reactionWeight > 0.15;

      // Update speech bubble sprite visibility and scale
      if (p.bubbleSprite) {
        if (p.reactionWeight > 0.08) {
          p.bubbleSprite.visible = true;
          const s = p.reactionWeight;
          p.bubbleSprite.scale.set(2.4 * s, 0.65 * s, 1);
          (p.bubbleSprite.material as THREE.SpriteMaterial).opacity = Math.min(1, s * 1.1);
          p.bubbleSprite.position.y = 2.35 + Math.sin(p.animTime * 3.0) * 0.04;
        } else {
          p.bubbleSprite.visible = false;
          p.bubbleSprite.scale.set(0.001, 0.001, 1);
          (p.bubbleSprite.material as THREE.SpriteMaterial).opacity = 0;
        }
      }

      // Update smartphone prop & camera flash for photographers
      if (p.phoneMesh) {
        const showPhone = p.reactionType === 'take_photo' && p.reactionWeight > 0.25;
        p.phoneMesh.visible = showPhone;

        if (showPhone && p.reactionWeight > 0.7) {
          p.photoFlashTimer += dt;
          const screen = p.phoneMesh.getObjectByName('SmartphoneScreen') as THREE.Mesh | undefined;
          if (screen && screen.material) {
            // Flash camera screen white every 2.4 seconds
            if (p.photoFlashTimer > 2.4) {
              (screen.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
              if (p.photoFlashTimer > 2.52) {
                p.photoFlashTimer = 0;
                (screen.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
              }
            } else {
              (screen.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
            }
          }
        }
      }

      // Calculate base locomotion values (walking or rooftop idle)
      let walkSpeedFactor = 1.0;
      if (p.reactionType !== 'busy_commuter') {
        // Stop walking when interacting with hero
        walkSpeedFactor = Math.max(0, 1.0 - p.reactionWeight * 1.5);
      }

      let baseLeftLegX = 0;
      let baseRightLegX = 0;
      let baseLeftArmX = 0;
      let baseRightArmX = 0;
      let baseLeftArmZ = -0.1;
      let baseRightArmZ = 0.1;
      let baseLeftArmY = 0;
      let baseRightArmY = 0;

      if (p.speed > 0) {
        const cycleSpeed = p.reactionType === 'busy_commuter' ? 1.0 : (walkSpeedFactor > 0.05 ? 1.0 : 0);
        p.walkCycle += dt * p.cadence * cycleSpeed;
        const stride = Math.sin(p.walkCycle);

        // Move along sidewalk path
        if (walkSpeedFactor > 0.01) {
          const moveStep = p.direction * p.speed * dt * walkSpeedFactor;
          if (p.axis === 'z') {
            p.group.position.z += moveStep;
            if (p.direction > 0 && p.group.position.z > p.maxBound) {
              p.direction = -1;
              p.baseRotY = Math.PI;
            } else if (p.direction < 0 && p.group.position.z < p.minBound) {
              p.direction = 1;
              p.baseRotY = 0;
            }
          } else {
            p.group.position.x += moveStep;
            if (p.direction > 0 && p.group.position.x > p.maxBound) {
              p.direction = -1;
              p.baseRotY = -Math.PI / 2;
            } else if (p.direction < 0 && p.group.position.x < p.minBound) {
              p.direction = 1;
              p.baseRotY = Math.PI / 2;
            }
          }
        }

        // Natural walking limb rotation
        baseLeftLegX = stride * 0.6;
        baseRightLegX = -stride * 0.6;
        baseLeftArmX = -stride * 0.5;
        baseRightArmX = stride * 0.5;
      } else {
        // Rooftop sightseeing: subtle idle breathing
        p.walkCycle += dt * 1.5;
        baseLeftArmX = 0.08;
        baseRightArmX = 0.08;
      }

      // Calculate reaction target poses
      let targetGroupRotY = p.baseRotY;
      let targetGroupY = p.initialY;
      let targetGroupRotX = 0;
      let targetHeadX = 0;
      let targetHeadY = 0;

      let reactLeftArmX = baseLeftArmX;
      let reactRightArmX = baseRightArmX;
      let reactLeftArmZ = baseLeftArmZ;
      let reactRightArmZ = baseRightArmZ;
      let reactLeftArmY = 0;
      let reactRightArmY = 0;
      let reactLeftLegX = 0;
      let reactRightLegX = 0;

      if (heroPosition && p.reactionWeight > 0.01) {
        const toHero = new THREE.Vector3().subVectors(heroPosition, p.group.position);
        const lookAngle = Math.atan2(toHero.x, toHero.z);
        const elev = Math.atan2(toHero.y, Math.hypot(toHero.x, toHero.z));

        if (p.reactionType === 'busy_commuter') {
          // Classic New Yorker: does NOT stop walking! Only turns head to watch Spidey
          let angleDiff = lookAngle - p.baseRotY;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          targetHeadY = THREE.MathUtils.clamp(angleDiff, -1.1, 1.1);
          targetHeadX = THREE.MathUtils.clamp(-elev, -0.4, 0.4);

          // Subtle casual one-hand wave while walking
          reactRightArmX = baseRightArmX - 0.35;
          reactRightArmZ = 0.22;
        } else {
          // Turn body toward Spider-Man
          targetGroupRotY = lookAngle;
          targetHeadX = THREE.MathUtils.clamp(-elev, -0.6, 0.4);

          switch (p.reactionType) {
            case 'wave_single': {
              // Casual friendly one-handed wave (right arm)
              const wave = Math.sin(p.animTime * 6.0) * 0.35;
              reactRightArmX = -1.6 + wave;
              reactRightArmZ = 0.45 + Math.cos(p.animTime * 6.0) * 0.15;
              reactRightArmY = -0.25;
              reactLeftArmX = 0.05;
              reactLeftArmZ = -0.08;
              break;
            }

            case 'take_photo': {
              // Holds smartphone up with both hands taking photos
              reactRightArmX = -1.35;
              reactRightArmZ = -0.15;
              reactRightArmY = -0.4;
              reactLeftArmX = -1.25;
              reactLeftArmZ = 0.25;
              reactLeftArmY = 0.3;
              targetHeadX = THREE.MathUtils.clamp(-elev - 0.08, -0.5, 0.3);
              targetHeadY = 0.06;
              break;
            }

            case 'cheer_double': {
              // Enthusiastic fan pumping both fists in the air and hopping
              const cheerWave = Math.sin(p.animTime * 8.0) * 0.4;
              reactRightArmX = -2.3 + cheerWave;
              reactLeftArmX = -2.3 - cheerWave;
              reactRightArmZ = 0.35;
              reactLeftArmZ = -0.35;
              const hop = Math.max(0, Math.sin(p.animTime * 10.0) * 0.12);
              targetGroupY = p.initialY + hop;
              if (hop > 0.02) {
                reactLeftLegX = 0.2;
                reactRightLegX = 0.2;
              }
              break;
            }

            case 'point': {
              // Points right hand at Spider-Man, left hand on hip
              reactRightArmX = -1.55;
              reactRightArmZ = 0.05;
              reactRightArmY = -0.1;
              reactLeftArmX = 0.2;
              reactLeftArmZ = -0.4;
              targetHeadY = Math.sin(p.animTime * 2.5) * 0.25;
              break;
            }

            case 'thumbs_up': {
              // Cool thumbs up forward, relaxed nod
              reactRightArmX = -1.45;
              reactRightArmZ = 0.15;
              reactRightArmY = -0.1;
              reactLeftArmX = 0.05;
              reactLeftArmZ = -0.08;
              targetHeadX = THREE.MathUtils.clamp(-elev, -0.5, 0.3) + Math.sin(p.animTime * 4.0) * 0.12;
              break;
            }

            case 'shocked': {
              // Gasp with hands to face/chest, leans back
              reactRightArmX = -1.25;
              reactRightArmZ = -0.32;
              reactLeftArmX = -1.25;
              reactLeftArmZ = 0.32;
              targetGroupRotX = -0.12;
              break;
            }
          }
        }
      }

      // Smoothly blend between base locomotion pose and reaction pose
      const w = p.reactionWeight;
      p.leftArm.rotation.x = THREE.MathUtils.lerp(baseLeftArmX, reactLeftArmX, w);
      p.rightArm.rotation.x = THREE.MathUtils.lerp(baseRightArmX, reactRightArmX, w);
      p.leftArm.rotation.z = THREE.MathUtils.lerp(baseLeftArmZ, reactLeftArmZ, w);
      p.rightArm.rotation.z = THREE.MathUtils.lerp(baseRightArmZ, reactRightArmZ, w);
      p.leftArm.rotation.y = THREE.MathUtils.lerp(baseLeftArmY, reactLeftArmY, w);
      p.rightArm.rotation.y = THREE.MathUtils.lerp(baseRightArmY, reactRightArmY, w);

      if (p.reactionType !== 'busy_commuter') {
        p.leftLeg.rotation.x = THREE.MathUtils.lerp(baseLeftLegX, reactLeftLegX, w);
        p.rightLeg.rotation.x = THREE.MathUtils.lerp(baseRightLegX, reactRightLegX, w);
        p.group.rotation.y = THREE.MathUtils.lerp(p.baseRotY, targetGroupRotY, w);
        p.group.position.y = THREE.MathUtils.lerp(p.initialY, targetGroupY, w);
        p.group.rotation.x = THREE.MathUtils.lerp(0, targetGroupRotX, w);
      } else {
        p.leftLeg.rotation.x = baseLeftLegX;
        p.rightLeg.rotation.x = baseRightLegX;
        p.group.rotation.y = p.baseRotY;
        p.group.position.y = p.initialY;
      }

      p.head.rotation.x = THREE.MathUtils.lerp(0, targetHeadX, w);
      p.head.rotation.y = THREE.MathUtils.lerp(0, targetHeadY, w);
    }
  }

  /**
   * Returns cylinder colliders for all pedestrians
   */
  public getColliders(): { position: THREE.Vector3; radius: number; height: number }[] {
    return this.pedestrians.map((p) => ({
      position: p.group.position,
      radius: 0.45,
      height: 1.8,
    }));
  }
}
