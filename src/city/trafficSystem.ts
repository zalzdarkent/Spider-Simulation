import * as THREE from 'three';
import { modelManager, CarInstance } from '../renderer/modelManager';

export type TurnDirection = 'straight' | 'left' | 'right';

export interface TurnState {
  isTurning: boolean;
  turnDirection: 'left' | 'right';
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  p3: THREE.Vector3;
  fromAxis: 'x' | 'z';
  fromDir: number;
  toAxis: 'x' | 'z';
  toDir: number;
  toLaneCoord: number;
  intersectionX: number;
  intersectionZ: number;
  turnDuration: number;
  elapsed: number;
}

export interface Vehicle {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  isPolice?: boolean;
  policeBeacons?: { red: THREE.Mesh; blue: THREE.Mesh };
  axis: 'x' | 'z';
  direction: number; // 1 or -1
  cruiseSpeed: number; // Desired normal speed (m/s)
  currentSpeed: number; // Actual current velocity
  laneCoord: number; // Constant coordinate on perpendicular axis
  minBound: number;
  maxBound: number;
  isGlb?: boolean;
  vehicleType?: 'taxi' | 'police' | 'sedan' | 'van';
  // Intersection navigation & turn state
  plannedTurn: TurnDirection;
  turnState?: TurnState;
  lastIntersectionKey?: string;
  // Lights
  taillights?: THREE.Mesh[];
  leftBlinkers?: THREE.Mesh[];
  rightBlinkers?: THREE.Mesh[];
  isBraking?: boolean;
}

export interface TrafficOptions {
  timeOfDay: 'sunset' | 'night' | 'day' | 'foggy';
  avenues: number[];
  streets: number[];
}

export type LightSignal = 'green' | 'yellow' | 'red';

interface TrafficLightPost {
  group: THREE.Group;
  corner: 'NE' | 'NW' | 'SE' | 'SW';
  intersectionX: number;
  intersectionZ: number;
  avenueLenses: { red: THREE.Mesh[]; yellow: THREE.Mesh[]; green: THREE.Mesh[] };
  streetLenses: { red: THREE.Mesh[]; yellow: THREE.Mesh[]; green: THREE.Mesh[] };
}

// Math helper: Evaluate cubic Bézier curve
function cubicBezier(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number
): THREE.Vector3 {
  const oneMinusT = 1 - t;
  const a = oneMinusT * oneMinusT * oneMinusT;
  const b = 3 * oneMinusT * oneMinusT * t;
  const c = 3 * oneMinusT * t * t;
  const d = t * t * t;

  return new THREE.Vector3(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    0,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z
  );
}

// Math helper: Evaluate cubic Bézier first derivative (tangent direction)
function cubicBezierDerivative(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number
): THREE.Vector3 {
  const oneMinusT = 1 - t;
  const a = 3 * oneMinusT * oneMinusT;
  const b = 6 * oneMinusT * t;
  const c = 3 * t * t;

  const dx = a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x);
  const dz = a * (p1.z - p0.z) + b * (p2.z - p1.z) + c * (p3.z - p2.z);

  return new THREE.Vector3(dx, 0, dz).normalize();
}

export class TrafficSystem {
  public group: THREE.Group;
  private vehicles: Vehicle[] = [];
  private trafficLightPosts: TrafficLightPost[] = [];
  private policeLightTimer = 0;
  private blinkerTimer = 0;
  private globalTrafficTime = 0;

  private avenues: number[];
  private streets: number[];
  private readonly laneOffset = 5.2; // Driving lane offset from road center

  // Traffic light cycle constants (total 22 seconds)
  // Phase 1: Avenue (NS) Green 8s, Yellow 3s. Street (EW) Red.
  // Phase 2: Avenue (NS) Red. Street (EW) Green 8s, Yellow 3s.
  private readonly nsGreenDuration = 8.0;
  private readonly nsYellowDuration = 3.0;
  private readonly ewGreenDuration = 8.0;
  private readonly ewYellowDuration = 3.0;
  private readonly cycleTotal = 22.0;

  constructor(options: TrafficOptions) {
    this.group = new THREE.Group();
    this.group.name = 'TrafficSystemGroup';

    this.avenues = [...options.avenues].sort((a, b) => a - b);
    this.streets = [...options.streets].sort((a, b) => a - b);

    // 1. Create 3D Traffic Lights at intersections
    this.initTrafficLights();

    // 2. Spawn moving and parked vehicles
    this.initVehicles(options);

    // 3. Upgrade to 3D GLB when models finish loading
    modelManager.onModelsLoaded(() => {
      this.upgradeToGLB();
    });
  }

