import * as THREE from 'three';
import { PhysicsConfig, TelemetryData } from '../types/physics';
import { BuildingData } from '../city/cityGenerator';
import { soundEngine } from '../audio/soundEngine';

export interface PlayerInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  reelIn: boolean;
  fireWeb: boolean;
  releaseWeb: boolean;
}

export class SwingPhysics {
  // State
  public position: THREE.Vector3 = new THREE.Vector3(0, 45, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 18);
  public isAttached: boolean = false;
  public anchorPoint: THREE.Vector3 | null = null;
  public ropeLength: number = 0;
  public targetRopeLength: number = 0;

  // Collision state
  public isOnGround: boolean = false;
  public isOnRoof: boolean = false;
  public isWallSliding: boolean = false;
  public wallNormal: THREE.Vector3 = new THREE.Vector3();

  // Metrics & Game feel
  public streakCount: number = 0;
  public groundlessDistance: number = 0;
  public bestGroundlessDistance: number = 0;
  private lastPositionForDist: THREE.Vector3 = new THREE.Vector3();
  private lastReleaseTime: number = 0;
  private attachStartTime: number = 0;
  private hasBoostedThisSwing: boolean = false;

  // Vectors for telemetry & STEM visualization
  public tensionVector: THREE.Vector3 = new THREE.Vector3();
  public gravityVector: THREE.Vector3 = new THREE.Vector3();
  public netForceVector: THREE.Vector3 = new THREE.Vector3();
  public predictedTrajectory: THREE.Vector3[] = [];

  // Temporary math helpers to prevent GC allocations
  private _radialVec: THREE.Vector3 = new THREE.Vector3();
  private _tangentVec: THREE.Vector3 = new THREE.Vector3();
  private _up: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private _tempVec: THREE.Vector3 = new THREE.Vector3();

  public hasAirZipped: boolean = false;
  private prevJumpInput: boolean = false;

  constructor(public config: PhysicsConfig) {
    this.lastPositionForDist.copy(this.position);
  }

