import React from 'react';
import { TelemetryData, GameMode } from '../types/physics';
import { Gauge, Crosshair, ArrowUp, Award, Settings, RotateCcw, Volume2, VolumeX, BarChart2, Eye } from 'lucide-react';

interface HUDProps {
  telemetry: TelemetryData;
  speedUnit: 'mph' | 'mps';
  onToggleSpeedUnit: () => void;
  gameMode: GameMode;
  ringCount: number;
  totalRings: number;
  hudMode: 'minimal' | 'full';
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenSettings: (initialTab?: 'controls' | 'telemetry' | 'physics' | 'environment' | 'tutorial') => void;
  onReset: () => void;
  isLookingBehind?: boolean;
  onToggleLookBehind?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  telemetry,
  speedUnit,
  onToggleSpeedUnit,
  gameMode,
  ringCount,
  totalRings,
  hudMode,
  isMuted,
  onToggleMute,
  onOpenSettings,
  onReset,
  isLookingBehind = false,
  onToggleLookBehind,
}) => {
  const displaySpeed = Math.round(speedUnit === 'mph' ? telemetry.speedMph : telemetry.speedMps);
  const speedUnitLabel = speedUnit === 'mph' ? 'MPH' : 'M/S';

  // Dynamic speed tier styling
  let speedTier = 'GLIDE';
  let speedColor = 'text-sky-400';
  let speedBadgeBg = 'bg-sky-500/10 border-sky-500/30 text-sky-400';
  if (telemetry.speedMph > 80) {
    speedTier = 'SONIC BOOM';
    speedColor = 'text-amber-400 font-extrabold animate-pulse';
    speedBadgeBg = 'bg-amber-500/20 border-amber-400/50 text-amber-300';
  } else if (telemetry.speedMph > 50) {
    speedTier = 'MACH CRUISE';
    speedColor = 'text-emerald-400 font-bold';
    speedBadgeBg = 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300';
  } else if (telemetry.speedMph > 25) {
    speedTier = 'AEROBATIC';
    speedColor = 'text-cyan-300';
    speedBadgeBg = 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300';
  }

  // Tension ratio for stress bar in full mode
  const tensionRatio = Math.min(1.0, telemetry.tensionForce / 12000);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between pointer-events-auto">
        {/* Left: Minimalist Brand Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md shadow-lg shadow-black/20">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <h1 className="text-xs sm:text-sm font-black tracking-wider text-white font-['Chakra_Petch']">
            WEBSWING
          </h1>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            · {telemetry.fps} FPS
          </span>
        </div>

        {/* Center: Contextual Action Prompt Pill */}
        {telemetry.hasTargetLock && !telemetry.isAttached ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-950/85 border border-sky-400/50 backdrop-blur-md text-xs text-sky-200 shadow-[0_0_15px_rgba(56,189,248,0.25)] animate-in fade-in zoom-in-95 duration-150">
            <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span className="font-mono font-bold">{telemetry.currentAnchorDistance}m</span>
            <span className="text-sky-300 font-semibold">[KLIK KIRI / F] Ayun</span>
          </div>
        ) : telemetry.isAttached ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/85 border border-amber-400/50 backdrop-blur-md text-xs text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.25)] animate-in fade-in zoom-in-95 duration-150">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-bold text-amber-300">[SPASI] Lepas Ayunan</span>
          </div>
        ) : telemetry.isOnGround ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/80 backdrop-blur-md text-xs text-slate-300 shadow-md">
            <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-emerald-300">[SPASI] Lompat Melambung</span>
          </div>
        ) : (
          <div />
        )}

        {/* Right: Unified Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Audio Mute */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/90 text-slate-300 hover:text-white backdrop-blur-md transition-all active:scale-95 shadow-lg"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
          </button>

          {/* Quick Look Behind (Rear View) Button */}
          {onToggleLookBehind && (
            <button
              onClick={onToggleLookBehind}
              title="Lihat ke Belakang / Rear View [X]"
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md transition-all flex items-center gap-1.5 active:scale-95 shadow-lg ${
                isLookingBehind
                  ? 'bg-amber-400 border-amber-300 text-slate-950 font-black shadow-amber-400/25'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800/90 text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Belakang</span>
              <kbd className={`text-[10px] font-mono font-bold ${isLookingBehind ? 'text-slate-950' : 'text-amber-400'}`}>
                X
              </kbd>
            </button>
          )}

          {/* Quick Reset Button */}
          <button
            onClick={onReset}
            title="Reset Posisi Karakter [R]"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/90 text-xs font-semibold text-slate-300 hover:text-white backdrop-blur-md transition-all flex items-center gap-1.5 active:scale-95 shadow-lg"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Reset</span>
            <kbd className="text-[10px] text-slate-500 font-mono">R</kbd>
          </button>

          {/* Master "Pengaturan" System Button */}
          <button
            onClick={() => onOpenSettings()}
            title="Buka Menu Pengaturan & Informasi [ESC / P]"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/90 to-cyan-500/90 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2 active:scale-95"
          >
            <Settings className="w-3.5 h-3.5 fill-slate-950" />
            <span>Pengaturan</span>
            <kbd className="hidden md:inline px-1 py-0.2 rounded bg-black/20 text-slate-950 text-[10px] font-mono">
              ESC
            </kbd>
          </button>
        </div>
      </header>

      {/* Rear View Look Behind Indicator */}
      {isLookingBehind && (
        <div className="absolute top-16 md:top-20 left-1/2 -translate-x-1/2 pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs font-['Chakra_Petch'] tracking-widest shadow-2xl shadow-amber-400/40 border-2 border-amber-300">
            <Eye className="w-4 h-4 animate-pulse" />
            <span>PANDANGAN BELAKANG [X]</span>
          </div>
        </div>
      )}

      {/* Screen Crosshair Target (Subtle & Dynamic) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <div
          className={`w-7 h-7 border rounded-full transition-all duration-150 flex items-center justify-center ${
            telemetry.hasTargetLock
              ? 'border-sky-400 scale-110 shadow-[0_0_14px_rgba(56,189,248,0.7)] bg-sky-500/10'
              : 'border-white/30 scale-90'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              telemetry.isAttached
                ? 'bg-amber-400 scale-150 animate-ping'
                : telemetry.hasTargetLock
                ? 'bg-sky-400 scale-125'
                : 'bg-white/40'
            }`}
          />
        </div>
      </div>

      {/* Ring Checkpoints Banner (If in Ring Course mode) */}
      {gameMode === 'ring_challenge' && (
        <div className="self-center -mt-6 pointer-events-auto px-4 py-2 rounded-2xl bg-slate-900/90 border border-cyan-500/40 backdrop-blur-md shadow-xl flex items-center gap-3 animate-in fade-in">
          <Award className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold tracking-wider">CHECKPOINTS</span>
              <span className="text-sm font-black font-mono text-cyan-300">
                {ringCount} / {totalRings}
              </span>
            </div>
            <div className="w-32 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
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
        <div className="self-center animate-bounce flex flex-col items-center">
          <div className="px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-['Chakra_Petch'] text-xs sm:text-sm font-extrabold tracking-wide shadow-lg backdrop-blur-sm">
            🔥 {telemetry.streakCount}x SWING CHAIN
          </div>
        </div>
      )}

      {/* Bottom Area */}
      {hudMode === 'minimal' ? (
        /* Minimalist Cockpit Floating Badge (Bottom-Left) */
        <footer className="flex items-end justify-between">
          <div className="pointer-events-auto bg-slate-900/85 border border-slate-800/90 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 flex items-center gap-4 shadow-2xl shadow-black/40">
            {/* Speedometer */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">VELOCITY</span>
                <button
                  onClick={onToggleSpeedUnit}
                  className="text-[9px] px-1 rounded bg-slate-800 text-sky-300 hover:text-white font-mono"
                  title="Ganti Satuan MPH / M/S"
                >
                  {speedUnitLabel}
                </button>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight tabular-nums">
                  {displaySpeed}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{speedUnitLabel}</span>
              </div>
              <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border mt-1 w-fit ${speedBadgeBg}`}>
                {speedTier}
              </div>
            </div>

            <div className="w-[1px] h-12 bg-slate-800" />

            {/* Altitude & Status */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                <span>KETINGGIAN</span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight tabular-nums">
                  {Math.round(telemetry.altitude)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">M</span>
              </div>
              <span className="text-[10px] text-sky-400 font-mono font-medium">
                {telemetry.isOnGround ? 'GROUNDED' : telemetry.isAttached ? 'SWINGING' : 'GLIDING'}
              </span>
            </div>

            {/* Quick button to open Telemetry tab in Pengaturan */}
            <button
              onClick={() => onOpenSettings('telemetry')}
              title="Lihat Telemetri Lengkap & Analisis Energi di Pengaturan"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-sky-300 transition-colors border border-slate-700/60 ml-1"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>
        </footer>
      ) : (
        /* Full Instrument Cockpit (Classic Mode) */
        <footer className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          {/* Speedometer Card */}
          <div className="pointer-events-auto bg-slate-900/85 border border-slate-800/90 backdrop-blur-md rounded-2xl p-3.5 flex flex-col gap-1 shadow-lg">
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
              <span className="text-3xl font-bold font-mono text-white tracking-tight tabular-nums">
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
          <div className="pointer-events-auto bg-slate-900/85 border border-slate-800/90 backdrop-blur-md rounded-2xl p-3.5 flex flex-col gap-1 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                ALTITUDE
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ABOVE GROUND</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-white tracking-tight tabular-nums">
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
          <div className="pointer-events-auto bg-slate-900/85 border border-slate-800/90 backdrop-blur-md rounded-2xl p-3.5 flex flex-col gap-1 shadow-lg hidden md:flex">
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
          <div className="pointer-events-auto bg-slate-900/85 border border-slate-800/90 backdrop-blur-md rounded-2xl p-3.5 flex flex-col gap-1 shadow-lg hidden md:flex">
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
      )}
    </div>
  );
};
