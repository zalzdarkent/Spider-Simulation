import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface NpcInstance {
  group: THREE.Group;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  head?: THREE.Object3D;
  rightHand?: THREE.Object3D;
}

export interface SpidermanInstance {
  group: THREE.Group;
  rootBone?: THREE.Object3D;
  torsoBone?: THREE.Object3D;
  headBone?: THREE.Object3D;
  shoulderL?: THREE.Object3D;
  armL?: THREE.Object3D;
  shoulderR?: THREE.Object3D;
  armR?: THREE.Object3D;
  handR?: THREE.Object3D;
  handL?: THREE.Object3D;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  initialQuats: Map<string, THREE.Quaternion>;
}

export interface CarInstance {
  group: THREE.Group;
  isPolice?: boolean;
  policeBeacons?: { red: THREE.Mesh; blue: THREE.Mesh };
  taillights?: THREE.Mesh[];
  leftBlinkers?: THREE.Mesh[];
  rightBlinkers?: THREE.Mesh[];
}

class ModelManager {
  private loader: GLTFLoader;
  private spidermanTemplate: THREE.Group | null = null;
  private carTemplate: THREE.Group | null = null;
  private npcTemplate: THREE.Group | null = null;

  public isSpidermanLoaded = false;
  public isCarLoaded = false;
  public isNpcLoaded = false;

  private listeners: (() => void)[] = [];
  private loadPromise: Promise<void> | null = null;

  constructor() {
    this.loader = new GLTFLoader();
  }