  public reset(spawnPos: THREE.Vector3 = new THREE.Vector3(0, 60, 0)) {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 15);
    this.isAttached = false;
    this.anchorPoint = null;
    this.ropeLength = 0;
    this.targetRopeLength = 0;
    this.isOnGround = false;
    this.isOnRoof = false;
    this.isWallSliding = false;
    this.streakCount = 0;
    this.groundlessDistance = 0;
    this.lastPositionForDist.copy(this.position);
    this.hasBoostedThisSwing = false;
    this.hasAirZipped = false;
    this.prevJumpInput = false;
  }

  public attachWeb(anchor: THREE.Vector3) {
    this.anchorPoint = anchor.clone();
    this.isAttached = true;
    this.attachStartTime = performance.now();
    this.hasBoostedThisSwing = false;
    this.hasAirZipped = false;

    // Initial rope length is distance to anchor
    const dist = this.position.distanceTo(anchor);
    this.ropeLength = Math.max(dist, this.config.minRopeLength);
    this.targetRopeLength = this.ropeLength;

    this.streakCount++;
    soundEngine.playWebShoot();
  }

  public releaseWeb() {
    if (!this.isAttached) return;

    this.isAttached = false;
    const now = performance.now();

    // Check for sweet bottom-of-arc release boost
    if (this.anchorPoint) {
      this._radialVec.subVectors(this.position, this.anchorPoint).normalize();
      // Near bottom of swing: radial vector is pointing mostly straight down (y <= -0.7)
      const isAtArcBottom = this._radialVec.y < -0.65;
      const speed = this.velocity.length();

      if (isAtArcBottom && speed > 10 && !this.hasBoostedThisSwing) {
        // Apply directional release boost
        const boostFactor = this.config.releaseBoost;
        this.velocity.multiplyScalar(boostFactor);
        soundEngine.playBottomBoost();
        this.hasBoostedThisSwing = true;
      } else {
        soundEngine.playWebRelease();
      }
    } else {
      soundEngine.playWebRelease();
    }

    this.anchorPoint = null;
    this.lastReleaseTime = now;
  }

  /**
   * Fixed-timestep physics update with sub-stepping for extreme stability
   */
  public update(
    deltaTime: number,
    input: PlayerInput,
    cameraForward: THREE.Vector3,
    cameraRight: THREE.Vector3,
    buildings: BuildingData[]
  ) {
    // Decoupled sub-stepping: divide frame into steps of max 0.008s (120 Hz)
    const effectiveDelta = Math.min(deltaTime * this.config.timeScale, 0.08);
    const subSteps = Math.max(1, Math.ceil(effectiveDelta / 0.008));
    const dt = effectiveDelta / subSteps;

    const jumpTriggered = Boolean(input.jump && !this.prevJumpInput);

    for (let step = 0; step < subSteps; step++) {
      this.subStep(dt, input, cameraForward, cameraRight, buildings, step === 0 && jumpTriggered);
    }

    // Save jump input state for edge-triggered leap detection
    this.prevJumpInput = Boolean(input.jump);

    // Update groundless distance tracking
    if (!this.isOnGround && !this.isOnRoof) {
      const horizontalDist = Math.hypot(
        this.position.x - this.lastPositionForDist.x,
        this.position.z - this.lastPositionForDist.z
      );
      this.groundlessDistance += horizontalDist;
      if (this.groundlessDistance > this.bestGroundlessDistance) {
        this.bestGroundlessDistance = this.groundlessDistance;
      }
    } else {
      // Landed
      this.groundlessDistance = 0;
      this.streakCount = 0;
    }
    this.lastPositionForDist.copy(this.position);

    // Compute trajectory prediction for visualization
    this.computePredictedTrajectory();
  }

  private subStep(
    dt: number,
    input: PlayerInput,
    cameraForward: THREE.Vector3,
    cameraRight: THREE.Vector3,
    buildings: BuildingData[],
    jumpTriggered: boolean
  ) {
    // 1. Gravity Force Vector
    this.gravityVector.set(0, -this.config.gravity * this.config.playerMass, 0);

    // 2. Attached Pendulum Physics
    if (this.isAttached && this.anchorPoint) {
      // Reel in / shorten rope length when input active
      if (input.reelIn || input.forward) {
        this.targetRopeLength = Math.max(
          this.config.minRopeLength,
          this.targetRopeLength - this.config.reelSpeed * dt
        );
      }
      this.ropeLength = THREE.MathUtils.lerp(this.ropeLength, this.targetRopeLength, 0.2);

      this._radialVec.subVectors(this.position, this.anchorPoint);
      const currentDist = this._radialVec.length();

      if (currentDist > 0.001) {
        this._radialVec.divideScalar(currentDist); // Normalized radial unit vector r_hat

        // Project velocity onto radial direction
        const vRadial = this.velocity.dot(this._radialVec);

        // When taut (distance >= target rope length):
        if (currentDist >= this.ropeLength) {
          // Hard constraint: remove outward radial velocity
          if (vRadial > 0) {
            this.velocity.addScaledVector(this._radialVec, -vRadial);
          }

          // Centripetal acceleration required to stay on circular arc:
          // a_c = (v_t^2 / R) * (-r_hat)
          const tangentialSpeedSq = this.velocity.lengthSq();
          const centripetalMag = (this.config.playerMass * tangentialSpeedSq) / this.ropeLength;

          // Gravity component along the rope tension:
          const gravityRadialMag = Math.max(0, -this.gravityVector.dot(this._radialVec));

          // Total tension force pulling towards anchor (for telemetry and STEM vector visualization):
          const totalTensionMag = (centripetalMag + gravityRadialMag) * this.config.ropeStiffness;
          this.tensionVector.copy(this._radialVec).multiplyScalar(-totalTensionMag);

          // Position projection strictly enforces the constraint boundary with zero jitter
          const maxAllowedDist = this.ropeLength;
          if (currentDist > maxAllowedDist) {
            this.position.copy(this.anchorPoint).addScaledVector(this._radialVec, maxAllowedDist);
          }

          // Conservation of angular momentum spin-up during reel-in:
          if ((input.reelIn || input.forward) && currentDist > this.config.minRopeLength + 1) {
            const reelAngularFactor = 1.0 + (this.config.reelSpeed * dt) / this.ropeLength;
            this.velocity.multiplyScalar(Math.min(reelAngularFactor, 1.04));
          }
        } else {
          // Slack rope: no tension applied
          this.tensionVector.set(0, 0, 0);
        }
      }

      // Lateral steering swing control: Player can pump the swing or steer left/right
      const steerForce = 14.0;
      if (input.left) {
        this.velocity.addScaledVector(cameraRight, -steerForce * dt);
      }
      if (input.right) {
        this.velocity.addScaledVector(cameraRight, steerForce * dt);
      }

      // Jump while attached = SUPER JUMP RELEASE!
      if (jumpTriggered) {
        const swingDir = this.velocity.clone().normalize();
        this.releaseWeb();
        this.velocity.y = Math.max(this.velocity.y + 11.0, 16.0);
        this.velocity.addScaledVector(swingDir, 10.0);
        soundEngine.playJump();
        this.hasAirZipped = false;
      }
    } else {
      this.tensionVector.set(0, 0, 0);

      // Aerial glide / aerial steering when free falling
      if (!this.isOnGround && !this.isOnRoof) {
        const aerialSteerForce = 12.0;
        const flatForward = this._tempVec.set(cameraForward.x, 0, cameraForward.z).normalize();
        if (input.forward) this.velocity.addScaledVector(flatForward, aerialSteerForce * dt);
        if (input.backward) this.velocity.addScaledVector(flatForward, -aerialSteerForce * dt);
        if (input.left) this.velocity.addScaledVector(cameraRight, -aerialSteerForce * dt);
        if (input.right) this.velocity.addScaledVector(cameraRight, aerialSteerForce * dt);

        // Mid-air Web Zip / Double Leap
        if (jumpTriggered && !this.hasAirZipped) {
          this.hasAirZipped = true;
          this.velocity.addScaledVector(flatForward, 18.0);
          this.velocity.y = Math.max(this.velocity.y + 6.0, 8.0);
          soundEngine.playJump();
        }
      } else {
        // Ground / Rooftop movement
        const moveSpeed = 16.0;
        const flatForward = this._tempVec.set(cameraForward.x, 0, cameraForward.z).normalize();
        this.velocity.x *= 0.88;
        this.velocity.z *= 0.88;

        if (input.forward) this.velocity.addScaledVector(flatForward, moveSpeed * 3 * dt);
        if (input.backward) this.velocity.addScaledVector(flatForward, -moveSpeed * 3 * dt);
        if (input.left) this.velocity.addScaledVector(cameraRight, -moveSpeed * 3 * dt);
        if (input.right) this.velocity.addScaledVector(cameraRight, moveSpeed * 3 * dt);

        // Ground / Rooftop Superhero Launch Jump
        if (jumpTriggered) {
          this.velocity.y = 22.0; // High superhero vertical leap
          if (input.forward) this.velocity.addScaledVector(flatForward, 10.0);
          if (input.backward) this.velocity.addScaledVector(flatForward, -10.0);
          if (input.left) this.velocity.addScaledVector(cameraRight, -10.0);
          if (input.right) this.velocity.addScaledVector(cameraRight, 10.0);
          this.isOnGround = false;
          this.isOnRoof = false;
          this.hasAirZipped = false;
          soundEngine.playJump();
        }
      }
    }

    // 3. Gravity Acceleration
    this.velocity.y -= this.config.gravity * dt;

    // 4. Aerodynamic Drag (Quadratic air resistance)
    const currentSpeed = this.velocity.length();
    if (currentSpeed > 0.1) {
      const dragMag = this.config.airDrag * currentSpeed * currentSpeed * dt;
      const speedReduction = Math.max(0, currentSpeed - dragMag);
      this.velocity.multiplyScalar(speedReduction / currentSpeed);
    }

    // Clamp to terminal velocity
    if (this.velocity.length() > this.config.terminalVelocity) {
      this.velocity.setLength(this.config.terminalVelocity);
    }

    // Net force vector calculation
    this.netForceVector.copy(this.gravityVector).add(this.tensionVector);

    // 5. Integrate Position
    this.position.addScaledVector(this.velocity, dt);

    // 6. Collision Resolution with Buildings and Ground
    this.handleCollisions(buildings);
  }

  private handleCollisions(buildings: BuildingData[]) {
    const playerRadius = 0.8;
    const playerHeight = 1.8;
    const playerFeetY = this.position.y - playerHeight / 2;

    this.isOnGround = false;
    this.isOnRoof = false;
    this.isWallSliding = false;

    // Ground floor collision (Street level y = 0)
    if (playerFeetY <= 0) {
      if (this.velocity.y < -4) {
        soundEngine.playLanding();
      }
      this.position.y = playerHeight / 2;
      this.velocity.y = 0;
      this.isOnGround = true;
      this.hasAirZipped = false;

      // Ground friction
      this.velocity.x *= 0.92;
      this.velocity.z *= 0.92;

      if (this.isAttached) {
        this.releaseWeb();
      }
    }

    // Building collisions
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const box = b.box;

      // Quick broad-phase rejection
      if (
        this.position.x < box.min.x - playerRadius ||
        this.position.x > box.max.x + playerRadius ||
        this.position.z < box.min.z - playerRadius ||
        this.position.z > box.max.z + playerRadius ||
        this.position.y < box.min.y ||
        this.position.y > box.max.y + playerHeight
      ) {
        continue;
      }

      // Check rooftop landing
      const isAboveRoof = this.position.y >= box.max.y;
      if (isAboveRoof && playerFeetY <= box.max.y + 0.3) {
        if (this.velocity.y < -4) {
          soundEngine.playLanding();
        }
        this.position.y = box.max.y + playerHeight / 2;
        this.velocity.y = 0;
        this.isOnRoof = true;
        this.hasAirZipped = false;
        this.velocity.x *= 0.94;
        this.velocity.z *= 0.94;
        return;
      }

      // Wall penetration resolution
      const dxMin = Math.abs(this.position.x - box.min.x);
      const dxMax = Math.abs(this.position.x - box.max.x);
      const dzMin = Math.abs(this.position.z - box.min.z);
      const dzMax = Math.abs(this.position.z - box.max.z);

      const minPenetration = Math.min(dxMin, dxMax, dzMin, dzMax);

      if (minPenetration === dxMin) {
        this.position.x = box.min.x - playerRadius;
        this.wallNormal.set(-1, 0, 0);
        if (this.velocity.x > 0) this.velocity.x = 0;
      } else if (minPenetration === dxMax) {
        this.position.x = box.max.x + playerRadius;
        this.wallNormal.set(1, 0, 0);
        if (this.velocity.x < 0) this.velocity.x = 0;
      } else if (minPenetration === dzMin) {
        this.position.z = box.min.z - playerRadius;
        this.wallNormal.set(0, 0, -1);
        if (this.velocity.z > 0) this.velocity.z = 0;
      } else {
        this.position.z = box.max.z + playerRadius;
        this.wallNormal.set(0, 0, 1);
        if (this.velocity.z < 0) this.velocity.z = 0;
      }

      this.isWallSliding = true;
      // Slight wall friction
      this.velocity.y *= 0.98;
    }
  }

  /**
   * Fast trajectory simulation for STEM visualization mode (predicted next 1.5 seconds)
   */
  private computePredictedTrajectory() {
    this.predictedTrajectory = [];
    const simPos = this.position.clone();
    const simVel = this.velocity.clone();
    const simDt = 0.05;
    const simSteps = 24;

    for (let i = 0; i < simSteps; i++) {
      if (this.isAttached && this.anchorPoint) {
        const rad = new THREE.Vector3().subVectors(simPos, this.anchorPoint);
        const d = rad.length();
        if (d >= this.ropeLength && d > 0.001) {
          rad.normalize();
          const vr = simVel.dot(rad);
          if (vr > 0) simVel.addScaledVector(rad, -vr);
          const centripetalAcc = simVel.lengthSq() / this.ropeLength;
          simVel.addScaledVector(rad, -centripetalAcc * simDt);
        }
      }
      simVel.y -= this.config.gravity * simDt;
      simPos.addScaledVector(simVel, simDt);

      if (simPos.y <= 0.5) {
        simPos.y = 0.5;
        this.predictedTrajectory.push(simPos.clone());
        break;
      }
      this.predictedTrajectory.push(simPos.clone());
    }
  }

  public getTelemetry(fps: number, hasTargetLock: boolean, currentAnchorDist: number): TelemetryData {
    const speedMps = this.velocity.length();
    const speedMph = speedMps * 2.23694;
    const altitude = Math.max(0, this.position.y);
    const ropeLen = this.isAttached && this.anchorPoint ? this.position.distanceTo(this.anchorPoint) : 0;

    const kinetic = 0.5 * this.config.playerMass * speedMps * speedMps;
    const potential = this.config.playerMass * this.config.gravity * altitude;
    const total = kinetic + potential;

    return {
      speedMps,
      speedMph,
      altitude,
      ropeLength: ropeLen,
      tensionForce: this.tensionVector.length(),
      gravityForce: this.gravityVector.length(),
      kineticEnergy: kinetic,
      potentialEnergy: potential,
      totalEnergy: total,
      fps,
      isAttached: this.isAttached,
      isOnGround: this.isOnGround || this.isOnRoof,
      streakCount: this.streakCount,
      groundlessDistance: Math.round(this.groundlessDistance),
      bestGroundlessDistance: Math.round(this.bestGroundlessDistance),
      currentAnchorDistance: Math.round(currentAnchorDist),
      hasTargetLock,
    };
  }
}
