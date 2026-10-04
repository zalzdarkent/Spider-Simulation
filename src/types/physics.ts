export interface PhysicsConfig {
  gravity: number; // m/s^2 (default 15)
  maxRopeLength: number; // meters (default 90)
  minRopeLength: number; // meters (default 10)
  ropeStiffness: number; // 0.7 - 1.0 (1.0 = perfectly rigid constraint)
  airDrag: number; // drag factor (default 0.002)
  releaseBoost: number; // multiplier at bottom of arc (default 1.35)
  reelSpeed: number; // m/s when pulling in (default 14)
  timeScale: number; // 0.2 - 2.0 (bullet time slow-mo or fast)
  terminalVelocity: number; // m/s (default 85)
  playerMass: number; // kg (default 75)
}

export type PresetName = 'balanced' | 'realistic' | 'low_gravity' | 'hyper_speed';

export const PHYSICS_PRESETS: Record<PresetName, { name: string; description: string; config: PhysicsConfig }> = {
  balanced: {
    name: 'Balanced Hero',
    description: 'Satisfying game feel with responsive arc boosts and fluid momentum chaining.',
    config: {
      gravity: 16.0,
      maxRopeLength: 95,
      minRopeLength: 10,
      ropeStiffness: 0.96,
      airDrag: 0.0018,
      releaseBoost: 1.35,
      reelSpeed: 16.0,
      timeScale: 1.0,
      terminalVelocity: 80,
      playerMass: 75,
    },
  },
  realistic: {
    name: 'Newtonian Pendulum',
    description: 'Strict conservation of energy and real Earth gravity (9.81 m/s²) without artificial boosts.',
    config: {
      gravity: 9.81,
      maxRopeLength: 85,
      minRopeLength: 12,
      ropeStiffness: 1.0,
      airDrag: 0.003,
      releaseBoost: 1.0,
      reelSpeed: 10.0,
      timeScale: 1.0,
      terminalVelocity: 65,
      playerMass: 75,
    },
  },
  low_gravity: {
    name: 'Lunar Float',
    description: 'Reduced gravity for soaring, sky-high pendulum arcs and high hang-time.',
    config: {
      gravity: 6.5,
      maxRopeLength: 120,
      minRopeLength: 15,
      ropeStiffness: 0.94,
      airDrag: 0.0008,
      releaseBoost: 1.45,
      reelSpeed: 18.0,
      timeScale: 1.0,
      terminalVelocity: 90,
      playerMass: 75,
    },
  },
  hyper_speed: {
    name: 'Sonic Overdrive',
    description: 'Extreme acceleration, intense bottom-of-arc boosts, and maximum velocity.',
    config: {
      gravity: 22.0,
      maxRopeLength: 130,
      minRopeLength: 8,
      ropeStiffness: 0.98,
      airDrag: 0.0006,
      releaseBoost: 1.75,
      reelSpeed: 24.0,
      timeScale: 1.0,
      terminalVelocity: 140,
      playerMass: 75,
    },
  },
};

export interface TelemetryData {
  speedMps: number;
  speedMph: number;
  altitude: number;
  ropeLength: number;
  tensionForce: number; // Newtons
  gravityForce: number; // Newtons
  kineticEnergy: number; // Joules
  potentialEnergy: number; // Joules
  totalEnergy: number; // Joules
  fps: number;
  isAttached: boolean;
  isOnGround: boolean;
  streakCount: number;
  groundlessDistance: number;
  bestGroundlessDistance: number;
  currentAnchorDistance: number;
  hasTargetLock: boolean;
}

export type TimeOfDay = 'sunset' | 'night' | 'day' | 'foggy';

export type GameMode = 'freeroam' | 'ring_challenge' | 'distance_run';

export interface RingCheckpoint {
  id: number;
  position: [number, number, number];
  radius: number;
  normal: [number, number, number];
  collected: boolean;
}