  public onModelsLoaded(listener: () => void) {
    this.listeners.push(listener);
    if (this.isSpidermanLoaded && this.isCarLoaded && this.isNpcLoaded) {
      listener();
    }
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('ModelManager listener error:', e);
      }
    });
  }

  public async preloadAll(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      await Promise.allSettled([
        this.loadSpiderman(),
        this.loadCar(),
        this.loadNpc(),
      ]);
      this.notify();
    })();

    return this.loadPromise;
  }

  private loadSpiderman(): Promise<void> {
    return new Promise((resolve) => {
      const tryLoad = (url: string, fallbackUrl?: string) => {
        this.loader.load(
          url,
          (gltf) => {
            const root = gltf.scene;

            // Configure shadows & materials
            root.traverse((obj) => {
              if ((obj as THREE.Mesh).isMesh) {
                const m = obj as THREE.Mesh;
                m.castShadow = true;
                m.receiveShadow = true;
                if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
                  m.frustumCulled = false;
                }
                if (m.material) {
                  const mats = Array.isArray(m.material) ? m.material : [m.material];
                  mats.forEach((mat) => {
                    mat.depthWrite = true;
                    mat.side = THREE.DoubleSide;
                    if ('roughness' in mat) (mat as THREE.MeshStandardMaterial).roughness = 0.42;
                    if ('metalness' in mat) (mat as THREE.MeshStandardMaterial).metalness = 0.25;
                  });
                }
              }
            });

            this.spidermanTemplate = root;
            this.isSpidermanLoaded = true;
            this.notify();
            resolve();
          },
          undefined,
          (err) => {
            if (fallbackUrl) {
              tryLoad(fallbackUrl);
            } else {
              console.warn('Failed to load spiderman.glb:', err);
              resolve();
            }
          }
        );
      };

      tryLoad('/models/spiderman.glb', '/src/model/spiderman.glb');
    });
  }

  private loadCar(): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        '/models/car.glb',
        (gltf) => {
          const root = gltf.scene;

          // Configure shadows
          root.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });

          this.carTemplate = root;
          this.isCarLoaded = true;
          this.notify();
          resolve();
        },
        undefined,
        (err) => {
          console.warn('Failed to load car.glb:', err);
          resolve();
        }
      );
    });
  }

  private loadNpc(): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        '/models/npc.glb',
        (gltf) => {
          const root = gltf.scene;

          // Remove lights (e.g. 'Sun' light in the model)
          const lightsToRemove: THREE.Object3D[] = [];
          root.traverse((obj) => {
            if ((obj as THREE.Light).isLight) {
              lightsToRemove.push(obj);
            }
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });
          lightsToRemove.forEach((light) => {
            if (light.parent) light.parent.remove(light);
          });

          // Attach hands as children of the arms so they move together (fixing detached 4-hands bug)
          root.updateMatrixWorld(true);
          const armR = root.getObjectByName('arm_right');
          const handR = root.getObjectByName('hand_right');
          const armL = root.getObjectByName('arm_left');
          const handL = root.getObjectByName('hand_left');
          if (armR && handR) armR.attach(handR);
          if (armL && handL) armL.attach(handL);

          this.npcTemplate = root;
          this.isNpcLoaded = true;
          this.notify();
          resolve();
        },
        undefined,
        (err) => {
          console.warn('Failed to load npc.glb:', err);
          resolve();
        }
      );
    });
  }

  /**
   * Spawns a configured 3D Spider-Man model instance.
   * Model dimensions: natural height ~17.397 units, minY ~ -5.7352.
   * Scaled to target human height ~1.85m.
   */
  public createSpidermanInstance(): SpidermanInstance | null {
    if (!this.spidermanTemplate) return null;

    const wrapper = new THREE.Group();
    wrapper.name = 'SpidermanGLBWrapper';

    // Must clone with SkeletonUtils so the SkinnedMesh attaches to its own cloned skeleton!
    const clone = cloneSkeleton(this.spidermanTemplate) as THREE.Group;

    // Target height: 1.85m
    const targetHeight = 1.85;
    const rawHeight = 17.3971;
    const scale = targetHeight / rawHeight; // ~0.10634
    clone.scale.setScalar(scale);

    // Center bottom: raw model minY is -5.7352 (bottom of feet in model space).
    // The physics position of characterGroup corresponds to the player capsule center (y = +0.9m).
    // To position the feet on the pavement (y = 0.0m) when characterGroup is at y = 0.9m:
    // the feet must be at -0.9m in wrapper space.
    // Scaled model feet are at -5.7352 * scale ≈ -0.61m.
    // Setting clone.position.y = -0.90 - (-5.7352 * scale) ≈ -0.29m places feet precisely at -0.90m.
    const feetOffsetY = -0.90 - (-5.7352 * scale);
    clone.position.set(0, feetOffsetY, 0);

    // Ensure all SkinnedMeshes have frustum culling disabled so they never vanish during movement/anims
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
          m.frustumCulled = false;
        }
      }
    });

    wrapper.add(clone);

    // Flexible bone search matching sanitized names from Three.js GLTFLoader
    const findBone = (candidates: string[]): THREE.Object3D | undefined => {
      for (const name of candidates) {
        const found = clone.getObjectByName(name);
        if (found) return found;
      }
      let matched: THREE.Object3D | undefined;
      clone.traverse((child) => {
        if (!matched && (child as THREE.Bone).isBone) {
          const cleanName = child.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const name of candidates) {
            const cleanCand = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanName === cleanCand) {
              matched = child;
              return;
            }
          }
        }
      });
      return matched;
    };

    const rootBone = findBone(['Root_8', 'Root', 'GLTF_created_0_rootJoint']);
    const torsoBone = findBone(['Torso_5', 'Torso', 'spine']);
    const headBone = findBone(['Head_0', 'Head']);
    const shoulderL = findBone(['ShoulderL_2', 'Shoulder.L_2', 'ShoulderL', 'Shoulder_L']);
    const armL = findBone(['ArmL_1', 'Arm.L_1', 'ArmL', 'Arm_L']);
    const shoulderR = findBone(['ShoulderR_4', 'Shoulder.R_4', 'ShoulderR', 'Shoulder_R']);
    const armR = findBone(['ArmR_3', 'Arm.R_3', 'ArmR', 'Arm_R']);
    const legL = findBone(['LegL_6', 'Leg.L_6', 'LegL', 'Leg_L']);
    const legR = findBone(['LegR_7', 'Leg.R_7', 'LegR', 'Leg_R']);

    // Dedicated web-shooter nozzle anchors positioned precisely at the right and left wrists/palms
    let handR: THREE.Object3D | undefined;
    if (armR) {
      handR = new THREE.Object3D();
      handR.name = 'SpiderMan_Right_WebShooter';
      handR.position.set(1.41, 4.54, 0.75);
      armR.add(handR);
    }

    let handL: THREE.Object3D | undefined;
    if (armL) {
      handL = new THREE.Object3D();
      handL.name = 'SpiderMan_Left_WebShooter';
      handL.position.set(-1.41, 4.54, 0.75);
      armL.add(handL);
    }

    const initialQuats = new Map<string, THREE.Quaternion>();
    const bonePairs = [
      { key: 'root', bone: rootBone },
      { key: 'torso', bone: torsoBone },
      { key: 'head', bone: headBone },
      { key: 'shoulderL', bone: shoulderL },
      { key: 'armL', bone: armL },
      { key: 'shoulderR', bone: shoulderR },
      { key: 'armR', bone: armR },
      { key: 'legL', bone: legL },
      { key: 'legR', bone: legR },
    ];
    bonePairs.forEach(({ key, bone }) => {
      if (bone) {
        initialQuats.set(key, bone.quaternion.clone());
        initialQuats.set(bone.name, bone.quaternion.clone());
      }
    });

    return {
      group: wrapper,
      rootBone,
      torsoBone,
      headBone,
      shoulderL,
      armL,
      shoulderR,
      armR,
      handR,
      handL,
      legL,
      legR,
      initialQuats,
    };
  }

  /**
   * Spawns a configured 3D Car model instance.
   * Model dimensions: natural length ~12.12 along X, height ~5.24 along Y, width ~6.41 along Z.
   * Target length: ~4.6m, width ~2.2m.
   */
  public createCarInstance(type: 'taxi' | 'police' | 'sedan' | 'van'): CarInstance | null {
    if (!this.carTemplate) return null;

    const carGroup = new THREE.Group();
    carGroup.name = `CarGLB_${type}`;

    const clone = this.carTemplate.clone(true);

    // Car target length is 4.7m. Raw X length is 12.12
    const targetLength = type === 'van' ? 5.2 : 4.7;
    const scale = targetLength / 12.12;
    clone.scale.setScalar(scale);

    // Rotate so car front points along +Z
    // In car.glb, length is along X, front/hood is along -X.
    // Rotating around Y by +Math.PI / 2 points front/hood along +Z (fixing backwards driving!)
    clone.rotation.y = Math.PI / 2;

    // Offset so bottom of wheels touches ground (minY is -2.618)
    clone.position.set(0, 2.618 * scale, 0);

    // Apply color tinting to paint material if desired
    const civilianColors = [
      0x0284c7, // Sky Blue
      0xb91c1c, // Crimson Red
      0x475569, // Slate Metallic
      0x111827, // Obsidian Black
      0x059669, // Emerald
      0xf8fafc, // Pearl White
    ];

    let tintColor: number | null = null;
    if (type === 'taxi') {
      tintColor = 0xfacc15; // Yellow Cab
    } else if (type === 'police') {
      tintColor = 0xffffff;
    } else if (type === 'sedan') {
      tintColor = civilianColors[Math.floor(Math.random() * civilianColors.length)];
    }

    if (tintColor !== null) {
      clone.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.material) {
            const originalMat = mesh.material as THREE.MeshStandardMaterial;
            const clonedMat = originalMat.clone();
            if (clonedMat.color) {
              if (type === 'taxi') {
                clonedMat.color.setHex(0xfacc15);
              } else if (type === 'police') {
                clonedMat.color.setHex(0xf8fafc);
              } else if (tintColor) {
                clonedMat.color.setHex(tintColor);
              }
            }
            mesh.material = clonedMat;
          }
        }
      });
    }

    carGroup.add(clone);

    // Headlights (at front +Z)
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff7ed });
    const headGeo = new THREE.BoxGeometry(0.3, 0.12, 0.08);
    for (const hx of [-0.75, 0.75]) {
      const hl = new THREE.Mesh(headGeo, headlightMat);
      hl.position.set(hx, 0.65, 2.36);
      carGroup.add(hl);
    }

    // Taillights / Brake lights (at rear -Z)
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    const tailGeo = new THREE.BoxGeometry(0.32, 0.14, 0.08);
    const taillights: THREE.Mesh[] = [];
    for (const tx of [-0.75, 0.75]) {
      const tl = new THREE.Mesh(tailGeo, taillightMat.clone());
      tl.position.set(tx, 0.65, -2.36);
      carGroup.add(tl);
      taillights.push(tl);
    }

    // Amber Turn Signal Blinkers
    const blinkerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const blinkerGeo = new THREE.BoxGeometry(0.12, 0.1, 0.12);

    const leftBlinkers: THREE.Mesh[] = [];
    // Front left & rear left
    const blF = new THREE.Mesh(blinkerGeo, blinkerMat.clone());
    blF.position.set(-0.95, 0.65, 2.25);
    blF.visible = false;
    carGroup.add(blF);
    leftBlinkers.push(blF);

    const blR = new THREE.Mesh(blinkerGeo, blinkerMat.clone());
    blR.position.set(-0.95, 0.65, -2.25);
    blR.visible = false;
    carGroup.add(blR);
    leftBlinkers.push(blR);

    const rightBlinkers: THREE.Mesh[] = [];
    // Front right & rear right
    const brF = new THREE.Mesh(blinkerGeo, blinkerMat.clone());
    brF.position.set(0.95, 0.65, 2.25);
    brF.visible = false;
    carGroup.add(brF);
    rightBlinkers.push(brF);

    const brR = new THREE.Mesh(blinkerGeo, blinkerMat.clone());
    brR.position.set(0.95, 0.65, -2.25);
    brR.visible = false;
    carGroup.add(brR);
    rightBlinkers.push(brR);

    // If taxi: add a glowing yellow roof sign
    if (type === 'taxi') {
      const signGeo = new THREE.BoxGeometry(0.7, 0.22, 0.32);
      const signMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, 5.24 * scale + 0.1, 0);
      carGroup.add(sign);
    }

    // If police: add flashing red/blue beacons on roof
    let policeBeacons: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;
    const isPolice = type === 'police';
    if (isPolice) {
      const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const blueMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const barGeo = new THREE.BoxGeometry(0.35, 0.18, 0.22);

      const redBeacon = new THREE.Mesh(barGeo, redMat);
      redBeacon.position.set(-0.35, 5.24 * scale + 0.1, 0);
      carGroup.add(redBeacon);

      const blueBeacon = new THREE.Mesh(barGeo, blueMat);
      blueBeacon.position.set(0.35, 5.24 * scale + 0.1, 0);
      carGroup.add(blueBeacon);

      policeBeacons = { red: redBeacon, blue: blueBeacon };
    }

    return { group: carGroup, isPolice, policeBeacons, taillights, leftBlinkers, rightBlinkers };
  }

  /**
   * Spawns a configured 3D NPC pedestrian instance.
   * Model dimensions: natural height ~1.836m.
   */
  public createNpcInstance(): NpcInstance | null {
    if (!this.npcTemplate) return null;

    const pGroup = new THREE.Group();
    pGroup.name = 'PedestrianGLB';

    const clone = this.npcTemplate.clone(true);

    // Height is ~1.836m. Target ~1.75m
    const scale = 1.75 / 1.8356;
    clone.scale.setScalar(scale);

    // Center bottom: raw minY is -0.9178, so offset Y by +0.9178 * scale
    clone.position.set(0, 0.9178 * scale, 0);

    pGroup.add(clone);

    // Locate animated limb parts
    const leftArm = clone.getObjectByName('arm_left') || undefined;
    const rightArm = clone.getObjectByName('arm_right') || undefined;
    const leftLeg = clone.getObjectByName('leg_left') || undefined;
    const rightLeg = clone.getObjectByName('leg_right') || undefined;
    const head = clone.getObjectByName('head') || undefined;

    const handLeft = clone.getObjectByName('hand_left');
    const handRight = clone.getObjectByName('hand_right');
    if (leftArm && handLeft && handLeft.parent !== leftArm) {
      leftArm.attach(handLeft);
    }
    if (rightArm && handRight && handRight.parent !== rightArm) {
      rightArm.attach(handRight);
    }

    // Apply color variations to citizen clothing (shirts & pants)
    const shirtColors = [
      0xef4444, // Red jacket
      0x2563eb, // Cobalt blue
      0x10b981, // Emerald green
      0xf59e0b, // Amber / yellow-orange
      0x8b5cf6, // Violet
      0x06b6d4, // Cyan windbreaker
      0xec4899, // Pink sweater
      0x334155, // Charcoal / slate
      0xf8fafc, // Crisp white
      0xd97706, // Autumn orange
    ];

    const pantsColors = [
      0x1d4ed8, // Classic Blue Jeans
      0x0f172a, // Obsidian Black
      0x334155, // Slate Denim
      0xb45309, // Brown Khaki
      0x475569, // Grey Chinos
      0x1e293b, // Dark Navy
    ];

    const chosenShirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
    const chosenPantsColor = pantsColors[Math.floor(Math.random() * pantsColors.length)];

    const shirtMat = new THREE.MeshStandardMaterial({
      color: chosenShirtColor,
      roughness: 0.35,
      metalness: 0.05,
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: chosenPantsColor,
      roughness: 0.45,
      metalness: 0.05,
    });

    const torsoMesh = clone.getObjectByName('torso_0') as THREE.Mesh | undefined;
    const armRightMesh = clone.getObjectByName('arm_right_0') as THREE.Mesh | undefined;
    const armLeftMesh = clone.getObjectByName('arm_left_0') as THREE.Mesh | undefined;
    if (torsoMesh) torsoMesh.material = shirtMat;
    if (armRightMesh) armRightMesh.material = shirtMat;
    if (armLeftMesh) armLeftMesh.material = shirtMat;

    const pantsMesh = clone.getObjectByName('pants_0') as THREE.Mesh | undefined;
    const legRightMesh = clone.getObjectByName('leg_right_0') as THREE.Mesh | undefined;
    const legLeftMesh = clone.getObjectByName('leg_left_0') as THREE.Mesh | undefined;
    if (pantsMesh) pantsMesh.material = pantsMat;
    if (legRightMesh) legRightMesh.material = pantsMat;
    if (legLeftMesh) legLeftMesh.material = pantsMat;

    return { group: pGroup, leftArm, rightArm, leftLeg, rightLeg, head, rightHand: handRight || undefined };
  }
}

export const modelManager = new ModelManager();