  /**
   * Spawns physical 3D Traffic Light posts with Red, Yellow, Green hooded signals at each intersection
   */
  private initTrafficLights() {
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });

    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.6,
      roughness: 0.4,
    });

    // Materials for the signal lenses
    const unlitMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const redLitMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const yellowLitMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const greenLitMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    const createDualSignalHead = (direction: 'ns' | 'ew'): {
      group: THREE.Group;
      redLenses: THREE.Mesh[];
      yellowLenses: THREE.Mesh[];
      greenLenses: THREE.Mesh[];
    } => {
      const headGroup = new THREE.Group();

      // Main signal housing box (vertical rectangular box)
      const housingGeo = new THREE.BoxGeometry(0.4, 1.08, 0.32);
      const housing = new THREE.Mesh(housingGeo, boxMat);
      headGroup.add(housing);

      // Backplates border for visibility
      for (const plateZ of [-0.16, 0.16]) {
        const plateGeo = new THREE.BoxGeometry(0.54, 1.2, 0.02);
        const plate = new THREE.Mesh(plateGeo, boxMat);
        plate.position.z = plateZ;
        headGroup.add(plate);
      }

      // Lenses (Red top, Yellow middle, Green bottom)
      const lensGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16);
      lensGeo.rotateX(Math.PI / 2);

      const hoodGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12, 1, true, 0, Math.PI);
      hoodGeo.rotateX(Math.PI / 2);

      const redLenses: THREE.Mesh[] = [];
      const yellowLenses: THREE.Mesh[] = [];
      const greenLenses: THREE.Mesh[] = [];

      // Create dual-facing lenses on front (+Z) and back (-Z) so both oncoming and far-side traffic always see the lights!
      for (const side of [1, -1]) {
        const zPos = side * 0.16;
        const hoodRotY = side > 0 ? 0 : Math.PI;

        // Red Lens
        const rLens = new THREE.Mesh(lensGeo, redLitMat.clone());
        rLens.position.set(0, 0.32, zPos);
        headGroup.add(rLens);
        redLenses.push(rLens);

        const rHood = new THREE.Mesh(hoodGeo, boxMat);
        rHood.position.set(0, 0.32, zPos);
        rHood.rotation.y = hoodRotY;
        headGroup.add(rHood);

        // Yellow Lens
        const yLens = new THREE.Mesh(lensGeo, unlitMat.clone());
        yLens.position.set(0, 0, zPos);
        headGroup.add(yLens);
        yellowLenses.push(yLens);

        const yHood = new THREE.Mesh(hoodGeo, boxMat);
        yHood.position.set(0, 0, zPos);
        yHood.rotation.y = hoodRotY;
        headGroup.add(yHood);

        // Green Lens
        const gLens = new THREE.Mesh(lensGeo, unlitMat.clone());
        gLens.position.set(0, -0.32, zPos);
        headGroup.add(gLens);
        greenLenses.push(gLens);

        const gHood = new THREE.Mesh(hoodGeo, boxMat);
        gHood.position.set(0, -0.32, zPos);
        gHood.rotation.y = hoodRotY;
        headGroup.add(gHood);
      }

      if (direction === 'ew') {
        headGroup.rotation.y = Math.PI / 2;
      }

      return { group: headGroup, redLenses, yellowLenses, greenLenses };
    };

    // Place traffic light poles on ALL 4 intersection corners (Ruas perempatan lengkap: NW, NE, SW, SE)
    for (let aIdx = 0; aIdx < this.avenues.length; aIdx++) {
      for (let sIdx = 0; sIdx < this.streets.length; sIdx++) {
        const ax = this.avenues[aIdx];
        const sz = this.streets[sIdx];

        const corners: ('NW' | 'NE' | 'SW' | 'SE')[] = ['NW', 'NE', 'SW', 'SE'];

        for (const corner of corners) {
          const postGroup = new THREE.Group();
          postGroup.name = `TrafficLight_${corner}_${ax}_${sz}`;

          const isEast = corner === 'NE' || corner === 'SE';
          const isNorth = corner === 'NE' || corner === 'NW';

          const poleOffset = 12.2;
          const px = isEast ? ax + poleOffset : ax - poleOffset;
          const pz = isNorth ? sz + poleOffset : sz - poleOffset;

          postGroup.position.set(px, 0, pz);

          // Vertical steel pole on sidewalk corner
          const poleHeight = 5.8;
          const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, poleHeight, 10);
          const pole = new THREE.Mesh(poleGeo, postMat);
          pole.position.y = poleHeight / 2;
          postGroup.add(pole);

          // 1. Avenue Overhead Mast Arm (extending horizontally towards Avenue driving lane)
          const avenueArmDirX = isEast ? -1 : 1;
          const armLen = 4.4;
          const armGeoX = new THREE.CylinderGeometry(0.08, 0.1, armLen, 8);
          armGeoX.rotateZ(Math.PI / 2);
          const armX = new THREE.Mesh(armGeoX, postMat);
          armX.position.set(avenueArmDirX * (armLen / 2), poleHeight - 0.35, 0);
          postGroup.add(armX);

          // Avenue Overhead Signal Head (dual-sided, facing oncoming Northbound & Southbound traffic)
          const nsHeadOverhead = createDualSignalHead('ns');
          nsHeadOverhead.group.position.set(avenueArmDirX * (armLen * 0.8), poleHeight - 0.75, 0);
          postGroup.add(nsHeadOverhead.group);

          // 2. Cross-Street Mast Arm (extending horizontally towards Cross-street driving lane)
          const streetArmDirZ = isNorth ? -1 : 1;
          const armGeoZ = new THREE.CylinderGeometry(0.08, 0.1, armLen, 8);
          armGeoZ.rotateX(Math.PI / 2);
          const armZ = new THREE.Mesh(armGeoZ, postMat);
          armZ.position.set(0, poleHeight - 0.65, streetArmDirZ * (armLen / 2));
          postGroup.add(armZ);

          // Cross-Street Overhead Signal Head (dual-sided, facing oncoming Eastbound & Westbound traffic)
          const ewHeadOverhead = createDualSignalHead('ew');
          ewHeadOverhead.group.position.set(0, poleHeight - 1.05, streetArmDirZ * (armLen * 0.8));
          postGroup.add(ewHeadOverhead.group);

          // 3. Eye-Level Pole-Mounted Signal Heads (for stopped vehicles & pedestrian crossing)
          const nsPoleHead = createDualSignalHead('ns');
          nsPoleHead.group.position.set(avenueArmDirX * 0.28, 3.2, 0);
          nsPoleHead.group.scale.setScalar(0.85);
          postGroup.add(nsPoleHead.group);

          const ewPoleHead = createDualSignalHead('ew');
          ewPoleHead.group.position.set(0, 3.2, streetArmDirZ * 0.28);
          ewPoleHead.group.scale.setScalar(0.85);
          postGroup.add(ewPoleHead.group);

          this.group.add(postGroup);

          this.trafficLightPosts.push({
            group: postGroup,
            corner,
            intersectionX: ax,
            intersectionZ: sz,
            avenueLenses: {
              red: [...nsHeadOverhead.redLenses, ...nsPoleHead.redLenses],
              yellow: [...nsHeadOverhead.yellowLenses, ...nsPoleHead.yellowLenses],
              green: [...nsHeadOverhead.greenLenses, ...nsPoleHead.greenLenses],
            },
            streetLenses: {
              red: [...ewHeadOverhead.redLenses, ...ewPoleHead.redLenses],
              yellow: [...ewHeadOverhead.yellowLenses, ...ewPoleHead.yellowLenses],
              green: [...ewHeadOverhead.greenLenses, ...ewPoleHead.greenLenses],
            },
          });
        }
      }
    }
  }

  /**
   * Returns current traffic light state for a given intersection and axis
   */
  public getLightState(ax: number, sz: number, axis: 'x' | 'z'): LightSignal {
    // Coordinated green wave offset across the city grid
    const offset = Math.abs(ax * 0.03 + sz * 0.05);
    const localTime = (this.globalTrafficTime + offset) % this.cycleTotal;

    if (axis === 'z') {
      // Avenue (North-South):
      // 0 to 8s: Green
      // 8 to 11s: Yellow
      // 11 to 22s: Red
      if (localTime < this.nsGreenDuration) return 'green';
      if (localTime < this.nsGreenDuration + this.nsYellowDuration) return 'yellow';
      return 'red';
    } else {
      // Street (East-West):
      // 0 to 11s: Red
      // 11 to 19s: Green
      // 19 to 22s: Yellow
      const nsPhaseTotal = this.nsGreenDuration + this.nsYellowDuration;
      if (localTime < nsPhaseTotal) return 'red';
      if (localTime < nsPhaseTotal + this.ewGreenDuration) return 'green';
      return 'yellow';
    }
  }

  private upgradeToGLB() {
    this.vehicles.forEach((v) => {
      if (v.isGlb) return;
      const type = v.vehicleType || (v.isPolice ? 'police' : 'sedan');
      const glb = modelManager.createCarInstance(type);
      if (glb) {
        while (v.group.children.length > 0) {
          v.group.remove(v.group.children[0]);
        }
        v.group.add(glb.group);
        v.policeBeacons = glb.policeBeacons;
        v.isPolice = glb.isPolice;
        v.taillights = glb.taillights;
        v.leftBlinkers = glb.leftBlinkers;
        v.rightBlinkers = glb.rightBlinkers;
        v.wheels = [];
        v.isGlb = true;
      }
    });
  }

  private initVehicles(options: TrafficOptions) {
    const { avenues, streets } = options;

    // Materials for procedural car fallback
    const taxiYellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.25,
    });

    const policeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.35,
    });

    const policeBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.4,
      metalness: 0.3,
    });

    const civilianColors = [
      0x0284c7, // Sky Blue
      0xb91c1c, // Crimson Red
      0x475569, // Slate Metallic
      0x090d16, // Midnight Black
      0x10b981, // Emerald Green
      0xe2e8f0, // Pearl White
    ];

    const windowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.85,
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x171717,
      roughness: 0.85,
      metalness: 0.1,
    });

    const hubcapMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.2,
      metalness: 0.8,
    });

    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });

    const taxiSignMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const policeRedBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const policeBlueBeaconMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const blinkerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const createWheels = (length: number, width: number, wheelRadius = 0.38): THREE.Mesh[] => {
      const wheels: THREE.Mesh[] = [];
      const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.26, 12);
      const hubGeo = new THREE.CylinderGeometry(wheelRadius * 0.5, wheelRadius * 0.5, 0.27, 8);

      const xOff = width * 0.48;
      const zOff = length * 0.32;

      for (const sx of [-xOff, xOff]) {
        for (const sz of [-zOff, zOff]) {
          const wheel = new THREE.Mesh(wheelGeo, tireMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(sx, wheelRadius, sz);

          const hub = new THREE.Mesh(hubGeo, hubcapMat);
          wheel.add(hub);

          wheels.push(wheel);
        }
      }
      return wheels;
    };

    const createVehicleMesh = (type: 'taxi' | 'police' | 'sedan' | 'van') => {
      const glbCar = modelManager.createCarInstance(type);
      if (glbCar) {
        return {
          carGroup: glbCar.group,
          wheels: [] as THREE.Mesh[],
          isPolice: glbCar.isPolice,
          policeBeacons: glbCar.policeBeacons,
          taillights: glbCar.taillights,
          leftBlinkers: glbCar.leftBlinkers,
          rightBlinkers: glbCar.rightBlinkers,
          isGlb: true,
        };
      }

      const carGroup = new THREE.Group();
      let wheels: THREE.Mesh[] = [];
      let policeBeacons: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;
      const taillights: THREE.Mesh[] = [];
      const leftBlinkers: THREE.Mesh[] = [];
      const rightBlinkers: THREE.Mesh[] = [];

      const isPolice = type === 'police';

      if (type === 'van') {
        // Delivery Box Van
        const vanBodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
        const cabGeo = new THREE.BoxGeometry(2.3, 1.6, 2.2);
        const cab = new THREE.Mesh(cabGeo, vanBodyMat);
        cab.position.set(0, 1.25, 1.8);
        carGroup.add(cab);

        const boxGeo = new THREE.BoxGeometry(2.4, 2.2, 3.8);
        const box = new THREE.Mesh(boxGeo, vanBodyMat);
        box.position.set(0, 1.55, -0.9);
        carGroup.add(box);

        const winGeo = new THREE.BoxGeometry(2.1, 0.75, 0.1);
        const win = new THREE.Mesh(winGeo, windowGlassMat);
        win.position.set(0, 1.5, 2.86);
        carGroup.add(win);

        wheels = createWheels(5.8, 2.4, 0.44);
        wheels.forEach((w) => carGroup.add(w));
      } else {
        // Passenger Car (Sedan, Taxi, Police)
        const bodyLength = 4.6;
        const bodyWidth = 2.1;
        const bodyHeight = 0.95;

        let mainBodyMat: THREE.Material = taxiYellowMat;
        if (type === 'police') mainBodyMat = policeWhiteMat;
        else if (type === 'sedan') {
          const color = civilianColors[Math.floor(Math.random() * civilianColors.length)];
          mainBodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.35 });
        }

        const chassisGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
        const chassis = new THREE.Mesh(chassisGeo, mainBodyMat);
        chassis.position.y = 0.75;
        chassis.castShadow = true;
        carGroup.add(chassis);

        const cabinLength = 2.4;
        const cabinWidth = 1.85;
        const cabinHeight = 0.78;
        const cabinGeo = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
        const cabin = new THREE.Mesh(cabinGeo, windowGlassMat);
        cabin.position.set(0, 1.5, -0.15);
        carGroup.add(cabin);

        const roofCapGeo = new THREE.BoxGeometry(cabinWidth * 0.95, 0.08, cabinLength * 0.95);
        const roofCap = new THREE.Mesh(roofCapGeo, mainBodyMat);
        roofCap.position.set(0, 1.9, -0.15);
        carGroup.add(roofCap);

        if (type === 'taxi') {
          const signGeo = new THREE.BoxGeometry(0.8, 0.22, 0.3);
          const sign = new THREE.Mesh(signGeo, taxiSignMat);
          sign.position.set(0, 2.05, -0.15);
          carGroup.add(sign);
        } else if (type === 'police') {
          const stripeGeo = new THREE.BoxGeometry(bodyWidth + 0.02, 0.25, bodyLength * 0.85);
          const stripe = new THREE.Mesh(stripeGeo, policeBlueMat);
          stripe.position.y = 0.75;
          carGroup.add(stripe);

          const barBaseGeo = new THREE.BoxGeometry(1.2, 0.08, 0.25);
          const barBase = new THREE.Mesh(barBaseGeo, hubcapMat);
          barBase.position.set(0, 1.96, -0.15);
          carGroup.add(barBase);

          const beaconGeo = new THREE.BoxGeometry(0.45, 0.16, 0.22);
          const redB = new THREE.Mesh(beaconGeo, policeRedBeaconMat);
          redB.position.set(-0.32, 2.06, -0.15);
          carGroup.add(redB);

          const blueB = new THREE.Mesh(beaconGeo, policeBlueBeaconMat);
          blueB.position.set(0.32, 2.06, -0.15);
          carGroup.add(blueB);

          policeBeacons = { red: redB, blue: blueB };
        }

        wheels = createWheels(bodyLength, bodyWidth, 0.38);
        wheels.forEach((w) => carGroup.add(w));
      }

      // Headlights at front (+Z)
      const headGeo = new THREE.BoxGeometry(0.35, 0.16, 0.08);
      for (const hx of [-0.75, 0.75]) {
        const hl = new THREE.Mesh(headGeo, headlightMat);
        hl.position.set(hx, 0.82, type === 'van' ? 2.92 : 2.3);
        carGroup.add(hl);
      }

      // Taillights at rear (-Z)
      const tailGeo = new THREE.BoxGeometry(0.35, 0.16, 0.08);
      for (const tx of [-0.75, 0.75]) {
        const tl = new THREE.Mesh(tailGeo, taillightMat.clone());
        tl.position.set(tx, 0.82, type === 'van' ? -2.82 : -2.3);
        carGroup.add(tl);
        taillights.push(tl);
      }

      // Amber Blinkers
      const blinkGeo = new THREE.BoxGeometry(0.12, 0.1, 0.12);
      const bLeftF = new THREE.Mesh(blinkGeo, blinkerMat.clone());
      bLeftF.position.set(-1.0, 0.82, 2.2);
      bLeftF.visible = false;
      carGroup.add(bLeftF);
      leftBlinkers.push(bLeftF);

      const bLeftR = new THREE.Mesh(blinkGeo, blinkerMat.clone());
      bLeftR.position.set(-1.0, 0.82, -2.2);
      bLeftR.visible = false;
      carGroup.add(bLeftR);
      leftBlinkers.push(bLeftR);

      const bRightF = new THREE.Mesh(blinkGeo, blinkerMat.clone());
      bRightF.position.set(1.0, 0.82, 2.2);
      bRightF.visible = false;
      carGroup.add(bRightF);
      rightBlinkers.push(bRightF);

      const bRightR = new THREE.Mesh(blinkGeo, blinkerMat.clone());
      bRightR.position.set(1.0, 0.82, -2.2);
      bRightR.visible = false;
      carGroup.add(bRightR);
      rightBlinkers.push(bRightR);

      return {
        carGroup,
        wheels,
        isPolice,
        policeBeacons,
        taillights,
        leftBlinkers,
        rightBlinkers,
        isGlb: false,
      };
    };

    // Fleet configuration
    const vehicleTypes: ('taxi' | 'police' | 'sedan' | 'van')[] = [
      'taxi',
      'sedan',
      'taxi',
      'police',
      'sedan',
      'van',
      'taxi',
      'sedan',
    ];
    let typeIndex = 0;

    // 1. Vehicles along Avenues (North-South)
    avenues.forEach((ax, aIdx) => {
      for (const dir of [-1, 1]) {
        const laneX = ax + (dir > 0 ? this.laneOffset : -this.laneOffset);
        const countOnAvenue = 2;

        for (let c = 0; c < countOnAvenue; c++) {
          const vType = vehicleTypes[typeIndex++ % vehicleTypes.length];
          const { carGroup, wheels, isPolice, policeBeacons, taillights, leftBlinkers, rightBlinkers, isGlb } =
            createVehicleMesh(vType);

          const startZ = -380 + ((c * 380 + aIdx * 75) % 760);
          carGroup.position.set(laneX, 0, startZ);
          // When dir = 1, front faces +Z (rotation 0)
          // When dir = -1, front faces -Z (rotation Math.PI)
          carGroup.rotation.y = dir > 0 ? 0 : Math.PI;

          this.group.add(carGroup);

          const speed = 13.0 + Math.random() * 6.0;

          this.vehicles.push({
            group: carGroup,
            wheels,
            isPolice,
            policeBeacons,
            taillights,
            leftBlinkers,
            rightBlinkers,
            axis: 'z',
            direction: dir,
            cruiseSpeed: speed,
            currentSpeed: speed,
            laneCoord: laneX,
            minBound: -440,
            maxBound: 440,
            isGlb: Boolean(isGlb),
            vehicleType: vType,
            plannedTurn: 'straight',
          });
        }
      }
    });

    // 2. Vehicles along Cross-Streets (East-West)
    streets.forEach((sz, sIdx) => {
      for (const dir of [-1, 1]) {
        const laneZ = sz + (dir > 0 ? -this.laneOffset : this.laneOffset);
        const countOnStreet = 2;

        for (let c = 0; c < countOnStreet; c++) {
          const vType = vehicleTypes[typeIndex++ % vehicleTypes.length];
          const { carGroup, wheels, isPolice, policeBeacons, taillights, leftBlinkers, rightBlinkers, isGlb } =
            createVehicleMesh(vType);

          const startX = -380 + ((c * 380 + sIdx * 90) % 760);
          carGroup.position.set(startX, 0, laneZ);
          // When dir = 1, front faces +X (rotation Math.PI / 2)
          // When dir = -1, front faces -X (rotation -Math.PI / 2)
          carGroup.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;

          this.group.add(carGroup);

          const speed = 13.0 + Math.random() * 6.0;

          this.vehicles.push({
            group: carGroup,
            wheels,
            isPolice,
            policeBeacons,
            taillights,
            leftBlinkers,
            rightBlinkers,
            axis: 'x',
            direction: dir,
            cruiseSpeed: speed,
            currentSpeed: speed,
            laneCoord: laneZ,
            minBound: -440,
            maxBound: 440,
            isGlb: Boolean(isGlb),
            vehicleType: vType,
            plannedTurn: 'straight',
          });
        }
      }
    });

    // 3. Parked vehicles along curbs
    avenues.forEach((ax, aIdx) => {
      for (let z = -320; z <= 320; z += 90) {
        if (streets.some((sz) => Math.abs(z - sz) < 30)) continue;
        const side = (aIdx + z) % 2 === 0 ? 1 : -1;
        const curbX = ax + side * 11.5;

        const vType: 'taxi' | 'sedan' = Math.random() > 0.4 ? 'taxi' : 'sedan';
        const { carGroup } = createVehicleMesh(vType);
        carGroup.position.set(curbX, 0, z);
        carGroup.rotation.y = side > 0 ? 0 : Math.PI;
        this.group.add(carGroup);
      }
    });
  }

  /**
   * Main simulation step: updates traffic light phases, car braking, turn execution, and steering
   */
  public update(dt: number) {
    this.globalTrafficTime += dt;
    this.policeLightTimer += dt * 8.0;
    this.blinkerTimer += dt * 7.0;

    const policeFlash = Math.sin(this.policeLightTimer) > 0;
    const blinkerFlash = Math.sin(this.blinkerTimer) > 0;

    // 1. Update visual signals on all physical 3D Traffic Light posts
    this.updateTrafficLightsVisuals();

    // 2. Update each moving vehicle
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];

      // A) If vehicle is currently in the middle of executing a turn at an intersection
      if (v.turnState && v.turnState.isTurning) {
        this.updateTurningVehicle(v, dt, blinkerFlash);
        continue;
      }

      // B) Normal straight-lane driving: check upcoming intersection, traffic lights, and car following
      this.updateCruisingVehicle(v, dt, blinkerFlash, policeFlash, i);
    }
  }

  /**
   * Updates physical 3D Traffic Light post bulb colors
   */
  private updateTrafficLightsVisuals() {
    const unlitColor = 0x1f2937;
    const redColor = 0xef4444;
    const yellowColor = 0xf59e0b;
    const greenColor = 0x10b981;

    for (let p = 0; p < this.trafficLightPosts.length; p++) {
      const post = this.trafficLightPosts[p];

      const nsSignal = this.getLightState(post.intersectionX, post.intersectionZ, 'z');
      const ewSignal = this.getLightState(post.intersectionX, post.intersectionZ, 'x');

      // Avenue (North-South) dual-faced heads
      const nsRColor = nsSignal === 'red' ? redColor : unlitColor;
      const nsYColor = nsSignal === 'yellow' ? yellowColor : unlitColor;
      const nsGColor = nsSignal === 'green' ? greenColor : unlitColor;

      post.avenueLenses.red.forEach((m) => {
        (m.material as THREE.MeshBasicMaterial).color.setHex(nsRColor);
      });
      post.avenueLenses.yellow.forEach((m) => {
        (m.material as THREE.MeshBasicMaterial).color.setHex(nsYColor);
      });
      post.avenueLenses.green.forEach((m) => {
        (m.material as THREE.MeshBasicMaterial).color.setHex(nsGColor);
      });

      // Street (East-West) dual-faced heads
      const ewRColor = ewSignal === 'red' ? redColor : unlitColor;
      const ewYColor = ewSignal === 'yellow' ? yellowColor : unlitColor;
      const ewGColor = ewSignal === 'green' ? greenColor : unlitColor;

      post.streetLenses.red.forEach((m) => {
        (m.material as THREE.MeshBasicMaterial).color.setHex(ewRColor);
      });
      post.streetLenses.yellow.forEach((m) => {
        (m.material as THREE.MeshBasicMaterial).color.setHex(ewYColor);
      });
      post.streetLenses.green.forEach((m) => {
        (m.material as THREE.MeshBasicMaterial).color.setHex(ewGColor);
      });
    }
  }

  /**
   * Handles vehicle currently steering through a curve turn at an intersection
   */
  private updateTurningVehicle(v: Vehicle, dt: number, blinkerFlash: boolean) {
    const ts = v.turnState!;
    ts.elapsed += dt;
    const progress = Math.min(1.0, ts.elapsed / ts.turnDuration);

    // Evaluate Bézier position & heading tangent
    const currentPos = cubicBezier(ts.p0, ts.p1, ts.p2, ts.p3, progress);
    const tangent = cubicBezierDerivative(ts.p0, ts.p1, ts.p2, ts.p3, progress);

    v.group.position.x = currentPos.x;
    v.group.position.z = currentPos.z;

    // Smooth heading angle matching the instantaneous trajectory
    const heading = Math.atan2(tangent.x, tangent.z);
    v.group.rotation.y = heading;

    // Wheels roll smoothly
    const turnSpeed = 8.5;
    const rollAngle = (turnSpeed / 0.38) * dt;
    for (let j = 0; j < v.wheels.length; j++) {
      v.wheels[j].rotation.x += rollAngle;
    }

    // Flash turn blinkers on the turning side
    if (ts.turnDirection === 'left' && v.leftBlinkers) {
      v.leftBlinkers.forEach((b) => (b.visible = blinkerFlash));
    } else if (ts.turnDirection === 'right' && v.rightBlinkers) {
      v.rightBlinkers.forEach((b) => (b.visible = blinkerFlash));
    }

    // When turn completes: transition onto the new road axis & lane!
    if (progress >= 1.0) {
      v.axis = ts.toAxis;
      v.direction = ts.toDir;
      v.laneCoord = ts.toLaneCoord;

      // Snap exact final position & orientation on destination lane
      if (v.axis === 'z') {
        v.group.position.x = v.laneCoord;
        v.group.rotation.y = v.direction > 0 ? 0 : Math.PI;
      } else {
        v.group.position.z = v.laneCoord;
        v.group.rotation.y = v.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      // Reset blinkers and turn state
      if (v.leftBlinkers) v.leftBlinkers.forEach((b) => (b.visible = false));
      if (v.rightBlinkers) v.rightBlinkers.forEach((b) => (b.visible = false));
      v.plannedTurn = 'straight';
      v.turnState = undefined;
      v.currentSpeed = v.cruiseSpeed * 0.75;
    }
  }

  /**
   * Handles vehicle cruising straight: intersection detection, red light stopping, and car-following
   */
  private updateCruisingVehicle(
    v: Vehicle,
    dt: number,
    blinkerFlash: boolean,
    policeFlash: boolean,
    vehicleIndex: number
  ) {
    const isZ = v.axis === 'z';
    const currentCoord = isZ ? v.group.position.z : v.group.position.x;
    const perpendicularCoord = isZ ? v.group.position.x : v.group.position.z;

    // Find next intersection along current travel direction
    const crossRoads = isZ ? this.streets : this.avenues;
    let nextCrossCoord: number | null = null;
    let minForwardDist = Infinity;

    for (let k = 0; k < crossRoads.length; k++) {
      const coord = crossRoads[k];
      const dist = (coord - currentCoord) * v.direction;
      if (dist > -11.0 && dist < minForwardDist) {
        minForwardDist = dist;
        nextCrossCoord = coord;
      }
    }

    let targetSpeed = v.cruiseSpeed;
    let isBraking = false;

    if (nextCrossCoord !== null) {
      const intersectionX = isZ ? perpendicularCoord : nextCrossCoord;
      const intersectionZ = isZ ? nextCrossCoord : perpendicularCoord;
      const intersectionKey = `${Math.round(intersectionX)}_${Math.round(intersectionZ)}`;

      const distToCenter = (nextCrossCoord - currentCoord) * v.direction;
      const stopLineDist = distToCenter - 14.2; // Stop line is 14.2m before intersection center

      const lightSignal = this.getLightState(intersectionX, intersectionZ, v.axis);

      // --- 1. Turn Decision Preparation ---
      // When approaching intersection (between 14m and 28m away), pick turn intention if not chosen yet
      if (distToCenter > 13.0 && distToCenter < 30.0 && v.lastIntersectionKey !== intersectionKey) {
        v.lastIntersectionKey = intersectionKey;

        // Choose path: 30% Turn Right, 25% Turn Left, 45% Straight
        const roll = Math.random();
        if (roll < 0.3) {
          v.plannedTurn = 'right';
        } else if (roll < 0.55) {
          v.plannedTurn = 'left';
        } else {
          v.plannedTurn = 'straight';
        }

        // Verify that the destination road exists in our network
        if (v.plannedTurn !== 'straight') {
          const destList = isZ ? this.avenues : this.streets;
          // Destination axis is perpendicular
          const canTurn = destList.length > 1;
          if (!canTurn) v.plannedTurn = 'straight';
        }
      }

      // Blink turn signals when turn is planned
      if (v.plannedTurn === 'left' && v.leftBlinkers) {
        v.leftBlinkers.forEach((b) => (b.visible = blinkerFlash));
      } else if (v.plannedTurn === 'right' && v.rightBlinkers) {
        v.rightBlinkers.forEach((b) => (b.visible = blinkerFlash));
      }

      // --- 2. Traffic Light Stopping Logic ---
      if (lightSignal === 'red' || (lightSignal === 'yellow' && stopLineDist > 4.0)) {
        if (stopLineDist > 0 && stopLineDist < 30.0) {
          // Smooth deceleration to stop before crosswalk
          const brakeFactor = Math.max(0, (stopLineDist - 1.2) / 22.0);
          targetSpeed = Math.min(targetSpeed, v.cruiseSpeed * brakeFactor);
          isBraking = true;
          if (stopLineDist < 1.4) {
            targetSpeed = 0;
          }
        }
      }

      // --- 3. Initiate Turn When Entering Intersection on Green ---
      if (
        v.plannedTurn !== 'straight' &&
        distToCenter <= 11.2 &&
        distToCenter >= 5.0 &&
        lightSignal === 'green'
      ) {
        this.initiateTurn(v, intersectionX, intersectionZ, nextCrossCoord);
        return;
      }
    }

    // --- 4. Car-Following Safety (Don't ram car ahead when stopped or driving) ---
    for (let o = 0; o < this.vehicles.length; o++) {
      if (o === vehicleIndex) continue;
      const other = this.vehicles[o];

      // Same axis and direction and on same lane
      if (other.axis === v.axis && other.direction === v.direction) {
        if (Math.abs(other.laneCoord - v.laneCoord) < 2.0) {
          const forwardDist =
            (isZ ? other.group.position.z - v.group.position.z : other.group.position.x - v.group.position.x) *
            v.direction;

          if (forwardDist > 0 && forwardDist < 18.0) {
            isBraking = true;
            if (forwardDist < 7.2) {
              targetSpeed = 0;
            } else {
              targetSpeed = Math.min(targetSpeed, other.currentSpeed * 0.85);
            }
          }
        }
      }
    }

    // --- 5. Apply Acceleration / Deceleration ---
    if (v.currentSpeed > targetSpeed) {
      v.currentSpeed = Math.max(targetSpeed, v.currentSpeed - 16.0 * dt);
      isBraking = true;
    } else if (v.currentSpeed < targetSpeed) {
      v.currentSpeed = Math.min(targetSpeed, v.currentSpeed + 7.5 * dt);
    }

    // Taillights brighten when braking or stopped
    v.isBraking = isBraking || v.currentSpeed < 1.0;
    if (v.taillights) {
      v.taillights.forEach((t) => {
        const mat = t.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = v.isBraking ? 1.8 : 0.45;
      });
    }

    // --- 6. Advance Vehicle Position Along Travel Axis ---
    const moveStep = v.direction * v.currentSpeed * dt;
    if (isZ) {
      v.group.position.z += moveStep;
      if (v.direction > 0 && v.group.position.z > v.maxBound) {
        v.group.position.z = v.minBound;
      } else if (v.direction < 0 && v.group.position.z < v.minBound) {
        v.group.position.z = v.maxBound;
      }
    } else {
      v.group.position.x += moveStep;
      if (v.direction > 0 && v.group.position.x > v.maxBound) {
        v.group.position.x = v.minBound;
      } else if (v.direction < 0 && v.group.position.x < v.minBound) {
        v.group.position.x = v.maxBound;
      }
    }

    // Forward wheel rolling
    const rollAngle = (v.currentSpeed / 0.38) * dt;
    for (let j = 0; j < v.wheels.length; j++) {
      v.wheels[j].rotation.x += rollAngle;
    }

    // Flash police sirens
    if (v.isPolice && v.policeBeacons) {
      v.policeBeacons.red.visible = policeFlash;
      v.policeBeacons.blue.visible = !policeFlash;
    }
  }

  /**
   * Initializes a smooth cubic Bézier turn curve onto the cross street
   */
  private initiateTurn(
    v: Vehicle,
    intersectionX: number,
    intersectionZ: number,
    nextCrossCoord: number
  ) {
    const isZ = v.axis === 'z';
    const isRight = v.plannedTurn === 'right';

    let toAxis: 'x' | 'z';
    let toDir: number;
    let toLaneCoord: number;

    const p0 = new THREE.Vector3(v.group.position.x, 0, v.group.position.z);
    let t0: THREE.Vector3;
    let p3: THREE.Vector3;
    let t1: THREE.Vector3;

    if (isZ) {
      // Coming North (+Z) or South (-Z) along Avenue
      t0 = new THREE.Vector3(0, 0, v.direction);
      toAxis = 'x';

      if (v.direction > 0) {
        // Northbound: Right turn goes East (+X), Left turn goes West (-X)
        toDir = isRight ? 1 : -1;
      } else {
        // Southbound: Right turn goes West (-X), Left turn goes East (+X)
        toDir = isRight ? -1 : 1;
      }

      toLaneCoord = nextCrossCoord + (toDir > 0 ? -this.laneOffset : this.laneOffset);
      const exitX = intersectionX + toDir * 11.2;
      p3 = new THREE.Vector3(exitX, 0, toLaneCoord);
      t1 = new THREE.Vector3(toDir, 0, 0);
    } else {
      // Coming East (+X) or West (-X) along Street
      t0 = new THREE.Vector3(v.direction, 0, 0);
      toAxis = 'z';

      if (v.direction > 0) {
        // Eastbound: Right turn goes South (-Z), Left turn goes North (+Z)
        toDir = isRight ? -1 : 1;
      } else {
        // Westbound: Right turn goes North (+Z), Left turn goes South (-Z)
        toDir = isRight ? 1 : -1;
      }

      toLaneCoord = nextCrossCoord + (toDir > 0 ? this.laneOffset : -this.laneOffset);
      const exitZ = intersectionZ + toDir * 11.2;
      p3 = new THREE.Vector3(toLaneCoord, 0, exitZ);
      t1 = new THREE.Vector3(0, 0, toDir);
    }

    // Bézier tangent distance scale (short arc for right turn, wide arc for left turn)
    const d = isRight ? 5.8 : 12.5;
    const p1 = new THREE.Vector3().copy(p0).addScaledVector(t0, d);
    const p2 = new THREE.Vector3().copy(p3).addScaledVector(t1, -d);

    const turnDuration = isRight ? 1.35 : 2.2;

    v.turnState = {
      isTurning: true,
      turnDirection: isRight ? 'right' : 'left',
      p0,
      p1,
      p2,
      p3,
      fromAxis: v.axis,
      fromDir: v.direction,
      toAxis,
      toDir,
      toLaneCoord,
      intersectionX,
      intersectionZ,
      turnDuration,
      elapsed: 0,
    };
  }

  /**
   * Returns 3D bounding box colliders for traffic collision detection
   */
  public getColliders(): { box: THREE.Box3; isMoving: boolean }[] {
    const list: { box: THREE.Box3; isMoving: boolean }[] = [];
    const carHeight = 1.6;

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const pos = v.group.position;
      const isZ = v.axis === 'z';
      const halfLen = 2.35;
      const halfW = 1.1;

      const minX = isZ ? pos.x - halfW : pos.x - halfLen;
      const maxX = isZ ? pos.x + halfW : pos.x + halfLen;
      const minZ = isZ ? pos.z - halfLen : pos.z - halfW;
      const maxZ = isZ ? pos.z + halfLen : pos.z + halfW;

      list.push({
        box: new THREE.Box3(
          new THREE.Vector3(minX, 0, minZ),
          new THREE.Vector3(maxX, carHeight, maxZ)
        ),
        isMoving: v.currentSpeed > 0.5,
      });
    }

    return list;
  }
}
