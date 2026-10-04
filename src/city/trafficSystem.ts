import * as THREE from 'three';

export interface Vehicle {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  isPolice?: boolean;
  policeBeacons?: { red: THREE.Mesh; blue: THREE.Mesh };
  axis: 'x' | 'z';
  direction: number; // 1 or -1
  speed: number;
  laneCoord: number; // constant coordinate on perpendicular axis
  minBound: number;
  maxBound: number;
}

export interface TrafficOptions {
  timeOfDay: 'sunset' | 'night' | 'day' | 'foggy';
  avenues: number[];
  streets: number[];
}

export class TrafficSystem {
  public group: THREE.Group;
  private vehicles: Vehicle[] = [];
  private policeLightTimer = 0;

  constructor(options: TrafficOptions) {
    this.group = new THREE.Group();
    this.group.name = 'TrafficSystemGroup';
    this.initVehicles(options);
  }

  private initVehicles(options: TrafficOptions) {
    const { avenues, streets } = options;

    // Shared materials
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

    const headlightMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
    });

    const taillightMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
    });

    const taxiSignMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
    });

    const policeRedBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const policeBlueBeaconMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

    // Helper: Create 4 wheels
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

    // Helper: Create Vehicle mesh
    const createVehicleMesh = (type: 'taxi' | 'police' | 'sedan' | 'van') => {
      const carGroup = new THREE.Group();
      let wheels: THREE.Mesh[] = [];
      let policeBeacons: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;

      const isPolice = type === 'police';

      if (type === 'van') {
        // Delivery Box Van
        const cabGeo = new THREE.BoxGeometry(2.3, 1.6, 2.2);
        const vanBodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
        const cab = new THREE.Mesh(cabGeo, vanBodyMat);
        cab.position.set(0, 1.25, 1.8);
        carGroup.add(cab);

        const boxGeo = new THREE.BoxGeometry(2.4, 2.2, 3.8);
        const box = new THREE.Mesh(boxGeo, vanBodyMat);
        box.position.set(0, 1.55, -0.9);
        carGroup.add(box);

        // Windshield
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

        // Lower chassis
        const chassisGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
        const chassis = new THREE.Mesh(chassisGeo, mainBodyMat);
        chassis.position.y = 0.75;
        chassis.castShadow = true;
        carGroup.add(chassis);

        // Cabin roof & windows
        const cabinLength = 2.4;
        const cabinWidth = 1.85;
        const cabinHeight = 0.78;
        const cabinGeo = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
        const cabin = new THREE.Mesh(cabinGeo, windowGlassMat);
        cabin.position.set(0, 1.5, -0.15);
        carGroup.add(cabin);

        // Roof cap
        const roofCapGeo = new THREE.BoxGeometry(cabinWidth * 0.95, 0.08, cabinLength * 0.95);
        const roofCap = new THREE.Mesh(roofCapGeo, mainBodyMat);
        roofCap.position.set(0, 1.9, -0.15);
        carGroup.add(roofCap);

        if (type === 'taxi') {
          // Yellow roof taxi light
          const signGeo = new THREE.BoxGeometry(0.8, 0.22, 0.3);
          const sign = new THREE.Mesh(signGeo, taxiSignMat);
          sign.position.set(0, 2.05, -0.15);
          carGroup.add(sign);
        } else if (type === 'police') {
          // Blue NYPD door stripe
          const stripeGeo = new THREE.BoxGeometry(bodyWidth + 0.02, 0.25, bodyLength * 0.85);
          const stripe = new THREE.Mesh(stripeGeo, policeBlueMat);
          stripe.position.y = 0.75;
          carGroup.add(stripe);

          // Roof light bar with red and blue beacons
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

      // Headlights (front = +Z)
      const headGeo = new THREE.BoxGeometry(0.35, 0.16, 0.08);
      for (const hx of [-0.75, 0.75]) {
        const hl = new THREE.Mesh(headGeo, headlightMat);
        hl.position.set(hx, 0.82, type === 'van' ? 2.92 : 2.3);
        carGroup.add(hl);
      }

      // Taillights (rear = -Z)
      const tailGeo = new THREE.BoxGeometry(0.35, 0.16, 0.08);
      for (const tx of [-0.75, 0.75]) {
        const tl = new THREE.Mesh(tailGeo, taillightMat);
        tl.position.set(tx, 0.82, type === 'van' ? -2.82 : -2.3);
        carGroup.add(tl);
      }

      return { carGroup, wheels, isPolice, policeBeacons };
    };

    // Spawn fleet of driving vehicles along Avenues (N-S)
    const laneOffset = 5.2; // Driving lane offset from avenue center
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

    avenues.forEach((ax, aIdx) => {
      // 2 directions: Southbound (dir = -1) and Northbound (dir = 1)
      for (const dir of [-1, 1]) {
        const laneX = ax + (dir > 0 ? laneOffset : -laneOffset);
        const countOnAvenue = 2;

        for (let c = 0; c < countOnAvenue; c++) {
          const vType = vehicleTypes[typeIndex++ % vehicleTypes.length];
          const { carGroup, wheels, isPolice, policeBeacons } = createVehicleMesh(vType);

          const startZ = -380 + (c * 380 + aIdx * 75) % 760;
          carGroup.position.set(laneX, 0, startZ);
          carGroup.rotation.y = dir > 0 ? 0 : Math.PI;

          this.group.add(carGroup);

          this.vehicles.push({
            group: carGroup,
            wheels,
            isPolice,
            policeBeacons,
            axis: 'z',
            direction: dir,
            speed: 13.0 + Math.random() * 8.0,
            laneCoord: laneX,
            minBound: -430,
            maxBound: 430,
          });
        }
      }
    });

    // Spawn fleet of driving vehicles along Cross-Streets (E-W)
    streets.forEach((sz, sIdx) => {
      for (const dir of [-1, 1]) {
        const laneZ = sz + (dir > 0 ? -laneOffset : laneOffset);
        const countOnStreet = 2;

        for (let c = 0; c < countOnStreet; c++) {
          const vType = vehicleTypes[typeIndex++ % vehicleTypes.length];
          const { carGroup, wheels, isPolice, policeBeacons } = createVehicleMesh(vType);

          const startX = -380 + (c * 380 + sIdx * 90) % 760;
          carGroup.position.set(startX, 0, laneZ);
          carGroup.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;

          this.group.add(carGroup);

          this.vehicles.push({
            group: carGroup,
            wheels,
            isPolice,
            policeBeacons,
            axis: 'x',
            direction: dir,
            speed: 13.0 + Math.random() * 8.0,
            laneCoord: laneZ,
            minBound: -430,
            maxBound: 430,
          });
        }
      }
    });

    // Spawn parked vehicles along curbs
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

  public update(dt: number) {
    this.policeLightTimer += dt * 8.0;
    const policeFlash = Math.sin(this.policeLightTimer) > 0;

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];

      // Move along travel axis
      if (v.axis === 'z') {
        v.group.position.z += v.direction * v.speed * dt;
        if (v.direction > 0 && v.group.position.z > v.maxBound) {
          v.group.position.z = v.minBound;
        } else if (v.direction < 0 && v.group.position.z < v.minBound) {
          v.group.position.z = v.maxBound;
        }
      } else {
        v.group.position.x += v.direction * v.speed * dt;
        if (v.direction > 0 && v.group.position.x > v.maxBound) {
          v.group.position.x = v.minBound;
        } else if (v.direction < 0 && v.group.position.x < v.minBound) {
          v.group.position.x = v.maxBound;
        }
      }

      // Rotate wheels with forward rolling
      const rollAngle = (v.speed / 0.38) * dt;
      for (let j = 0; j < v.wheels.length; j++) {
        v.wheels[j].rotation.x += rollAngle;
      }

      // Flash police sirens
      if (v.isPolice && v.policeBeacons) {
        v.policeBeacons.red.visible = policeFlash;
        v.policeBeacons.blue.visible = !policeFlash;
      }
    }
  }
}
