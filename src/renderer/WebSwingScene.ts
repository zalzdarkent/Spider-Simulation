import * as THREE from 'three';
import { SwingPhysics, PlayerInput } from '../physics/swingPhysics';
import { CityEnvironment, generateCity } from '../city/cityGenerator';
import { PhysicsConfig, TimeOfDay, TelemetryData } from '../types/physics';
import { soundEngine } from '../audio/soundEngine';

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  config: PhysicsConfig;
  timeOfDay: TimeOfDay;
  showVectors: boolean;
  showTrajectory: boolean;
  cameraMode: 'third_person' | 'first_person';
  onRingCollected?: (ringId: number, totalCollected: number) => void;
}

export class WebSwingScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private physics: SwingPhysics;
  private city: CityEnvironment;

  // Camera control
  public cameraMode: 'third_person' | 'first_person' = 'third_person';
  private cameraYaw: number = 0;
  private cameraPitch: number = 0.1;
  private cameraDistance: number = 7.5;
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private baseFOV: number = 68;

  // Character hierarchy
  private characterGroup: THREE.Group;
  private torsoMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;
  private visorMesh!: THREE.Mesh;
  private leftArmGroup!: THREE.Group;
  private rightArmGroup!: THREE.Group;
  private leftLegGroup!: THREE.Group;
  private rightLegGroup!: THREE.Group;

  // Web strand visual
  private webLineMesh: THREE.Line;
  private webAnchorImpactMesh: THREE.Mesh;

  // Targeting raycaster
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  public targetedAnchor: THREE.Vector3 | null = null;
  public targetedBuilding: THREE.Mesh | null = null;
  private targetReticleMesh: THREE.Group;
  public aimAssist: boolean = true;
  public lookSensitivity: number = 0.0035;

  // STEM Visualization
  public showVectors: boolean = false;
  public showTrajectory: boolean = false;
  private tensionArrow: THREE.ArrowHelper;
  private gravityArrow: THREE.ArrowHelper;
  private velocityArrow: THREE.ArrowHelper;
  private netForceArrow: THREE.ArrowHelper;
  private trajectoryLine: THREE.Line;

  // Speed particles
  private speedParticles: THREE.Points;
  private speedParticleCount = 180;

  // Lighting & Sky
  private dirLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemisphereLight!: THREE.HemisphereLight;

  // Ring challenge metrics
  public ringsCollectedCount: number = 0;
  private onRingCollected?: (ringId: number, totalCollected: number) => void;

  // Loop & timing
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 60;
  private lastFpsUpdate: number = 0;

  constructor(private options: SceneOptions) {
    this.physics = new SwingPhysics(options.config);
    this.cameraMode = options.cameraMode;
    this.showVectors = options.showVectors;
    this.showTrajectory = options.showTrajectory;
    this.onRingCollected = options.onRingCollected;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(this.baseFOV, aspect, 0.1, 1200);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Environment & City
    this.city = generateCity(options.timeOfDay);
    this.scene.add(this.city.group);
    this.setupLighting(options.timeOfDay);

    // Character
    this.characterGroup = this.createHeroCharacter();
    this.scene.add(this.characterGroup);

    // Web rope
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(30 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });
    this.webLineMesh = new THREE.Line(lineGeo, lineMat);
    this.webLineMesh.frustumCulled = false;
    this.scene.add(this.webLineMesh);

    // Web impact point
    const impactGeo = new THREE.SphereGeometry(0.6, 12, 12);
    const impactMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
    this.webAnchorImpactMesh = new THREE.Mesh(impactGeo, impactMat);
    this.webAnchorImpactMesh.visible = false;
    this.scene.add(this.webAnchorImpactMesh);

    // Target reticle in 3D space
    this.targetReticleMesh = this.createTargetReticle();
    this.scene.add(this.targetReticleMesh);

    // Force Vector Helpers
    this.tensionArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 5, 0x06b6d4, 1.2, 0.8);
    this.gravityArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 5, 0xfacc15, 1.2, 0.8);
    this.velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 5, 0x22c55e, 1.2, 0.8);
    this.netForceArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 5, 0xf97316, 1.2, 0.8);
    this.scene.add(this.tensionArrow, this.gravityArrow, this.velocityArrow, this.netForceArrow);

    // Trajectory Line
    const trajGeo = new THREE.BufferGeometry();
    const trajMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 1.5,
      gapSize: 0.8,
      linewidth: 2,
    });
    this.trajectoryLine = new THREE.Line(trajGeo, trajMat);
    this.trajectoryLine.frustumCulled = false;
    this.scene.add(this.trajectoryLine);

    // Speed particle stream
    this.speedParticles = this.createSpeedParticles();
    this.scene.add(this.speedParticles);

    // Spawn character in middle of skyline
    this.physics.reset(new THREE.Vector3(0, 75, 40));
  }

  private setupLighting(timeOfDay: TimeOfDay) {
    if (timeOfDay === 'sunset') {
      this.scene.background = new THREE.Color(0x1a162b);
      this.scene.fog = new THREE.FogExp2(0x281e3a, 0.0035);

      this.ambientLight = new THREE.AmbientLight(0xffedd5, 0.45);
      this.hemisphereLight = new THREE.HemisphereLight(0xfdba74, 0x1e1b4b, 0.6);
      this.dirLight = new THREE.DirectionalLight(0xf97316, 2.2);
      this.dirLight.position.set(180, 120, 140);
    } else if (timeOfDay === 'night') {
      this.scene.background = new THREE.Color(0x030712);
      this.scene.fog = new THREE.FogExp2(0x060d1a, 0.004);

      this.ambientLight = new THREE.AmbientLight(0x38bdf8, 0.25);
      this.hemisphereLight = new THREE.HemisphereLight(0x06b6d4, 0x020617, 0.4);
      this.dirLight = new THREE.DirectionalLight(0x60a5fa, 1.2);
      this.dirLight.position.set(100, 150, 100);
    } else if (timeOfDay === 'day') {
      this.scene.background = new THREE.Color(0x7dd3fc);
      this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.002);

      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      this.hemisphereLight = new THREE.HemisphereLight(0x38bdf8, 0x334155, 0.6);
      this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
      this.dirLight.position.set(120, 200, 80);
    } else {
      // Foggy
      this.scene.background = new THREE.Color(0x334155);
      this.scene.fog = new THREE.FogExp2(0x475569, 0.008);

      this.ambientLight = new THREE.AmbientLight(0x94a3b8, 0.5);
      this.hemisphereLight = new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.5);
      this.dirLight = new THREE.DirectionalLight(0xe2e8f0, 1.4);
      this.dirLight.position.set(80, 140, 80);
    }

    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 400;
    const d = 160;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;

    this.scene.add(this.ambientLight, this.hemisphereLight, this.dirLight);
  }

  public setTimeOfDay(timeOfDay: TimeOfDay) {
    this.scene.remove(this.city.group);
    this.scene.remove(this.ambientLight, this.hemisphereLight, this.dirLight);
    this.city = generateCity(timeOfDay);
    this.scene.add(this.city.group);
    this.setupLighting(timeOfDay);
  }

  /**
   * Stylized original Web-Slinger Acrobat Hero character model
   */
  private createHeroCharacter(): THREE.Group {
    const root = new THREE.Group();

    // High-tech materials
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark obsidian carbon weave
      roughness: 0.35,
      metalness: 0.6,
    });
    const suitAccentMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant electric blue suit plates
      roughness: 0.3,
      metalness: 0.7,
    });
    const visorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Luminous cyan eye visor
    });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    this.torsoMesh = new THREE.Mesh(torsoGeo, suitAccentMat);
    this.torsoMesh.position.y = 1.1;
    root.add(this.torsoMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, suitMat);
    this.headMesh.position.set(0, 0.65, 0.05);
    this.torsoMesh.add(this.headMesh);

    // Visor eyes
    const visorGeo = new THREE.BoxGeometry(0.32, 0.09, 0.12);
    this.visorMesh = new THREE.Mesh(visorGeo, visorMat);
    this.visorMesh.position.set(0, 0.02, 0.2);
    this.headMesh.add(this.visorMesh);

    // Left Arm
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.48, 0.35, 0);
    const armGeo = new THREE.BoxGeometry(0.18, 0.75, 0.18);
    const leftArmMesh = new THREE.Mesh(armGeo, suitMat);
    leftArmMesh.position.y = -0.35;
    this.leftArmGroup.add(leftArmMesh);
    this.torsoMesh.add(this.leftArmGroup);

    // Right Arm (Shooter arm)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.48, 0.35, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, suitMat);
    rightArmMesh.position.y = -0.35;
    this.rightArmGroup.add(rightArmMesh);
    this.torsoMesh.add(this.rightArmGroup);

    // Left Leg
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.24, -0.45, 0);
    const legGeo = new THREE.BoxGeometry(0.22, 0.85, 0.22);
    const leftLegMesh = new THREE.Mesh(legGeo, suitAccentMat);
    leftLegMesh.position.y = -0.42;
    this.leftLegGroup.add(leftLegMesh);
    this.torsoMesh.add(this.leftLegGroup);

    // Right Leg
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.24, -0.45, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, suitAccentMat);
    rightLegMesh.position.y = -0.42;
    this.rightLegGroup.add(rightLegMesh);
    this.torsoMesh.add(this.rightLegGroup);

    return root;
  }

  private createTargetReticle(): THREE.Group {
    const group = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.7, 0.85, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    const crossGeo1 = new THREE.PlaneGeometry(0.3, 0.08);
    const cross1 = new THREE.Mesh(crossGeo1, ringMat);
    cross1.position.x = 1.05;
    group.add(cross1);

    const cross2 = new THREE.Mesh(crossGeo1, ringMat);
    cross2.position.x = -1.05;
    group.add(cross2);

    group.visible = false;
    return group;
  }

  private createSpeedParticles(): THREE.Points {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.speedParticleCount * 3);
    for (let i = 0; i < this.speedParticleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 35;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 35;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.65,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  /**
   * Handle mouse / touch drag for camera rotation
   */
  public rotateCamera(deltaX: number, deltaY: number) {
    this.cameraYaw -= deltaX * this.lookSensitivity;
    this.cameraPitch -= deltaY * this.lookSensitivity;

    // Pitch constraints
    const maxPitch = Math.PI / 2 - 0.08;
    const minPitch = -Math.PI / 3;
    this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch));
  }

  /**
   * Keyboard camera rotation (useful for touchpad / keyboard-only users)
   */
  public rotateCameraByKeyboard(deltaYaw: number, deltaPitch: number) {
    this.cameraYaw += deltaYaw;
    this.cameraPitch += deltaPitch;

    const maxPitch = Math.PI / 2 - 0.08;
    const minPitch = -Math.PI / 3;
    this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch));
  }

  public zoomCamera(deltaY: number) {
    this.cameraDistance = Math.max(3.5, Math.min(18.0, this.cameraDistance + deltaY * 0.01));
  }

  public setPhysicsConfig(config: PhysicsConfig) {
    this.physics.config = config;
  }

  public getPhysics(): SwingPhysics {
    return this.physics;
  }

  public resetPosition(spawnPos?: THREE.Vector3) {
    this.physics.reset(spawnPos || new THREE.Vector3(0, 75, 40));
    this.city.resetRings();
    this.ringsCollectedCount = 0;
  }

  /**
   * Raycast from camera center to find attachable building anchor point.
   * With Aim Assist enabled, tests a cone around forward sightline so touchpad users
   * can lock onto building anchors effortlessly without frantic precision swiping.
   */
  public updateTargetRaycast() {
    this.raycaster.far = this.physics.config.maxRopeLength;

    // 1. First test dead-center screen ray
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    let intersects = this.raycaster.intersectObjects(this.city.buildingMeshes, false);

    // 2. If center missed and Aim Assist is enabled, test cone sample offsets
    if (intersects.length === 0 && this.aimAssist) {
      const sampleOffsets: [number, number][] = [
        [0, 0.15],
        [0.18, 0.08],
        [-0.18, 0.08],
        [0.26, 0.18],
        [-0.26, 0.18],
        [0, 0.32],
        [0.35, 0.0],
        [-0.35, 0.0],
        [0, -0.15],
      ];

      for (let i = 0; i < sampleOffsets.length; i++) {
        const [ox, oy] = sampleOffsets[i];
        this.raycaster.setFromCamera(new THREE.Vector2(ox, oy), this.camera);
        const coneHits = this.raycaster.intersectObjects(this.city.buildingMeshes, false);
        if (coneHits.length > 0) {
          intersects = coneHits;
          break;
        }
      }
    }

    if (intersects.length > 0) {
      const hit = intersects[0];
      const hitPoint = hit.point;
      this.targetedAnchor = hitPoint;
      this.targetedBuilding = hit.object as THREE.Mesh;

      this.targetReticleMesh.position.copy(hitPoint);
      if (hit.face) {
        this.targetReticleMesh.lookAt(hitPoint.clone().add(hit.face.normal));
      }
      this.targetReticleMesh.visible = true;
    } else {
      this.targetedAnchor = null;
      this.targetedBuilding = null;
      this.targetReticleMesh.visible = false;
    }
  }

  /**
   * Shoot web towards targeted anchor point
   */
  public triggerWebShoot() {
    if (this.targetedAnchor) {
      this.physics.attachWeb(this.targetedAnchor);
    }
  }

  public triggerWebRelease() {
    this.physics.releaseWeb();
  }

  /**
   * Main simulation frame tick
   */
  public update(time: number, input: PlayerInput): TelemetryData {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = time;
      this.lastFpsUpdate = time;
    }

    const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    // FPS calculation
    this.frameCount++;
    if (time - this.lastFpsUpdate >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (time - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = time;
    }

    // Camera Direction Vectors
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Physics step
    this.physics.update(deltaTime, input, forward, right, this.city.buildings);

    // Audio wind update based on speed
    const currentSpeed = this.physics.velocity.length();
    soundEngine.updateWind(currentSpeed);

    // Character position sync
    this.characterGroup.position.copy(this.physics.position);

    // Procedural Character animation & Posing
    this.animateHeroPosing(deltaTime);

    // Camera follow & collision damping
    this.updateCamera(currentSpeed, deltaTime);

    // Web rope visual geometry update
    this.updateWebRope();

    // Checkpoint ring collisions
    this.checkRingCollisions();
    this.city.updateRings(time * 0.001);

    // Speed particles update
    this.updateSpeedParticles(currentSpeed, forward);

    // Update STEM Force Vectors & Trajectory
    this.updateVisualization();

    // Raycast target check for next web latch
    this.updateTargetRaycast();

    // Current anchor distance reading
    let currentAnchorDist = 0;
    if (this.targetedAnchor) {
      currentAnchorDist = this.physics.position.distanceTo(this.targetedAnchor);
    } else if (this.physics.anchorPoint) {
      currentAnchorDist = this.physics.position.distanceTo(this.physics.anchorPoint);
    }

    return this.physics.getTelemetry(this.fps, this.targetedAnchor !== null, currentAnchorDist);
  }

  private animateHeroPosing(dt: number) {
    const vel = this.physics.velocity;
    const speed = vel.length();

    if (this.physics.isAttached && this.physics.anchorPoint) {
      // Web swinging pose: Face velocity direction, one arm raised toward anchor
      const moveDir = vel.clone().normalize();
      if (speed > 1.5) {
        const targetRot = Math.atan2(moveDir.x, moveDir.z);
        this.characterGroup.rotation.y = THREE.MathUtils.lerp(this.characterGroup.rotation.y, targetRot, 0.2);
        // Bank into turns
        const bankAngle = -this.physics.velocity.dot(new THREE.Vector3(1, 0, 0)) * 0.015;
        this.torsoMesh.rotation.z = THREE.MathUtils.lerp(this.torsoMesh.rotation.z, bankAngle, 0.15);
      }

      // Torso tilt forward
      this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.3, 0.2);

      // Right arm raised toward anchor
      const toAnchor = new THREE.Vector3().subVectors(this.physics.anchorPoint, this.physics.position).normalize();
      this.rightArmGroup.rotation.x = -Math.PI * 0.75;
      this.rightArmGroup.rotation.z = 0.2;

      // Left arm trailing back for balance
      this.leftArmGroup.rotation.x = 0.6;
      this.leftArmGroup.rotation.z = -0.5;

      // Legs swept back
      this.leftLegGroup.rotation.x = 0.5;
      this.rightLegGroup.rotation.x = 0.7;
    } else if (!this.physics.isOnGround && !this.physics.isOnRoof) {
      // Free falling / aerial dive pose
      if (speed > 4) {
        const targetRot = Math.atan2(vel.x, vel.z);
        this.characterGroup.rotation.y = THREE.MathUtils.lerp(this.characterGroup.rotation.y, targetRot, 0.25);
      }

      // Fast dive: aerodynamic sweep
      const divePitch = Math.min(Math.PI * 0.45, Math.max(-0.2, -vel.y * 0.04));
      this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, divePitch, 0.2);
      this.torsoMesh.rotation.z = THREE.MathUtils.lerp(this.torsoMesh.rotation.z, 0, 0.1);

      this.rightArmGroup.rotation.x = 0.8;
      this.rightArmGroup.rotation.z = 0.4;
      this.leftArmGroup.rotation.x = 0.8;
      this.leftArmGroup.rotation.z = -0.4;

      this.leftLegGroup.rotation.x = 0.2;
      this.rightLegGroup.rotation.x = 0.3;
    } else {
      // On ground or roof: standing / running
      this.torsoMesh.rotation.x = 0;
      this.torsoMesh.rotation.z = 0;

      if (speed > 1.0) {
        // Run cycle
        const runCycle = Math.sin(performance.now() * 0.015);
        this.leftLegGroup.rotation.x = runCycle * 0.6;
        this.rightLegGroup.rotation.x = -runCycle * 0.6;
        this.leftArmGroup.rotation.x = -runCycle * 0.6;
        this.rightArmGroup.rotation.x = runCycle * 0.6;
      } else {
        // Idle
        this.leftLegGroup.rotation.x = 0;
        this.rightLegGroup.rotation.x = 0;
        this.leftArmGroup.rotation.x = 0;
        this.rightArmGroup.rotation.x = 0;
      }
    }
  }

  private updateCamera(speed: number, dt: number) {
    const heroPos = this.physics.position;

    // Speed-based dynamic FOV widening
    const speedRatio = Math.min(1.0, speed / 55);
    const targetFOV = this.baseFOV + speedRatio * 20; // 68 up to 88 degrees
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.08);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 'first_person') {
      // First person view: camera placed right at head/visor
      this.camera.position.set(heroPos.x, heroPos.y + 1.6, heroPos.z);
      const lookDist = 10;
      const targetX = heroPos.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * lookDist;
      const targetY = heroPos.y + 1.6 + Math.sin(this.cameraPitch) * lookDist;
      const targetZ = heroPos.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * lookDist;
      this.camera.lookAt(targetX, targetY, targetZ);
      this.characterGroup.visible = false;
      return;
    }

    this.characterGroup.visible = true;

    // Third person chase cam:
    // Calculate ideal camera position based on yaw and pitch
    const horizontalDist = this.cameraDistance * Math.cos(this.cameraPitch);
    const verticalDist = this.cameraDistance * Math.sin(this.cameraPitch) + 1.8;

    const idealCamPos = new THREE.Vector3(
      heroPos.x - Math.sin(this.cameraYaw) * horizontalDist,
      heroPos.y + verticalDist,
      heroPos.z - Math.cos(this.cameraYaw) * horizontalDist
    );

    // Camera wall collision test: Raycast from hero to idealCamPos to prevent wall clipping!
    const heroHead = new THREE.Vector3(heroPos.x, heroPos.y + 1.8, heroPos.z);
    const camRayDir = new THREE.Vector3().subVectors(idealCamPos, heroHead);
    const camDist = camRayDir.length();
    camRayDir.normalize();

    const camRaycaster = new THREE.Raycaster(heroHead, camRayDir, 0.2, camDist);
    const hits = camRaycaster.intersectObjects(this.city.buildingMeshes, false);

    let finalCamPos = idealCamPos;
    if (hits.length > 0) {
      // Pull camera in front of wall with safety margin
      finalCamPos = hits[0].point.clone().sub(camRayDir.clone().multiplyScalar(0.4));
    }

    // Smooth lerp camera position
    this.camera.position.lerp(finalCamPos, Math.min(1.0, 18 * dt));

    // Look slightly ahead of character along trajectory
    const lookTarget = heroPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.cameraTarget.lerp(lookTarget, 0.25);
    this.camera.lookAt(this.cameraTarget);
  }

  private updateWebRope() {
    if (this.physics.isAttached && this.physics.anchorPoint) {
      this.webLineMesh.visible = true;
      this.webAnchorImpactMesh.visible = true;
      this.webAnchorImpactMesh.position.copy(this.physics.anchorPoint);

      // Hero shooter hand position
      const handPos = this.physics.position.clone().add(new THREE.Vector3(0.4, 1.4, 0));
      const anchorPos = this.physics.anchorPoint;

      // Draw 30-segment line with slight catenary sag when moving
      const posAttr = this.webLineMesh.geometry.attributes.position as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;
      const segs = 30;

      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1);
        const px = THREE.MathUtils.lerp(handPos.x, anchorPos.x, t);
        const py = THREE.MathUtils.lerp(handPos.y, anchorPos.y, t);
        const pz = THREE.MathUtils.lerp(handPos.z, anchorPos.z, t);

        // Subtle dynamic curve
        const sag = Math.sin(t * Math.PI) * 0.25;

        array[i * 3] = px;
        array[i * 3 + 1] = py - sag;
        array[i * 3 + 2] = pz;
      }
      posAttr.needsUpdate = true;
    } else {
      this.webLineMesh.visible = false;
      this.webAnchorImpactMesh.visible = false;
    }
  }

  private checkRingCollisions() {
    const playerPos = this.physics.position;
    this.city.checkpointRings.forEach((ring) => {
      if (!ring.collected) {
        const ringPos = new THREE.Vector3(...ring.position);
        const dist = playerPos.distanceTo(ringPos);
        if (dist <= ring.radius + 1.2) {
          const wasCollected = this.city.collectRing(ring.id);
          if (wasCollected) {
            this.ringsCollectedCount++;
            soundEngine.playRingCollect();
            if (this.onRingCollected) {
              this.onRingCollected(ring.id, this.ringsCollectedCount);
            }
          }
        }
      }
    });
  }

  private updateSpeedParticles(speed: number, forward: THREE.Vector3) {
    if (speed < 16) {
      this.speedParticles.visible = false;
      return;
    }
    this.speedParticles.visible = true;
    const heroPos = this.physics.position;
    this.speedParticles.position.copy(heroPos);

    const posAttr = this.speedParticles.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < this.speedParticleCount; i++) {
      // Stream particles backwards relative to camera forward
      array[i * 3 + 2] -= speed * 0.04;
      if (array[i * 3 + 2] < -25) {
        array[i * 3 + 2] = 25;
        array[i * 3] = (Math.random() - 0.5) * 35;
        array[i * 3 + 1] = (Math.random() - 0.5) * 25;
      }
    }
    posAttr.needsUpdate = true;
  }

  private updateVisualization() {
    const show = this.showVectors;
    this.tensionArrow.visible = show && this.physics.isAttached;
    this.gravityArrow.visible = show;
    this.velocityArrow.visible = show;
    this.netForceArrow.visible = show;

    if (show) {
      const pos = this.physics.position;
      const scaleFactor = 0.005; // Scale Newtons to visible meters

      // Tension (Cyan)
      if (this.physics.isAttached && this.physics.tensionVector.lengthSq() > 1) {
        this.tensionArrow.position.copy(pos);
        const tLen = Math.min(18, this.physics.tensionVector.length() * scaleFactor);
        this.tensionArrow.setDirection(this.physics.tensionVector.clone().normalize());
        this.tensionArrow.setLength(tLen, 1.0, 0.6);
      }

      // Gravity (Yellow)
      this.gravityArrow.position.copy(pos);
      this.gravityArrow.setDirection(new THREE.Vector3(0, -1, 0));
      this.gravityArrow.setLength(Math.min(12, this.physics.gravityVector.length() * scaleFactor), 0.8, 0.5);

      // Velocity (Green)
      const speed = this.physics.velocity.length();
      if (speed > 0.5) {
        this.velocityArrow.position.copy(pos);
        this.velocityArrow.setDirection(this.physics.velocity.clone().normalize());
        this.velocityArrow.setLength(Math.min(16, speed * 0.25), 0.9, 0.6);
      }

      // Net Force (Orange)
      if (this.physics.netForceVector.lengthSq() > 1) {
        this.netForceArrow.position.copy(pos);
        const fLen = Math.min(18, this.physics.netForceVector.length() * scaleFactor);
        this.netForceArrow.setDirection(this.physics.netForceVector.clone().normalize());
        this.netForceArrow.setLength(fLen, 1.0, 0.6);
      }
    }

    // Trajectory prediction line
    if (this.showTrajectory && this.physics.predictedTrajectory.length > 1) {
      this.trajectoryLine.visible = true;
      const pts = this.physics.predictedTrajectory;
      this.trajectoryLine.geometry.setFromPoints(pts);
      this.trajectoryLine.computeLineDistances();
    } else {
      this.trajectoryLine.visible = false;
    }
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public destroy() {
    this.renderer.dispose();
  }
}
