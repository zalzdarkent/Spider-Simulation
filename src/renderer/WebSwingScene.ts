import * as THREE from 'three';
import { SwingPhysics, PlayerInput } from '../physics/swingPhysics';
import { CityEnvironment, generateCity } from '../city/cityGenerator';
import { PhysicsConfig, TimeOfDay, TelemetryData } from '../types/physics';
import { soundEngine } from '../audio/soundEngine';
import { modelManager, SpidermanInstance } from './modelManager';

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
  private currentCamDistance: number = 7.5;
  private smoothedHeroPos: THREE.Vector3 = new THREE.Vector3(0, 75, 40);
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private baseFOV: number = 68;

  // Dynamic camera sway & rear-view
  private cameraSwayOffset: THREE.Vector3 = new THREE.Vector3();
  private currentCameraRoll: number = 0;
  private isLookBehindActive: boolean = false;
  private rearLookYaw: number = 0;
  private swingBreatheTimer: number = 0;

  // Character hierarchy
  private characterGroup: THREE.Group;
  private spidermanInstance?: SpidermanInstance;
  private isGlbHero: boolean = false;
  private proceduralHeroGroup?: THREE.Group;
  private torsoMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;
  private visorMesh!: THREE.Mesh;
  private leftArmGroup!: THREE.Group;
  private leftForearmGroup!: THREE.Group;
  private rightArmGroup!: THREE.Group;
  private rightForearmGroup!: THREE.Group;
  private rightNozzleMesh!: THREE.Mesh;
  private leftLegGroup!: THREE.Group;
  private leftCalfGroup!: THREE.Group;
  private rightLegGroup!: THREE.Group;
  private rightCalfGroup!: THREE.Group;

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
  public invertY: boolean = false;
  private runCycleTime: number = 0;

  // STEM Visualization
  public showVectors: boolean = false;
  public showTrajectory: boolean = false;
  private tensionArrow: THREE.ArrowHelper;
  private gravityArrow: THREE.ArrowHelper;
  private velocityArrow: THREE.ArrowHelper;
  private netForceArrow: THREE.ArrowHelper;
  private trajectoryLine: THREE.Line;

  // Smoothed bone target rotations for high-poly Spider-Man GLB model
  private spidermanPose = {
    torsoX: -0.04,
    torsoY: 0,
    torsoZ: 0,
    headX: 0,
    headY: 0,
    armLX: 0.05,
    armLZ: 0.05,
    armRX: 0.05,
    armRZ: -0.05,
    legLX: 0.05,
    legLZ: -0.05,
    legRX: -0.05,
    legRZ: 0.05,
    rootY: -0.88,
  };

  // Speed particles
  private speedParticles: THREE.Points;
  private speedParticleCount = 180;

  // Ground Landing Shockwave
  private landingShockwave?: THREE.Mesh;
  private landingShockwaveTimer = 0;
  private wasAirborne = false;
  private prevVerticalSpeed = 0;

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

    this.tryUpgradeToSpidermanGLB();
    modelManager.onModelsLoaded(() => {
      this.tryUpgradeToSpidermanGLB();
    });

    // Web rope (high-tensile spun silk)
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(30 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf8fafc,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });
    this.webLineMesh = new THREE.Line(lineGeo, lineMat);
    this.webLineMesh.frustumCulled = false;
    this.scene.add(this.webLineMesh);

    // Web impact point (anchored web node)
    const impactGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const impactMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
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
  /**
   * High-Definition Procedural Spider-Man Suit Texture Generator
   */
  private createSpiderManTextures() {
    // 1. Scarlet Red Spider Webbing Texture (512x512)
    const redCanvas = document.createElement('canvas');
    redCanvas.width = 512;
    redCanvas.height = 512;
    const rCtx = redCanvas.getContext('2d')!;

    // Rich scarlet red gradient
    const redGrad = rCtx.createLinearGradient(0, 0, 512, 512);
    redGrad.addColorStop(0, '#e11d48');
    redGrad.addColorStop(0.5, '#be123c');
    redGrad.addColorStop(1, '#9f1239');
    rCtx.fillStyle = redGrad;
    rCtx.fillRect(0, 0, 512, 512);

    // Micro carbon-fiber suit weave
    rCtx.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < 512; y += 4) {
      for (let x = 0; x < 512; x += 4) {
        if ((x + y) % 8 === 0) rCtx.fillRect(x, y, 2, 2);
      }
    }

    // Spider web lines: Radiating spokes & scalloped concentric arcs
    rCtx.strokeStyle = 'rgba(15, 23, 42, 0.82)';
    rCtx.lineWidth = 3.5;
    rCtx.lineCap = 'round';

    const cx = 256;
    const cy = 256;
    const spokes = 12;
    for (let i = 0; i < spokes; i++) {
      const angle = (i * Math.PI * 2) / spokes;
      rCtx.beginPath();
      rCtx.moveTo(cx, cy);
      rCtx.lineTo(cx + Math.cos(angle) * 360, cy + Math.sin(angle) * 360);
      rCtx.stroke();
    }

    for (let r = 45; r <= 320; r += 45) {
      for (let i = 0; i < spokes; i++) {
        const a1 = (i * Math.PI * 2) / spokes;
        const a2 = ((i + 1) * Math.PI * 2) / spokes;
        const p1x = cx + Math.cos(a1) * r;
        const p1y = cy + Math.sin(a1) * r;
        const p2x = cx + Math.cos(a2) * r;
        const p2y = cy + Math.sin(a2) * r;
        const midAngle = (a1 + a2) / 2;
        const sag = r * 0.88;
        const cpx = cx + Math.cos(midAngle) * sag;
        const cpy = cy + Math.sin(midAngle) * sag;

        rCtx.beginPath();
        rCtx.moveTo(p1x, p1y);
        rCtx.quadraticCurveTo(cpx, cpy, p2x, p2y);
        rCtx.stroke();
      }
    }

    const redWebMap = new THREE.CanvasTexture(redCanvas);
    redWebMap.wrapS = THREE.RepeatWrapping;
    redWebMap.wrapT = THREE.RepeatWrapping;
    redWebMap.repeat.set(2, 2);

    // 2. Cobalt / Navy Athletic Fabric Texture (256x256)
    const blueCanvas = document.createElement('canvas');
    blueCanvas.width = 256;
    blueCanvas.height = 256;
    const bCtx = blueCanvas.getContext('2d')!;

    const blueGrad = bCtx.createLinearGradient(0, 0, 256, 256);
    blueGrad.addColorStop(0, '#1d4ed8');
    blueGrad.addColorStop(0.5, '#1e3a8a');
    blueGrad.addColorStop(1, '#0f172a');
    bCtx.fillStyle = blueGrad;
    bCtx.fillRect(0, 0, 256, 256);

    // Subtle athletic hexagon weave
    bCtx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 256; y += 6) {
      for (let x = 0; x < 256; x += 6) {
        if ((x ^ y) % 12 === 0) bCtx.fillRect(x, y, 3, 3);
      }
    }
    const blueFabricMap = new THREE.CanvasTexture(blueCanvas);
    blueFabricMap.wrapS = THREE.RepeatWrapping;
    blueFabricMap.wrapT = THREE.RepeatWrapping;
    blueFabricMap.repeat.set(3, 3);

    // 3. Chest Spider Emblem (Black spider logo with angled legs)
    const chestCanvas = document.createElement('canvas');
    chestCanvas.width = 512;
    chestCanvas.height = 512;
    const cCtx = chestCanvas.getContext('2d')!;
    cCtx.clearRect(0, 0, 512, 512);

    cCtx.fillStyle = '#0f172a';
    cCtx.strokeStyle = '#020617';
    cCtx.lineCap = 'round';
    cCtx.lineJoin = 'round';

    // Body
    cCtx.beginPath();
    cCtx.ellipse(256, 230, 16, 24, 0, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.beginPath();
    cCtx.ellipse(256, 280, 22, 38, 0, 0, Math.PI * 2);
    cCtx.fill();

    // 8 Angled legs
    const legs = [
      { x1: 250, y1: 220, x2: 170, y2: 150, x3: 130, y3: 100 },
      { x1: 262, y1: 220, x2: 342, y2: 150, x3: 382, y3: 100 },
      { x1: 248, y1: 235, x2: 150, y2: 200, x3: 110, y3: 180 },
      { x1: 264, y1: 235, x2: 362, y2: 200, x3: 402, y3: 180 },
      { x1: 248, y1: 255, x2: 160, y2: 300, x3: 130, y3: 380 },
      { x1: 264, y1: 255, x2: 352, y2: 300, x3: 382, y3: 380 },
      { x1: 250, y1: 275, x2: 190, y2: 360, x3: 170, y3: 440 },
      { x1: 262, y1: 275, x2: 322, y2: 360, x3: 342, y3: 440 },
    ];
    legs.forEach((leg) => {
      cCtx.beginPath();
      cCtx.moveTo(leg.x1, leg.y1);
      cCtx.lineTo(leg.x2, leg.y2);
      cCtx.lineTo(leg.x3, leg.y3);
      cCtx.lineWidth = 14;
      cCtx.stroke();
    });
    const chestEmblemMap = new THREE.CanvasTexture(chestCanvas);

    // 4. Back Spider Emblem (Bold scarlet red spider)
    const backCanvas = document.createElement('canvas');
    backCanvas.width = 512;
    backCanvas.height = 512;
    const bkCtx = backCanvas.getContext('2d')!;
    bkCtx.clearRect(0, 0, 512, 512);

    bkCtx.fillStyle = '#e11d48';
    bkCtx.strokeStyle = '#be123c';
    bkCtx.lineWidth = 16;
    bkCtx.lineCap = 'round';
    bkCtx.lineJoin = 'round';

    bkCtx.beginPath();
    bkCtx.ellipse(256, 260, 42, 60, 0, 0, Math.PI * 2);
    bkCtx.fill();

    const backLegs = [
      { x1: 235, y1: 230, x2: 140, y2: 140, x3: 110, y3: 110 },
      { x1: 277, y1: 230, x2: 372, y2: 140, x3: 402, y3: 110 },
      { x1: 230, y1: 250, x2: 120, y2: 220, x3: 90, y3: 220 },
      { x1: 282, y1: 250, x2: 392, y2: 220, x3: 422, y3: 220 },
      { x1: 230, y1: 270, x2: 130, y2: 320, x3: 110, y3: 390 },
      { x1: 282, y1: 270, x2: 382, y2: 320, x3: 402, y3: 390 },
      { x1: 235, y1: 290, x2: 170, y2: 380, x3: 160, y3: 430 },
      { x1: 277, y1: 290, x2: 342, y2: 380, x3: 352, y3: 430 },
    ];
    backLegs.forEach((leg) => {
      bkCtx.beginPath();
      bkCtx.moveTo(leg.x1, leg.y1);
      bkCtx.lineTo(leg.x2, leg.y2);
      bkCtx.lineTo(leg.x3, leg.y3);
      bkCtx.stroke();
    });
    const backEmblemMap = new THREE.CanvasTexture(backCanvas);

    return { redWebMap, blueFabricMap, chestEmblemMap, backEmblemMap };
  }

  /**
   * Ultra-detailed, High-Definition Spider-Man Hero Model
   */
  private createHeroCharacter(): THREE.Group {
    const root = new THREE.Group();
    const textures = this.createSpiderManTextures();

    // High-tech materials
    const redWebMat = new THREE.MeshStandardMaterial({
      map: textures.redWebMap,
      roughness: 0.38,
      metalness: 0.22,
    });
    const blueFabricMat = new THREE.MeshStandardMaterial({
      map: textures.blueFabricMap,
      roughness: 0.42,
      metalness: 0.28,
    });
    const blackTrimMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.25,
      metalness: 0.5,
    });
    const silverShooterMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.88,
    });
    const lensGlassMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.12,
      metalness: 0.35,
    });
    const nozzleGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    // -------------------------------------------------------------
    // TORSO & UPPER BODY
    // -------------------------------------------------------------
    // Red webbed central chest block directly attached to character root
    const chestGeo = new THREE.BoxGeometry(0.56, 0.9, 0.42);
    this.torsoMesh = new THREE.Mesh(chestGeo, redWebMat);
    this.torsoMesh.position.set(0, 0.42, 0);

    this.proceduralHeroGroup = new THREE.Group();
    this.proceduralHeroGroup.name = 'ProceduralHeroFallback';
    this.proceduralHeroGroup.add(this.torsoMesh);
    root.add(this.proceduralHeroGroup);

    // Blue athletic side flank panels (left & right)
    const sideGeo = new THREE.BoxGeometry(0.09, 0.84, 0.4);
    const leftSide = new THREE.Mesh(sideGeo, blueFabricMat);
    leftSide.position.set(-0.31, 0, 0);
    this.torsoMesh.add(leftSide);

    const rightSide = new THREE.Mesh(sideGeo, blueFabricMat);
    rightSide.position.set(0.31, 0, 0);
    this.torsoMesh.add(rightSide);

    // Chest spider emblem decal
    const emblemGeo = new THREE.PlaneGeometry(0.44, 0.44);
    const chestEmblemMat = new THREE.MeshBasicMaterial({
      map: textures.chestEmblemMap,
      transparent: true,
      depthWrite: false,
    });
    const chestEmblem = new THREE.Mesh(emblemGeo, chestEmblemMat);
    chestEmblem.position.set(0, 0.08, 0.215);
    this.torsoMesh.add(chestEmblem);

    // Back spider emblem decal
    const backEmblemMat = new THREE.MeshBasicMaterial({
      map: textures.backEmblemMap,
      transparent: true,
      depthWrite: false,
    });
    const backEmblem = new THREE.Mesh(emblemGeo, backEmblemMat);
    backEmblem.position.set(0, 0.08, -0.215);
    backEmblem.rotation.y = Math.PI;
    this.torsoMesh.add(backEmblem);

    // Utility belt with silver web canisters
    const beltGeo = new THREE.BoxGeometry(0.7, 0.1, 0.44);
    const belt = new THREE.Mesh(beltGeo, redWebMat);
    belt.position.y = -0.4;
    this.torsoMesh.add(belt);

    const cartGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.09, 8);
    for (const cx of [-0.36, -0.32, 0.32, 0.36]) {
      const cart = new THREE.Mesh(cartGeo, silverShooterMat);
      cart.position.set(cx, -0.4, 0.08);
      cart.rotation.z = Math.PI / 2;
      this.torsoMesh.add(cart);
    }

    // -------------------------------------------------------------
    // HEAD & SPIDER-MAN MASK
    // -------------------------------------------------------------
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), redWebMat);
    this.headMesh.scale.set(1.0, 1.14, 1.06);
    this.headMesh.position.set(0, 0.65, 0.04);
    this.torsoMesh.add(this.headMesh);

    // Iconic Spider-Man Angled Eye Lenses
    const eyeRimGeo = new THREE.BoxGeometry(0.14, 0.11, 0.04);
    const eyeLensGeo = new THREE.PlaneGeometry(0.12, 0.09);

    // Left eye
    const leftEyeGroup = new THREE.Group();
    leftEyeGroup.position.set(-0.095, 0.035, 0.22);
    leftEyeGroup.rotation.set(0, 0.22, -0.12);
    const leftRim = new THREE.Mesh(eyeRimGeo, blackTrimMat);
    const leftLens = new THREE.Mesh(eyeLensGeo, lensGlassMat);
    leftLens.position.z = 0.022;
    leftEyeGroup.add(leftRim, leftLens);
    this.headMesh.add(leftEyeGroup);

    // Right eye
    const rightEyeGroup = new THREE.Group();
    rightEyeGroup.position.set(0.095, 0.035, 0.22);
    rightEyeGroup.rotation.set(0, -0.22, 0.12);
    const rightRim = new THREE.Mesh(eyeRimGeo, blackTrimMat);
    const rightLens = new THREE.Mesh(eyeLensGeo, lensGlassMat);
    rightLens.position.z = 0.022;
    rightEyeGroup.add(rightRim, rightLens);
    this.headMesh.add(rightEyeGroup);

    this.visorMesh = rightLens; // keep reference for consistency

    // -------------------------------------------------------------
    // ARMS & ARTICULATED ELBOW FOREARMS & WEB-SHOOTERS
    // -------------------------------------------------------------
    const shoulderGeo = new THREE.SphereGeometry(0.13, 16, 16);
    const upperArmGeo = new THREE.CylinderGeometry(0.09, 0.082, 0.34, 12);
    const elbowJointGeo = new THREE.SphereGeometry(0.082, 12, 12);
    const gauntletGeo = new THREE.CylinderGeometry(0.086, 0.076, 0.24, 12);
    const bracerGeo = new THREE.CylinderGeometry(0.092, 0.092, 0.09, 12);
    const nozzleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.05, 8);
    const handGeo = new THREE.BoxGeometry(0.1, 0.16, 0.08);

    // Left Arm (Shoulder -> Upper Arm -> Forearm)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.48, 0.35, 0);

    const leftShoulder = new THREE.Mesh(shoulderGeo, redWebMat);
    const leftUpperArm = new THREE.Mesh(upperArmGeo, blueFabricMat);
    leftUpperArm.position.y = -0.17;

    this.leftForearmGroup = new THREE.Group();
    this.leftForearmGroup.position.set(0, -0.34, 0);

    const leftElbow = new THREE.Mesh(elbowJointGeo, redWebMat);
    const leftGauntlet = new THREE.Mesh(gauntletGeo, redWebMat);
    leftGauntlet.position.y = -0.12;
    const leftBracer = new THREE.Mesh(bracerGeo, silverShooterMat);
    leftBracer.position.y = -0.22;
    const leftNozzle = new THREE.Mesh(nozzleGeo, nozzleGlowMat);
    leftNozzle.position.set(0, -0.23, 0.065);
    leftNozzle.rotation.x = Math.PI / 2;
    const leftHand = new THREE.Mesh(handGeo, redWebMat);
    leftHand.position.y = -0.32;

    this.leftForearmGroup.add(leftElbow, leftGauntlet, leftBracer, leftNozzle, leftHand);
    this.leftArmGroup.add(leftShoulder, leftUpperArm, this.leftForearmGroup);
    this.torsoMesh.add(this.leftArmGroup);

    // Right Arm (Web-Slinger Arm: Shoulder -> Upper Arm -> Forearm)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.48, 0.35, 0);

    const rightShoulder = new THREE.Mesh(shoulderGeo, redWebMat);
    const rightUpperArm = new THREE.Mesh(upperArmGeo, blueFabricMat);
    rightUpperArm.position.y = -0.17;

    this.rightForearmGroup = new THREE.Group();
    this.rightForearmGroup.position.set(0, -0.34, 0);

    const rightElbow = new THREE.Mesh(elbowJointGeo, redWebMat);
    const rightGauntlet = new THREE.Mesh(gauntletGeo, redWebMat);
    rightGauntlet.position.y = -0.12;
    const rightBracer = new THREE.Mesh(bracerGeo, silverShooterMat);
    rightBracer.position.y = -0.22;
    this.rightNozzleMesh = new THREE.Mesh(nozzleGeo, nozzleGlowMat);
    this.rightNozzleMesh.position.set(0, -0.23, 0.065);
    this.rightNozzleMesh.rotation.x = Math.PI / 2;
    const rightHand = new THREE.Mesh(handGeo, redWebMat);
    rightHand.position.y = -0.32;

    this.rightForearmGroup.add(rightElbow, rightGauntlet, rightBracer, this.rightNozzleMesh, rightHand);
    this.rightArmGroup.add(rightShoulder, rightUpperArm, this.rightForearmGroup);
    this.torsoMesh.add(this.rightArmGroup);

    // -------------------------------------------------------------
    // LEGS & ARTICULATED KNEE JOINTS & BOOTS (Calibrated flush with ground level y=0.00)
    // -------------------------------------------------------------
    const thighGeo = new THREE.CylinderGeometry(0.125, 0.105, 0.40, 12);
    const hipJointGeo = new THREE.SphereGeometry(0.115, 12, 12);
    const kneeJointGeo = new THREE.BoxGeometry(0.16, 0.13, 0.14);
    const calfGeo = new THREE.CylinderGeometry(0.105, 0.09, 0.34, 12);
    const bootCuffGeo = new THREE.CylinderGeometry(0.102, 0.095, 0.08, 12);
    const footGeo = new THREE.BoxGeometry(0.15, 0.1, 0.28);

    // Left Leg (Hip -> Thigh -> Calf & Foot)
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.24, -0.42, 0);

    const leftHip = new THREE.Mesh(hipJointGeo, blueFabricMat);
    const leftThigh = new THREE.Mesh(thighGeo, blueFabricMat);
    leftThigh.position.y = -0.20;

    this.leftCalfGroup = new THREE.Group();
    this.leftCalfGroup.position.set(0, -0.40, 0);

    const leftKnee = new THREE.Mesh(kneeJointGeo, redWebMat);
    leftKnee.position.set(0, 0, 0.035);
    const leftCalf = new THREE.Mesh(calfGeo, redWebMat);
    leftCalf.position.y = -0.17;
    const leftCuff = new THREE.Mesh(bootCuffGeo, blackTrimMat);
    leftCuff.position.y = -0.32;
    const leftFoot = new THREE.Mesh(footGeo, blackTrimMat);
    leftFoot.position.set(0, -0.45, 0.06);

    this.leftCalfGroup.add(leftKnee, leftCalf, leftCuff, leftFoot);
    this.leftLegGroup.add(leftHip, leftThigh, this.leftCalfGroup);
    this.torsoMesh.add(this.leftLegGroup);

    // Right Leg (Hip -> Thigh -> Calf & Foot)
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.24, -0.42, 0);

    const rightHip = new THREE.Mesh(hipJointGeo, blueFabricMat);
    const rightThigh = new THREE.Mesh(thighGeo, blueFabricMat);
    rightThigh.position.y = -0.20;

    this.rightCalfGroup = new THREE.Group();
    this.rightCalfGroup.position.set(0, -0.40, 0);

    const rightKnee = new THREE.Mesh(kneeJointGeo, redWebMat);
    rightKnee.position.set(0, 0, 0.035);
    const rightCalf = new THREE.Mesh(calfGeo, redWebMat);
    rightCalf.position.y = -0.17;
    const rightCuff = new THREE.Mesh(bootCuffGeo, blackTrimMat);
    rightCuff.position.y = -0.32;
    const rightFoot = new THREE.Mesh(footGeo, blackTrimMat);
    rightFoot.position.set(0, -0.45, 0.06);

    this.rightCalfGroup.add(rightKnee, rightCalf, rightCuff, rightFoot);
    this.rightLegGroup.add(rightHip, rightThigh, this.rightCalfGroup);
    this.torsoMesh.add(this.rightLegGroup);

    return root;
  }

  /**
   * Upgrades the active character to the high-poly 3D Spider-Man GLB model
   */
  private tryUpgradeToSpidermanGLB() {
    if (this.isGlbHero) return;
    const inst = modelManager.createSpidermanInstance();
    if (inst) {
      if (this.proceduralHeroGroup) {
        this.proceduralHeroGroup.visible = false;
      }
      this.spidermanInstance = inst;
      this.characterGroup.add(inst.group);
      inst.group.visible = true;
      this.isGlbHero = true;
    }
  }

  /**
   * Applies bone rotation delta relative to bind pose
   */
  private applyBoneRot(
    bone: THREE.Object3D | undefined,
    keyOrName: string,
    rotX: number,
    rotY: number = 0,
    rotZ: number = 0
  ) {
    if (!bone || !this.spidermanInstance) return;
    const initial =
      this.spidermanInstance.initialQuats.get(keyOrName) ||
      this.spidermanInstance.initialQuats.get(bone.name);
    if (!initial) return;
    const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
    // Local rotation multiplication relative to bind pose
    bone.quaternion.copy(initial).multiply(delta);
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
    const yFactor = this.invertY ? -1 : 1;
    this.cameraYaw -= deltaX * this.lookSensitivity;
    this.cameraPitch -= deltaY * this.lookSensitivity * yFactor;

    // Pitch constraints: ~65 deg up, ~60 deg down
    const maxPitch = Math.PI / 2.8;
    const minPitch = -Math.PI / 2.8;
    this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch));
  }

  /**
   * Keyboard camera rotation (useful for touchpad / keyboard-only users)
   */
  public rotateCameraByKeyboard(deltaYaw: number, deltaPitch: number) {
    const yFactor = this.invertY ? -1 : 1;
    this.cameraYaw += deltaYaw;
    this.cameraPitch += deltaPitch * yFactor;

    const maxPitch = Math.PI / 2.8;
    const minPitch = -Math.PI / 2.8;
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
    this.smoothedHeroPos.copy(this.physics.position);
    this.currentCamDistance = this.cameraDistance;
    this.cameraSwayOffset.set(0, 0, 0);
    this.currentCameraRoll = 0;
    this.rearLookYaw = 0;
    this.isLookBehindActive = false;
    this.city.resetRings();
    this.ringsCollectedCount = 0;
  }

  public setLookBehind(active: boolean) {
    this.isLookBehindActive = active;
  }

  public isLookingBehind(): boolean {
    return this.isLookBehindActive;
  }

  public toggleLookBehind(): boolean {
    this.isLookBehindActive = !this.isLookBehindActive;
    return this.isLookBehindActive;
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

  private triggerLandingShockwave(pos: THREE.Vector3) {
    if (!this.landingShockwave) {
      const geo = new THREE.RingGeometry(0.3, 0.6, 32);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      this.landingShockwave = new THREE.Mesh(geo, mat);
      this.scene.add(this.landingShockwave);
    }
    this.landingShockwave.position.set(pos.x, pos.y + 0.05, pos.z);
    this.landingShockwave.scale.set(1, 1, 1);
    this.landingShockwave.visible = true;
    (this.landingShockwave.material as THREE.MeshBasicMaterial).opacity = 0.85;
    this.landingShockwaveTimer = 0.35;
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

    // Movement heading vectors (always relative to player's primary camera yaw so look-behind doesn't invert controls)
    const forward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Physics step
    this.physics.update(deltaTime, input, forward, right, this.city.buildings, this.city.obstacles);

    // Audio wind update based on speed
    const currentSpeed = this.physics.velocity.length();
    soundEngine.updateWind(currentSpeed);

    // Auto-upgrade to Spider-Man GLB model as soon as loaded
    if (!this.isGlbHero && modelManager.isSpidermanLoaded) {
      this.tryUpgradeToSpidermanGLB();
    }

    // Character position sync
    this.characterGroup.position.copy(this.physics.position);

    // Landing Impact Shockwave Detection
    const isGroundedNow = this.physics.isOnGround || this.physics.isOnRoof;
    if (this.wasAirborne && isGroundedNow && this.prevVerticalSpeed < -10.0) {
      this.triggerLandingShockwave(this.physics.position);
      soundEngine.playLanding();
    }
    this.wasAirborne = !isGroundedNow;
    this.prevVerticalSpeed = this.physics.velocity.y;

    if (this.landingShockwave && this.landingShockwaveTimer > 0) {
      this.landingShockwaveTimer -= deltaTime;
      const progress = 1 - this.landingShockwaveTimer / 0.35;
      const ringScale = 1.0 + progress * 5.0;
      this.landingShockwave.scale.set(ringScale, ringScale, 1);
      (this.landingShockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - progress));
      if (this.landingShockwaveTimer <= 0) {
        this.landingShockwave.visible = false;
      }
    }

    // Procedural Character animation & Posing (locomotion, facing, banking, swinging)
    this.animateHeroPosing(deltaTime, input, forward, right);

    // Camera follow & collision damping
    this.updateCamera(currentSpeed, deltaTime);

    // Web rope visual geometry update
    this.updateWebRope();

    // Checkpoint ring collisions
    this.checkRingCollisions();

    // City life update (moving traffic, animated pedestrian NPCs, and ring pulses)
    if (this.city.update) {
      this.city.update(deltaTime, time * 0.001, this.physics.position);
    } else {
      this.city.updateRings(time * 0.001);
    }

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

  /**
   * Smoothly rotates character model towards target yaw angle using the shortest angular path.
   * Returns the signed angular difference (useful for turn banking/leaning).
   */
  private rotateCharacterFacing(targetYaw: number, stepFraction: number): number {
    let diff = targetYaw - this.characterGroup.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const applied = diff * THREE.MathUtils.clamp(stepFraction, 0, 1);
    this.characterGroup.rotation.y += applied;
    return diff;
  }

  private animateHeroPosing(
    dt: number,
    input: PlayerInput,
    forward: THREE.Vector3,
    right: THREE.Vector3
  ) {
    const vel = this.physics.velocity;
    const horizSpeed = Math.hypot(vel.x, vel.z);

    // Compute intended movement direction vector from keyboard/touchpad input in camera space
    const moveInput = new THREE.Vector3();
    if (input.forward) moveInput.add(forward);
    if (input.backward) moveInput.sub(forward);
    if (input.right) moveInput.add(right);
    if (input.left) moveInput.sub(right);

    const hasInput = moveInput.lengthSq() > 0.001;
    if (hasInput) {
      moveInput.normalize();
    }

    const isAttached = this.physics.isAttached && Boolean(this.physics.anchorPoint);
    const isGrounded = this.physics.isOnGround || this.physics.isOnRoof;
    const isClimbing = this.physics.isClimbing;
    const isSprinting = Boolean(input.sprint || input.reelIn || (hasInput && horizSpeed > 14));

    // Target bone rotations tailored specifically for the Spider-Man GLB model rig
    let targetTorsoX = -0.04;
    let targetTorsoY = 0;
    let targetTorsoZ = 0;
    let targetHeadX = 0;
    let targetHeadY = 0;
    let targetArmLX = 0.05;
    let targetArmLZ = 0.05;
    let targetArmRX = 0.05;
    let targetArmRZ = -0.05;
    let targetLegLX = 0.05;
    let targetLegLZ = -0.05;
    let targetLegRX = -0.05;
    let targetLegRZ = 0.05;
    let targetRootY = -0.88;

    if (isClimbing) {
      // -------------------------------------------------------------
      // STATE 0: WALL CLIMBING (Spider-Man's iconic wall-crawl pose)
      // -------------------------------------------------------------
      // Face the wall
      const wallN = this.physics.wallNormal;
      if (wallN.lengthSq() > 0.01) {
        const climbYaw = Math.atan2(-wallN.x, -wallN.z);
        this.rotateCharacterFacing(climbYaw, 20.0 * dt);
      }

      // Wall-crawl body: lean into wall, slight forward crouch
      this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.55, 0.3);
      this.torsoMesh.rotation.y = THREE.MathUtils.lerp(this.torsoMesh.rotation.y, 0, 0.2);
      this.torsoMesh.rotation.z = THREE.MathUtils.lerp(this.torsoMesh.rotation.z, 0, 0.2);
      this.torsoMesh.position.y = THREE.MathUtils.lerp(this.torsoMesh.position.y, 0.3, 0.3);

      const climbCycle = Math.sin(performance.now() * 0.005) * (isSprinting ? 1.4 : 0.9);
      const climbCycleSlow = Math.sin(performance.now() * 0.004);

      // Spider-Man GLB model: arms reach forward and grip the wall
      targetTorsoX = -0.45;
      targetTorsoY = 0;
      targetTorsoZ = 0;
      targetHeadX = 0.55;
      targetHeadY = 0;
      targetArmLX = 0.95 + climbCycle * 0.25;
      targetArmLZ = 0.35;
      targetArmRX = 0.95 - climbCycle * 0.25;
      targetArmRZ = -0.35;
      targetLegLX = -0.45 - climbCycle * 0.30;
      targetLegLZ = -0.30;
      targetLegRX = -0.45 + climbCycle * 0.30;
      targetLegRZ = 0.30;
      targetRootY = -0.92;

      // Fallback procedural hero posing
      this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, -1.1 + climbCycle * 0.3, 0.3);
      this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, -1.1 - climbCycle * 0.3, 0.3);
      this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, -0.95, 0.3);
      this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, 0.95, 0.3);
      this.leftForearmGroup.rotation.x = THREE.MathUtils.lerp(this.leftForearmGroup.rotation.x, -0.35 + climbCycle * 0.2, 0.3);
      this.rightForearmGroup.rotation.x = THREE.MathUtils.lerp(this.rightForearmGroup.rotation.x, -0.35 - climbCycle * 0.2, 0.3);
      this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, -0.65 + climbCycleSlow * 0.4, 0.3);
      this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, -0.65 - climbCycleSlow * 0.4, 0.3);
      this.leftLegGroup.rotation.z = THREE.MathUtils.lerp(this.leftLegGroup.rotation.z, -0.55, 0.3);
      this.rightLegGroup.rotation.z = THREE.MathUtils.lerp(this.rightLegGroup.rotation.z, 0.55, 0.3);
      this.leftCalfGroup.rotation.x = THREE.MathUtils.lerp(this.leftCalfGroup.rotation.x, 0.80, 0.3);
      this.rightCalfGroup.rotation.x = THREE.MathUtils.lerp(this.rightCalfGroup.rotation.x, 0.80, 0.3);
      this.headMesh.rotation.x = THREE.MathUtils.lerp(this.headMesh.rotation.x, 0.45, 0.3);
      this.headMesh.rotation.y = THREE.MathUtils.lerp(this.headMesh.rotation.y, 0, 0.2);

    } else if (isAttached && this.physics.anchorPoint) {
      // -------------------------------------------------------------
      // STATE 1: WEB SWINGING (Dynamic Acrobatics & Fluid Pendulum)
      // -------------------------------------------------------------
      // Align character facing smoothly with horizontal velocity
      if (horizSpeed > 1.2) {
        const targetYaw = Math.atan2(vel.x, vel.z);
        this.rotateCharacterFacing(targetYaw, 14.0 * dt);
      }

      // Bank smoothly into lateral turns based on angular turning velocity
      const heading = new THREE.Vector3(
        Math.sin(this.characterGroup.rotation.y),
        0,
        Math.cos(this.characterGroup.rotation.y)
      );
      const crossY = vel.x * heading.z - vel.z * heading.x;
      const bankAngle = THREE.MathUtils.clamp(crossY * 0.035, -0.65, 0.65);
      this.torsoMesh.rotation.z = THREE.MathUtils.lerp(this.torsoMesh.rotation.z, bankAngle, 0.22);

      // Pitch angle along vertical swing velocity (smooth and stabilized)
      const swingPitch = THREE.MathUtils.clamp(-vel.y * 0.02, -0.5, 0.5);
      this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.22 + swingPitch, 0.22);
      this.torsoMesh.rotation.y = THREE.MathUtils.lerp(this.torsoMesh.rotation.y, 0, 0.2);
      this.torsoMesh.position.y = THREE.MathUtils.lerp(this.torsoMesh.position.y, 0.42, 0.25);

      // 3D direction vector from hero shoulder to web anchor in character local space
      const toAnchorWorld = new THREE.Vector3()
        .subVectors(this.physics.anchorPoint, this.physics.position)
        .normalize();
      const toAnchorLocal = toAnchorWorld
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.characterGroup.rotation.y);
      const armElev = Math.atan2(toAnchorLocal.y, Math.hypot(toAnchorLocal.x, toAnchorLocal.z));
      const armYaw = Math.atan2(toAnchorLocal.x, toAnchorLocal.z);

      // Spider-Man GLB: Right arm raised high towards web anchor, Left arm counter-balancing
      targetTorsoX = -0.15 + swingPitch;
      targetTorsoY = 0;
      targetTorsoZ = bankAngle;
      targetHeadX = -swingPitch * 0.6;
      targetHeadY = -bankAngle * 0.4;
      targetArmRX = THREE.MathUtils.clamp(armElev + 0.45, 0.6, 1.6);
      targetArmRZ = THREE.MathUtils.clamp(-0.70 - armYaw * 0.35, -1.2, -0.3);
      targetArmLX = -0.45; // Swept back in balance flourish
      targetArmLZ = 0.65; // Extended outward
      if (vel.y > 0) {
        const upswing = Math.min(1.0, vel.y / 15.0);
        targetLegLX = 0.65 * upswing; // Pendulum kick forward
        targetLegLZ = -0.12;
        targetLegRX = 0.40 * upswing;
        targetLegRZ = 0.12;
      } else {
        targetLegLX = -0.45; // Streamlined behind during downswing
        targetLegLZ = -0.06;
        targetLegRX = -0.35;
        targetLegRZ = 0.06;
      }
      targetRootY = -0.88;

      // Fallback procedural hero posing
      const armElevProc = Math.atan2(-toAnchorLocal.y, Math.hypot(toAnchorLocal.x, toAnchorLocal.z));
      this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, armElevProc - Math.PI * 0.5, 0.28);
      this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, armYaw * 0.5, 0.28);
      this.rightForearmGroup.rotation.x = THREE.MathUtils.lerp(this.rightForearmGroup.rotation.x, -0.55, 0.25);
      this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0.85, 0.22);
      this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, -0.65, 0.22);
      this.leftForearmGroup.rotation.x = THREE.MathUtils.lerp(this.leftForearmGroup.rotation.x, -0.65, 0.22);
      if (vel.y > 0) {
        const upswing = Math.min(1.0, Math.max(0, vel.y / 15.0));
        this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, THREE.MathUtils.lerp(0.65, -0.35, upswing), 0.25);
        this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, THREE.MathUtils.lerp(0.85, 0.08, upswing), 0.25);
        this.leftCalfGroup.rotation.x = THREE.MathUtils.lerp(this.leftCalfGroup.rotation.x, 0.55, 0.25);
        this.rightCalfGroup.rotation.x = THREE.MathUtils.lerp(this.rightCalfGroup.rotation.x, 0.35, 0.25);
      } else {
        this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0.70, 0.22);
        this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, 0.85, 0.22);
        this.leftCalfGroup.rotation.x = THREE.MathUtils.lerp(this.leftCalfGroup.rotation.x, 0.75, 0.22);
        this.rightCalfGroup.rotation.x = THREE.MathUtils.lerp(this.rightCalfGroup.rotation.x, 0.50, 0.22);
      }
      this.leftLegGroup.rotation.z = THREE.MathUtils.lerp(this.leftLegGroup.rotation.z, -0.12, 0.2);
      this.rightLegGroup.rotation.z = THREE.MathUtils.lerp(this.rightLegGroup.rotation.z, 0.12, 0.2);
      this.headMesh.rotation.x = THREE.MathUtils.lerp(this.headMesh.rotation.x, -swingPitch * 0.7, 0.25);
      this.headMesh.rotation.y = THREE.MathUtils.lerp(this.headMesh.rotation.y, -bankAngle * 0.45, 0.25);

    } else if (!isGrounded) {
      // -------------------------------------------------------------
      // STATE 2: JATUH DARI KETINGGIAN / AIRBORNE SOMERSAULT / SKY DIVE
      // -------------------------------------------------------------
      // Align facing with movement input or horizontal velocity
      if (hasInput) {
        const targetYaw = Math.atan2(moveInput.x, moveInput.z);
        this.rotateCharacterFacing(targetYaw, 12.0 * dt);
      } else if (horizSpeed > 1.2) {
        const targetYaw = Math.atan2(vel.x, vel.z);
        this.rotateCharacterFacing(targetYaw, 10.0 * dt);
      }

      if (vel.y > 2.0) {
        // 2A. Catapult Vault / Acrobatic Somersault Launch (Immediately after swing release)
        targetTorsoX = -0.30;
        targetTorsoY = 0;
        targetTorsoZ = 0;
        targetHeadX = 0.20;
        targetHeadY = 0;
        targetLegLX = 0.65; // Knees tucked high
        targetLegLZ = -0.10;
        targetLegRX = 0.50;
        targetLegRZ = 0.10;
        targetArmLX = 0.35; // Arms open in acrobatic stabilization
        targetArmLZ = 0.55;
        targetArmRX = 0.35;
        targetArmRZ = -0.55;
        targetRootY = -0.85;

        // Fallback procedural
        this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.35, 0.22);
        this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0.75, 0.25);
        this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, 0.40, 0.25);
        this.leftCalfGroup.rotation.x = THREE.MathUtils.lerp(this.leftCalfGroup.rotation.x, 1.25, 0.25);
        this.rightCalfGroup.rotation.x = THREE.MathUtils.lerp(this.rightCalfGroup.rotation.x, 0.95, 0.25);
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, -0.65, 0.25);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, -0.65, 0.25);
      } else if (vel.y < -3.5) {
        // 2B. High-Speed Descent Superhero Dive ("Jatuh Dari Ketinggian")
        const divePitch = Math.min(1.2, -vel.y * 0.04);
        targetTorsoX = -divePitch; // Steep forward dive lean
        targetTorsoY = 0;
        targetTorsoZ = 0;
        targetHeadX = 0.55; // Head raised looking forward at city street below
        targetHeadY = 0;
        // Arms swept back along the flanks like aerodynamic wings
        targetArmLX = -0.75;
        targetArmLZ = 0.10;
        targetArmRX = -0.75;
        targetArmRZ = -0.10;
        targetLegLX = -0.40;
        targetLegLZ = -0.05;
        targetLegRX = -0.30;
        targetLegRZ = 0.05;
        targetRootY = -0.88;

        // Fallback procedural
        this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, divePitch, 0.25);
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 1.25, 0.25);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 1.25, 0.25);
      } else {
        // 2C. Weightless Apex Float & Target Ready Pose
        targetTorsoX = -0.10;
        targetTorsoY = 0;
        targetTorsoZ = 0;
        targetHeadX = 0.10;
        targetHeadY = 0;
        targetArmRX = 0.75; // Right arm targeting forward
        targetArmRZ = -0.25;
        targetArmLX = -0.45; // Left arm swept back
        targetArmLZ = 0.45;
        targetLegLX = 0.45;
        targetLegLZ = -0.08;
        targetLegRX = -0.25;
        targetLegRZ = 0.08;
        targetRootY = -0.88;

        // Fallback procedural
        this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.15, 0.2);
        this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0.35, 0.22);
        this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, -0.20, 0.22);
      }
    } else {
      // -------------------------------------------------------------
      // STATE 3: GROUND & ROOFTOP LOCOMOTION (WALKING vs SUPERHERO SPRINTING vs IDLE)
      // -------------------------------------------------------------
      let turnDiff = 0;
      let bankLean = 0;
      if (hasInput) {
        const targetYaw = Math.atan2(moveInput.x, moveInput.z);
        turnDiff = this.rotateCharacterFacing(targetYaw, 18.0 * dt);
        bankLean = THREE.MathUtils.clamp(-turnDiff * 0.45, -0.35, 0.35);
        this.torsoMesh.rotation.z = THREE.MathUtils.lerp(
          this.torsoMesh.rotation.z,
          isSprinting ? bankLean * 1.3 : bankLean,
          0.28
        );
      } else if (horizSpeed > 0.6) {
        const targetYaw = Math.atan2(vel.x, vel.z);
        turnDiff = this.rotateCharacterFacing(targetYaw, 12.0 * dt);
        this.torsoMesh.rotation.z = THREE.MathUtils.lerp(this.torsoMesh.rotation.z, 0, 0.2);
      } else {
        this.torsoMesh.rotation.z = THREE.MathUtils.lerp(this.torsoMesh.rotation.z, 0, 0.2);
      }

      const isMoving = hasInput || horizSpeed > 0.8;

      if (this.landingShockwaveTimer > 0) {
        // 3A. 3-Point Superhero Landing Crouch on high-impact landing
        targetTorsoX = -0.48;
        targetTorsoY = 0.12;
        targetTorsoZ = 0;
        targetHeadX = 0.45;
        targetHeadY = 0;
        targetArmRX = 0.70; // Right fist on pavement
        targetArmRZ = -0.15;
        targetArmLX = -0.60; // Left arm back for balance
        targetArmLZ = 0.55;
        targetLegLX = 0.45; // Dynamic landing crouch legs
        targetLegLZ = -0.35;
        targetLegRX = -0.55;
        targetLegRZ = 0.25;
        targetRootY = -1.15;

        // Fallback procedural
        this.torsoMesh.position.y = 0.22;
        this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.55, 0.35);
        this.rightArmGroup.rotation.x = -1.15;
        this.leftArmGroup.rotation.x = 0.85;

      } else if (isMoving) {
        if (isSprinting) {
          // 3B. SUPERHERO SPRINT (Fast, fluid, low-profile athletic run)
          const cadence = Math.min(24, Math.max(16, horizSpeed * 1.15));
          this.runCycleTime += dt * cadence;
          const stride = Math.sin(this.runCycleTime);

          // Spider-Man GLB model targets
          targetTorsoX = -0.30; // Athletic forward lean
          targetTorsoY = stride * 0.12; // Natural chest counter-twist
          targetTorsoZ = bankLean; // Bank into turns
          targetHeadX = 0.22;
          targetHeadY = -stride * 0.04;
          targetLegLX = stride * 0.85; // High-knee drive
          targetLegLZ = -0.06;
          targetLegRX = -stride * 0.85;
          targetLegRZ = 0.06;
          // Power arm pumping (opposite to legs: left arm forward when left leg is back!)
          targetArmLX = -stride * 0.85;
          targetArmLZ = 0.20; // Natural outward elbow flare
          targetArmRX = stride * 0.85;
          targetArmRZ = -0.20;
          targetRootY = -0.88 + Math.abs(Math.sin(this.runCycleTime * 2)) * 0.06;

          // Fallback procedural
          this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.35, 0.28);
          this.torsoMesh.rotation.y = THREE.MathUtils.lerp(this.torsoMesh.rotation.y, stride * 0.16, 0.3);
          this.leftLegGroup.rotation.x = stride * 1.05;
          this.rightLegGroup.rotation.x = -stride * 1.05;
          this.leftArmGroup.rotation.x = -stride * 1.05;
          this.rightArmGroup.rotation.x = stride * 1.05;

        } else {
          // 3C. NATURAL FLUID WALKING (Moderate cadence, relaxed arm swing)
          const cadence = Math.min(13, Math.max(8.5, horizSpeed * 1.0));
          this.runCycleTime += dt * cadence;
          const stride = Math.sin(this.runCycleTime);

          targetTorsoX = -0.08;
          targetTorsoY = stride * 0.06;
          targetTorsoZ = 0;
          targetHeadX = 0.08;
          targetHeadY = -stride * 0.03;
          targetLegLX = stride * 0.45;
          targetLegLZ = -0.04;
          targetLegRX = -stride * 0.45;
          targetLegRZ = 0.04;
          targetArmLX = -stride * 0.40;
          targetArmLZ = 0.08;
          targetArmRX = stride * 0.40;
          targetArmRZ = -0.08;
          targetRootY = -0.88 + Math.abs(Math.sin(this.runCycleTime * 2)) * 0.025;

          // Fallback procedural
          this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.14, 0.22);
          this.leftLegGroup.rotation.x = stride * 0.55;
          this.rightLegGroup.rotation.x = -stride * 0.55;
          this.leftArmGroup.rotation.x = -stride * 0.45;
          this.rightArmGroup.rotation.x = stride * 0.45;
        }
      } else {
        // 3D. IDLE SPIDER-MAN READY STANCE (Hands relaxed at sides, not behind back!)
        targetTorsoX = -0.04;
        targetTorsoY = 0;
        targetTorsoZ = 0;
        targetHeadX = 0;
        targetHeadY = 0;
        targetArmLX = 0.05; // Resting naturally at hip
        targetArmLZ = 0.05;
        targetArmRX = 0.05; // Resting naturally at hip
        targetArmRZ = -0.05;
        targetLegLX = 0.05; // Natural stance
        targetLegLZ = -0.05;
        targetLegRX = -0.05;
        targetLegRZ = 0.05;
        targetRootY = -0.88;

        // Fallback procedural
        this.torsoMesh.position.y = THREE.MathUtils.lerp(this.torsoMesh.position.y, 0.42, 0.2);
        this.torsoMesh.rotation.x = THREE.MathUtils.lerp(this.torsoMesh.rotation.x, -0.12, 0.2);
        this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0.12, 0.2);
        this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, -0.08, 0.2);
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0.12, 0.2);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 0.12, 0.2);
      }
    }

    // Smoothly interpolate all Spider-Man GLB targets
    const lerpRate = Math.min(1.0, 16.0 * dt);
    this.spidermanPose.torsoX = THREE.MathUtils.lerp(this.spidermanPose.torsoX, targetTorsoX, lerpRate);
    this.spidermanPose.torsoY = THREE.MathUtils.lerp(this.spidermanPose.torsoY, targetTorsoY, lerpRate);
    this.spidermanPose.torsoZ = THREE.MathUtils.lerp(this.spidermanPose.torsoZ, targetTorsoZ, lerpRate);
    this.spidermanPose.headX = THREE.MathUtils.lerp(this.spidermanPose.headX, targetHeadX, lerpRate);
    this.spidermanPose.headY = THREE.MathUtils.lerp(this.spidermanPose.headY, targetHeadY, lerpRate);
    this.spidermanPose.armLX = THREE.MathUtils.lerp(this.spidermanPose.armLX, targetArmLX, lerpRate);
    this.spidermanPose.armLZ = THREE.MathUtils.lerp(this.spidermanPose.armLZ, targetArmLZ, lerpRate);
    this.spidermanPose.armRX = THREE.MathUtils.lerp(this.spidermanPose.armRX, targetArmRX, lerpRate);
    this.spidermanPose.armRZ = THREE.MathUtils.lerp(this.spidermanPose.armRZ, targetArmRZ, lerpRate);
    this.spidermanPose.legLX = THREE.MathUtils.lerp(this.spidermanPose.legLX, targetLegLX, lerpRate);
    this.spidermanPose.legLZ = THREE.MathUtils.lerp(this.spidermanPose.legLZ, targetLegLZ, lerpRate);
    this.spidermanPose.legRX = THREE.MathUtils.lerp(this.spidermanPose.legRX, targetLegRX, lerpRate);
    this.spidermanPose.legRZ = THREE.MathUtils.lerp(this.spidermanPose.legRZ, targetLegRZ, lerpRate);
    this.spidermanPose.rootY = THREE.MathUtils.lerp(this.spidermanPose.rootY, targetRootY, lerpRate);

    // Synchronize rigged skeleton bones on high-poly GLB Spider-Man model
    if (this.isGlbHero && this.spidermanInstance) {
      const inst = this.spidermanInstance;
      this.applyBoneRot(
        inst.torsoBone,
        'torso',
        this.spidermanPose.torsoX,
        this.spidermanPose.torsoY,
        this.spidermanPose.torsoZ
      );
      this.applyBoneRot(
        inst.headBone,
        'head',
        this.spidermanPose.headX,
        this.spidermanPose.headY,
        0
      );

      // ArmL_1 and ArmR_3 are the actual arm bones that skin the mesh
      this.applyBoneRot(
        inst.armL,
        'armL',
        this.spidermanPose.armLX,
        0,
        this.spidermanPose.armLZ
      );
      this.applyBoneRot(
        inst.armR,
        'armR',
        this.spidermanPose.armRX,
        0,
        this.spidermanPose.armRZ
      );

      // LegL_6 and LegR_7 skin the legs
      this.applyBoneRot(
        inst.legL,
        'legL',
        this.spidermanPose.legLX,
        0,
        this.spidermanPose.legLZ
      );
      this.applyBoneRot(
        inst.legR,
        'legR',
        this.spidermanPose.legRX,
        0,
        this.spidermanPose.legRZ
      );

      if (inst.rootBone) {
        inst.rootBone.position.y = this.spidermanPose.rootY;
      }
    }
  }

  private updateCamera(speed: number, dt: number) {
    const heroPos = this.physics.position;

    // Smoothly track hero position to eliminate high-frequency physics micro-steps
    const lerpSpeed = Math.min(1.0, 16.0 * dt);
    this.smoothedHeroPos.lerp(heroPos, lerpSpeed);

    // Dynamic FOV widening with speed (68 up to 76 deg max)
    const speedRatio = Math.min(1.0, speed / 60);
    const targetFOV = this.baseFOV + speedRatio * 8;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, Math.min(1.0, 4.0 * dt));
    this.camera.updateProjectionMatrix();

    // Smooth rear-view yaw interpolation (0 when front, Math.PI when looking behind)
    const targetRearYaw = this.isLookBehindActive ? Math.PI : 0;
    this.rearLookYaw = THREE.MathUtils.lerp(this.rearLookYaw, targetRearYaw, Math.min(1.0, 16.0 * dt));
    const effectiveYaw = this.cameraYaw + this.rearLookYaw;

    // --- Dynamic Camera Sway Animation ---
    // Extract velocity components relative to camera view frame
    const vel = this.physics.velocity;
    const forwardDir = new THREE.Vector3(Math.sin(effectiveYaw), 0, Math.cos(effectiveYaw));
    const rightDir = new THREE.Vector3(Math.cos(effectiveYaw), 0, -Math.sin(effectiveYaw));

    const lateralVel = vel.dot(rightDir);   // Lateral drift / banking velocity
    const forwardVel = vel.dot(forwardDir); // Forward rush / speed
    const verticalVel = vel.y;              // Vertical ascent or dive velocity

    // 1. Dynamic Camera Roll (Dutch Angle / Banking)
    // Banks subtly into turns and swing arcs (max ~3.8 degrees = ~0.065 rad)
    let targetRoll = -THREE.MathUtils.clamp((lateralVel / 32.0) * 0.045, -0.065, 0.065);

    // Dynamic pendulum centrifugal roll when attached to web
    if (this.physics.isAttached && this.physics.anchorPoint) {
      const ropeVec = new THREE.Vector3().subVectors(this.smoothedHeroPos, this.physics.anchorPoint);
      const ropeLateral = ropeVec.dot(rightDir) / Math.max(2, this.physics.ropeLength);
      const pendulumRoll = THREE.MathUtils.clamp(-ropeLateral * 0.035, -0.04, 0.04);
      targetRoll += pendulumRoll;
    }
    targetRoll = THREE.MathUtils.clamp(targetRoll, -0.075, 0.075);
    this.currentCameraRoll = THREE.MathUtils.lerp(this.currentCameraRoll, targetRoll, Math.min(1.0, 9.0 * dt));

    // 2. Dynamic Camera Sway Offset (Translational Sway)
    // - Lateral sway follows centrifugal movement
    // - Vertical sway emphasizes dive/climb G-force
    // - Forward sway adds momentum compression
    const targetSwayX = -THREE.MathUtils.clamp((lateralVel / 30.0) * 0.45, -0.65, 0.65);
    const targetSwayY = THREE.MathUtils.clamp(-verticalVel * 0.016, -0.5, 0.65);
    const targetSwayZ = -THREE.MathUtils.clamp((forwardVel / 35.0) * 0.45, -0.7, 0.4);

    const targetWorldSway = new THREE.Vector3()
      .addScaledVector(rightDir, targetSwayX)
      .add(new THREE.Vector3(0, targetSwayY, 0))
      .addScaledVector(forwardDir, targetSwayZ);

    // Subtle harmonic pendulum sway while swinging
    if (this.physics.isAttached) {
      this.swingBreatheTimer += dt * Math.min(5.0, 1.2 + speed / 20.0);
      const harmonicOsc = Math.sin(this.swingBreatheTimer) * 0.08 * Math.min(1.0, speed / 15.0);
      const harmonicLift = Math.cos(this.swingBreatheTimer * 0.5) * 0.04;
      targetWorldSway.addScaledVector(rightDir, harmonicOsc);
      targetWorldSway.y += harmonicLift;
    }

    this.cameraSwayOffset.lerp(targetWorldSway, Math.min(1.0, 8.0 * dt));

    if (this.cameraMode === 'first_person') {
      // First person view: camera placed right at head/visor with subtle velocity sway
      const fpSway = this.cameraSwayOffset.clone().multiplyScalar(0.25);
      this.camera.position.set(
        this.smoothedHeroPos.x + fpSway.x,
        this.smoothedHeroPos.y + 1.1 + fpSway.y,
        this.smoothedHeroPos.z + fpSway.z
      );
      const lookDist = 10;
      const targetX = this.smoothedHeroPos.x + Math.sin(effectiveYaw) * Math.cos(this.cameraPitch) * lookDist;
      const targetY = this.smoothedHeroPos.y + 1.1 + Math.sin(this.cameraPitch) * lookDist;
      const targetZ = this.smoothedHeroPos.z + Math.cos(effectiveYaw) * Math.cos(this.cameraPitch) * lookDist;
      this.camera.lookAt(targetX, targetY, targetZ);
      this.camera.rotateZ(this.currentCameraRoll * 0.8);
      this.characterGroup.visible = false;
      return;
    }

    this.characterGroup.visible = true;

    // Third person chase cam:
    // Look comfortably above Peter's head towards the city
    const heroHead = new THREE.Vector3(
      this.smoothedHeroPos.x,
      this.smoothedHeroPos.y + 1.1,
      this.smoothedHeroPos.z
    );

    // If climbing on a wall, offset ray origin away from the wall so raycaster starts in open air
    if (this.physics.isClimbing && this.physics.wallNormal.lengthSq() > 0.05) {
      heroHead.addScaledVector(this.physics.wallNormal, 0.45);
    }

    // Raycast backwards from hero head to detect building walls smoothly (using effectiveYaw for rear view)
    const rayDir = new THREE.Vector3(
      -Math.sin(effectiveYaw) * Math.cos(this.cameraPitch),
      -Math.sin(this.cameraPitch) + 0.1,
      -Math.cos(effectiveYaw) * Math.cos(this.cameraPitch)
    ).normalize();

    let targetDist = this.cameraDistance;
    const camRaycaster = new THREE.Raycaster(heroHead, rayDir, 0.35, this.cameraDistance);
    const hits = camRaycaster.intersectObjects(this.city.buildingMeshes, false);
    if (hits.length > 0) {
      targetDist = Math.max(0.7, hits[0].distance - 0.25);
    }

    // Smooth camera distance interpolation (prevents violent popping/shaking near walls!)
    this.currentCamDistance = THREE.MathUtils.lerp(
      this.currentCamDistance,
      targetDist,
      Math.min(1.0, 10.0 * dt)
    );

    const horizontalDist = this.currentCamDistance * Math.cos(this.cameraPitch);
    const verticalDist = 1.6 - this.currentCamDistance * Math.sin(this.cameraPitch);

    const targetCamPos = new THREE.Vector3(
      heroHead.x - Math.sin(effectiveYaw) * horizontalDist,
      heroHead.y + verticalDist - 1.1,
      heroHead.z - Math.cos(effectiveYaw) * horizontalDist
    );

    // Ensure camera never sinks into street pavement or rooftop floor
    const minFloorY = (this.physics.isOnRoof || this.physics.isOnGround)
      ? this.smoothedHeroPos.y + 0.35
      : 1.0;
    targetCamPos.y = Math.max(minFloorY, targetCamPos.y);

    // Apply dynamic velocity sway offset
    targetCamPos.add(this.cameraSwayOffset);

    // Smoothly position camera
    this.camera.position.lerp(targetCamPos, lerpSpeed);

    // Look comfortably ahead and slightly over Peter's head towards city skyline
    const lookTarget = new THREE.Vector3(
      heroHead.x,
      heroHead.y + 0.1 + Math.sin(this.cameraPitch) * (this.currentCamDistance * 0.4),
      heroHead.z
    );
    this.cameraTarget.lerp(lookTarget, lerpSpeed);
    this.camera.lookAt(this.cameraTarget);

    // Apply dynamic camera roll sway (Dutch tilt banking)
    this.camera.rotateZ(this.currentCameraRoll);
  }

  private updateWebRope() {
    if (this.physics.isAttached && this.physics.anchorPoint) {
      this.webLineMesh.visible = true;
      this.webAnchorImpactMesh.visible = true;
      this.webAnchorImpactMesh.position.copy(this.physics.anchorPoint);

      // Hero shooter hand position from actual right wrist web-shooter nozzle in 3D world space
      const handPos = new THREE.Vector3();
      if (this.isGlbHero && this.spidermanInstance?.handR) {
        this.spidermanInstance.handR.getWorldPosition(handPos);
      } else if (this.isGlbHero && this.spidermanInstance?.armR) {
        handPos.set(2.85, 3.35, 0.25);
        this.spidermanInstance.armR.localToWorld(handPos);
      } else if (this.rightNozzleMesh) {
        this.rightNozzleMesh.getWorldPosition(handPos);
      } else {
        this.rightArmGroup.getWorldPosition(handPos);
        handPos.y -= 0.66;
      }
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
