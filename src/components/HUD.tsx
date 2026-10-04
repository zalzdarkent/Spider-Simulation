import React from 'react';
import { TelemetryData, GameMode } from '../types/physics';
import { Gauge, Crosshair, ArrowUp, Activity, Award, Laptop, MousePointer } from 'lucide-react';

interface HUDProps {
  telemetry: TelemetryData;
  speedUnit: 'mph' | 'mps';
  onToggleSpeedUnit: () => void;
  gameMode: GameMode;
  ringCount: number;
  totalRings: number;
  isTouchpadMode: boolean;
  onToggleTouchpadMode: () => void;
  isPointerLocked: boolean;
  onRequestPointerLock: () => void;
  onOpenPhysics: () => void;
  onOpenSettings: () => void;
  onOpenTutorial: () => void;
  onReset: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  telemetry,
  speedUnit,
  onToggleSpeedUnit,
  gameMode,
  ringCount,
  totalRings,
  isTouchpadMode,
  onToggleTouchpadMode,
  isPointerLocked,
  onRequestPointerLock,
  onOpenPhysics,
  onOpenSettings,
  onOpenTutorial,
  onReset,
}) => {
  const displaySpeed = Math.round(speedUnit === 'mph' ? telemetry.speedMph : telemetry.speedMps);
  const speedUnitLabel = speedUnit === 'mph' ? 'MPH' : 'M/S';

  // Dynamic speed tier styling
  let speedTier = 'GLIDE';
  let speedColor = 'text-sky-400';
  if (telemetry.speedMph > 80) {
    speedTier = 'SONIC BOOM';
    speedColor = 'text-amber-400 font-bold';
  } else if (telemetry.speedMph > 50) {
    speedTier = 'MACH CRUISE';
    speedColor = 'text-emerald-400';
  } else if (telemetry.speedMph > 25) {
    speedTier = 'AEROBATIC';
    speedColor = 'text-cyan-300';
  }

  // Tension ratio for stress bar
  const tensionRatio = Math.min(1.0, telemetry.tensionForce / 12000);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 overflow-hidden select-none">
      {/* Top Header / Bar */}
      <header className="flex items-center justify-between pointer-events-auto">
        {/* Brand & Mode */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white font-['Chakra_Petch'] flex items-center gap-2">
              WEBSWING
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                SIMULATOR
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-['Plus_Jakarta_Sans'] hidden sm:block">
              Real-Time Pendulum Physics & Aerodynamics
            </p>
          </div>
        </div>

        {/* Center Target Status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800 backdrop-blur-md text-xs">
          <Crosshair className={`w-4 h-4 ${telemetry.hasTargetLock ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
          <span className="text-slate-400">Anchor:</span>
          {telemetry.hasTargetLock ? (
            <span className="text-sky-300 font-mono font-medium">{telemetry.currentAnchorDistance}m locked</span>
          ) : (
            <span className="text-slate-500 font-mono">Out of range</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Touchpad Mode Button */}
          <button
            onClick={onToggleTouchpadMode}
            title="Toggle Touchpad Friendly Mode (Auto-Aim & Keyboard Controls)"
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
              isTouchpadMode
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Touchpad Mode</span>
            {isTouchpadMode && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </button>

          {/* Pointer Lock Button for Smooth Look */}
          <button
            onClick={onRequestPointerLock}
            title={isPointerLocked ? 'Aim Locked (Press ESC to unlock)' : 'Click to Lock Aim for smooth touchpad swiping'}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1 hidden md:flex ${
              isPointerLocked
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>{isPointerLocked ? 'Aim Locked' : 'Lock Aim'}</span>
          </button>

          <button
            onClick={onOpenPhysics}
            className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white hover:border-sky-500 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Physics</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white hover:border-sky-500 hover:bg-slate-800 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={onOpenTutorial}
            className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white hover:border-sky-500 hover:bg-slate-800 transition-colors"
          >
            Help
          </button>
          <button
            onClick={onReset}
            title="Reset position (R)"
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors shadow-sm"
          >
            Reset [R]
          </button>
        </div>
      </header>

      {/* Touchpad Friendly Mode Active Notification / Helper Banner */}
      {isTouchpadMode && (
        <div className="self-center mt-2 pointer-events-auto px-4 py-2 rounded-xl bg-slate-900/90 border border-amber-500/40 backdrop-blur-md shadow-lg flex items-center gap-3 text-xs text-amber-200">
          <Laptop className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px]">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">SPACE</kbd> Swing / Release (Tap or Hold)
            </span>
            <span className="text-slate-500">·</span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">Arrow Keys</kbd> or <kbd className="px-1 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">Q / E</kbd> Look
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-emerald-400 font-semibold">Magnet Auto-Aim ON</span>
          </div>
        </div>
      )}

      {/* Screen Crosshair Target */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <div
          className={`w-6 h-6 border rounded-full transition-all duration-150 flex items-center justify-center ${
            telemetry.hasTargetLock
              ? 'border-sky-400 scale-110 shadow-[0_0_12px_rgba(56,189,248,0.6)]'
              : 'border-white/30 scale-90'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              telemetry.isAttached ? 'bg-amber-400 animate-ping' : telemetry.hasTargetLock ? 'bg-sky-400' : 'bg-white/40'
            }`}
          />
        </div>
      </div>

      {/* Top Banner Challenge Tracker */}
      {gameMode === 'ring_challenge' && (
        <div className="self-center mt-2 px-4 py-2 rounded-xl bg-slate-900/85 border border-cyan-500/40 backdrop-blur-md shadow-lg flex items-center gap-4">
          <Award className="w-5 h-5 text-cyan-400" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">RING CHECKPOINTS</span>
              <span className="text-sm font-bold font-mono text-cyan-300">
                {ringCount} / {totalRings}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-cyan-400 transition-all duration-300 rounded-full"
                style={{ width: `${(ringCount / totalRings) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Center Combo Popups */}
      {telemetry.streakCount > 1 && (
        <div className="self-center -mt-6 animate-bounce flex flex-col items-center">
          <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-['Chakra_Petch'] text-sm font-bold tracking-wide shadow-md">
            🔥 {telemetry.streakCount}x SWING CHAIN
          </div>
        </div>
      )}

      {/* Bottom Instrumentation Dashboard */}
      <footer className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        {/* Speedometer Card */}
        <div className="pointer-events-auto bg-slate-900/80 border border-slate-800/90 backdrop-blur-md rounded-xl p-3.5 flex flex-col gap-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              VELOCITY
            </span>
            <button
              onClick={onToggleSpeedUnit}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-mono"
            >
              {speedUnitLabel}
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-bold font-mono text-white tracking-tight tabular-nums">
              {displaySpeed}
            </span>
            <span className="text-xs text-slate-400 font-mono">{speedUnitLabel}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/70 font-mono">
            <span className={speedColor}>{speedTier}</span>
            <span className="text-slate-500">{telemetry.fps} FPS</span>
          </div>
        </div>

        {/* Altitude & Elevation Card */}
        <div className="pointer-events-auto bg-slate-900/80 border border-slate-800/90 backdrop-blur-md rounded-xl p-3.5 flex flex-col gap-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
              ALTITUDE
            </span>
            <span className="text-[10px] text-slate-500 font-mono">ABOVE GROUND</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-bold font-mono text-white tracking-tight tabular-nums">
              {Math.round(telemetry.altitude)}
            </span>
            <span className="text-xs text-slate-400 font-mono">METERS</span>
          </div>
          <div className="text-[11px] pt-1 border-t border-slate-800/70 text-slate-400 font-mono flex items-center justify-between">
            <span>Status:</span>
            <span className={telemetry.isOnGround ? 'text-amber-400' : 'text-sky-400'}>
              {telemetry.isOnGround ? 'GROUNDED' : telemetry.isAttached ? 'SWINGING' : 'FREE FLIGHT'}
            </span>
          </div>
        </div>

        {/* Web Rope Tension Card */}
        <div className="pointer-events-auto bg-slate-900/80 border border-slate-800/90 backdrop-blur-md rounded-xl p-3.5 flex flex-col gap-1 shadow-lg hidden md:flex">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>WEB ROPE TENSION</span>
            <span className="font-mono text-slate-300">{Math.round(telemetry.ropeLength)}m cord</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {Math.round(telemetry.tensionForce)}
            </span>
            <span className="text-xs text-slate-400 font-mono">NEWTONS</span>
          </div>
          {/* Stress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                tensionRatio > 0.8 ? 'bg-rose-500' : tensionRatio > 0.5 ? 'bg-amber-400' : 'bg-sky-400'
              }`}
              style={{ width: `${tensionRatio * 100}%` }}
            />
          </div>
        </div>

        {/* Distance Score Card */}
        <div className="pointer-events-auto bg-slate-900/80 border border-slate-800/90 backdrop-blur-md rounded-xl p-3.5 flex flex-col gap-1 shadow-lg hidden md:flex">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>GROUNDLESS RUN</span>
            <span className="text-[10px] text-amber-400 font-mono">BEST: {telemetry.bestGroundlessDistance}m</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-emerald-400 tracking-tight tabular-nums">
              {telemetry.groundlessDistance}
            </span>
            <span className="text-xs text-slate-400 font-mono">METERS</span>
          </div>
          <div className="text-[11px] pt-1 border-t border-slate-800/70 text-slate-400 font-mono truncate">
            {telemetry.isOnGround ? 'Touchdown! Launch to start' : 'Airborne glide active'}
          </div>
        </div>
      </footer>
    </div>
  );
};
