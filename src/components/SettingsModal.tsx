import React, { useState } from 'react';
import { TimeOfDay, GameMode, PhysicsConfig, PHYSICS_PRESETS, PresetName, TelemetryData } from '../types/physics';
import {
  Settings,
  X,
  Sun,
  Moon,
  Cloud,
  Volume2,
  VolumeX,
  Eye,
  Compass,
  Laptop,
  MousePointer,
  RotateCcw,
  Sliders,
  Activity,
  Award,
  BookOpen,
  ArrowUpDown,
  Gauge,
  ArrowUp,
  Flame,
  CheckCircle2,
  Shield,
  Zap,
  Car,
  Users,
  Trees,
} from 'lucide-react';
import { EnergyGraph } from './EnergyGraph';

export type SettingsTab = 'controls' | 'telemetry' | 'physics' | 'environment' | 'tutorial';

interface SettingsModalProps {
  timeOfDay: TimeOfDay;
  onChangeTimeOfDay: (time: TimeOfDay) => void;
  cameraMode: 'third_person' | 'first_person';
  onChangeCameraMode: (mode: 'third_person' | 'first_person') => void;
  showVectors: boolean;
  onToggleVectors: () => void;
  showTrajectory: boolean;
  onToggleTrajectory: () => void;
  showEnergyGraph: boolean;
  onToggleEnergyGraph: () => void;
  hudMode: 'minimal' | 'full';
  onChangeHudMode: (mode: 'minimal' | 'full') => void;
  isMuted: boolean;
  onToggleMute: () => void;
  gameMode: GameMode;
  onChangeGameMode: (mode: GameMode) => void;
  isTouchpadMode: boolean;
  onToggleTouchpadMode: () => void;
  aimAssist: boolean;
  onToggleAimAssist: () => void;
  lookSensitivity: number;
  onChangeLookSensitivity: (val: number) => void;
  invertY: boolean;
  onToggleInvertY: () => void;
  toggleSwingMode: boolean;
  onToggleSwingMode: () => void;
  isPointerLocked: boolean;
  onRequestPointerLock: () => void;
  telemetry: TelemetryData;
  speedUnit: 'mph' | 'mps';
  onToggleSpeedUnit: () => void;
  physicsConfig: PhysicsConfig;
  onChangePhysicsConfig: (config: PhysicsConfig) => void;
  onResetPhysics: () => void;
  onResetPlayer: () => void;
  initialTab?: SettingsTab;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  timeOfDay,
  onChangeTimeOfDay,
  cameraMode,
  onChangeCameraMode,
  showVectors,
  onToggleVectors,
  showTrajectory,
  onToggleTrajectory,
  showEnergyGraph,
  onToggleEnergyGraph,
  hudMode,
  onChangeHudMode,
  isMuted,
  onToggleMute,
  gameMode,
  onChangeGameMode,
  isTouchpadMode,
  onToggleTouchpadMode,
  aimAssist,
  onToggleAimAssist,
  lookSensitivity,
  onChangeLookSensitivity,
  invertY,
  onToggleInvertY,
  toggleSwingMode,
  onToggleSwingMode,
  isPointerLocked,
  onRequestPointerLock,
  telemetry,
  speedUnit,
  onToggleSpeedUnit,
  physicsConfig,
  onChangePhysicsConfig,
  onResetPhysics,
  onResetPlayer,
  initialTab = 'controls',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const displaySpeed = Math.round(speedUnit === 'mph' ? telemetry.speedMph : telemetry.speedMps);
  const speedUnitLabel = speedUnit === 'mph' ? 'MPH' : 'M/S';
  const tensionRatio = Math.min(1.0, telemetry.tensionForce / 12000);

  const handlePhysicsSliderChange = (key: keyof PhysicsConfig, value: number) => {
    onChangePhysicsConfig({
      ...physicsConfig,
      [key]: value,
    });
  };

  const applyPreset = (presetKey: PresetName) => {
    const preset = PHYSICS_PRESETS[presetKey];
    onChangePhysicsConfig({ ...preset.config });
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'controls', label: 'Kontrol & Kamera', icon: MousePointer },
    { id: 'telemetry', label: 'Informasi & STEM', icon: Activity },
    { id: 'physics', label: 'Mesin Fisika', icon: Sliders },
    { id: 'environment', label: 'Suasana & Mode', icon: Sun },
    { id: 'tutorial', label: 'Panduan Bermain', icon: BookOpen },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl w-full max-w-4xl shadow-2xl shadow-sky-950/30 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white font-['Chakra_Petch'] tracking-wide flex items-center gap-2">
                PENGATURAN & INFORMASI
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  SYSTEM HUB
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sesuaikan kontrol kamera, pantau telemetri, atur fisika pendulum, dan suasana kota.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700"
              title="Tutup (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="flex items-center px-4 sm:px-6 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto gap-1 sm:gap-2 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm shadow-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: KONTROL & KAMERA */}
          {activeTab === 'controls' && (
            <div className="space-y-6">
              {/* Highlight Box: Invert Y-Axis Controls */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 to-slate-900 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-sky-400" />
                    <span className="text-sm font-bold text-white">Arah Vertikal Mouse / POV (Invert Y-Axis)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                      {invertY ? 'INVERT AKTIF' : 'NORMAL (STANDAR)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                    {invertY
                      ? 'Mode Terbalik: Gerakkan mouse ke atas untuk melihat ke bawah, mouse ke bawah untuk melihat ke atas.'
                      : 'Mode Alami: Gerakkan mouse ke atas untuk melihat ke atas (langit/gedung tinggi), mouse ke bawah untuk melihat ke bawah (jalan).'}
                  </p>
                </div>
                <button
                  onClick={onToggleInvertY}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all border shrink-0 ${
                    invertY
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 hover:bg-amber-500/30'
                      : 'bg-sky-500/20 border-sky-400 text-sky-300 hover:bg-sky-500/30'
                  }`}
                >
                  {invertY ? 'Kembalikan ke Normal' : 'Balikkan Sumbu (Invert)'}
                </button>
              </div>

              {/* Look Sensitivity Slider */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-white uppercase tracking-wider">
                      Sensitivitas Gerakan Kamera
                    </label>
                    <p className="text-xs text-slate-400">
                      Tentukan kecepatan putar sudut pandang mouse dan touchpad.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-sky-400 px-2 py-1 rounded bg-slate-900 border border-slate-700">
                    {(lookSensitivity * 1000).toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="0.008"
                  step="0.0005"
                  value={lookSensitivity}
                  onChange={(e) => onChangeLookSensitivity(parseFloat(e.target.value))}
                  className="w-full accent-sky-500 h-2 bg-slate-950 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Lembut (Touchpad Halus)</span>
                  <span>Standar</span>
                  <span>Cepat (Mouse Gaming)</span>
                </div>
              </div>

              {/* Touchpad & Pointer Lock Assist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Laptop className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        Optimasi Laptop & Touchpad
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Mengaktifkan magnet auto-aim dan ayunan tap-to-toggle yang nyaman digunakan tanpa mouse eksternal.
                    </p>
                  </div>
                  <button
                    onClick={onToggleTouchpadMode}
                    className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      isTouchpadMode
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isTouchpadMode ? '✓ Mode Touchpad Aktif' : 'Aktifkan Mode Touchpad'}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sky-400">
                      <MousePointer className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        Kunci Kursor (Pointer Lock)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Kunci kursor ke dalam layar game agar bisa menggeser kamera 360° secara mulus. Tekan ESC untuk melepas.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onRequestPointerLock();
                      onClose();
                    }}
                    className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      isPointerLocked
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isPointerLocked ? '✓ Kursor Terkunci (ESC untuk lepas)' : 'Kunci Kursor Sekarang'}
                  </button>
                </div>
              </div>

              {/* Camera Perspective & Swing Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Sudut Pandang Kamera</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onChangeCameraMode('third_person')}
                      className={`p-3 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-all ${
                        cameraMode === 'third_person'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                          : 'bg-slate-900/80 border-slate-700/70 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>Orang Ketiga (TPS)</span>
                    </button>
                    <button
                      onClick={() => onChangeCameraMode('first_person')}
                      className={`p-3 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-all ${
                        cameraMode === 'first_person'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                          : 'bg-slate-900/80 border-slate-700/70 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Compass className="w-4 h-4" />
                      <span>Orang Pertama (FPS)</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Mekanik Tombol Tembak Jaring</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={onToggleSwingMode}
                      className={`p-3 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-all ${
                        toggleSwingMode
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                          : 'bg-slate-900/80 border-slate-700/70 text-slate-400 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ketuk Spasi (Toggle)</span>
                    </button>
                    <button
                      onClick={onToggleSwingMode}
                      className={`p-3 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-all ${
                        !toggleSwingMode
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                          : 'bg-slate-900/80 border-slate-700/70 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      <span>Tahan Spasi (Hold)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Keybinds Quick Reference Table */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-['Chakra_Petch']">
                  Daftar Tombol Kontrol Spider-Man
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Lompat / Air-Zip / Lepas</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px] border border-slate-700">
                      SPASI / KLIK KANAN
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Tembak Jaring / Ayun</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[11px] border border-slate-700">
                      KLIK KIRI / F
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Jalan & Berbalik Badan</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[11px] border border-slate-700">
                      W A S D
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Putar Kamera</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono text-[11px] border border-slate-700">
                      MOUSE / PANAH / Q E
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Lihat ke Belakang (Rear View)</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px] border border-slate-700 font-bold">
                      X
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Sprint (Lari Cepat) / Tarik Tali</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] border border-slate-700">
                      SHIFT / TAHAN MAJU
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Reset Posisi Awal</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 text-rose-300 font-mono text-[11px] border border-slate-700">
                      R
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INFORMASI & TELEMETRI STEM */}
          {activeTab === 'telemetry' && (
            <div className="space-y-6">
              {/* Display HUD Settings */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-white">Mode Tampilan Layar Saat Bermain (In-Game HUD)</span>
                  <p className="text-xs text-slate-300">
                    Pilih tampilan layar yang bersih dan sinematik agar tidak banyak elemen yang menutupi pandangan bermain.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onChangeHudMode('minimal')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      hudMode === 'minimal'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Minimalis Bersih (Rekomendasi)
                  </button>
                  <button
                    onClick={() => onChangeHudMode('full')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      hudMode === 'full'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Lengkap Klasik
                  </button>
                </div>
              </div>

              {/* Toggle to show Energy Graph on in-game screen */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Tampilkan Grafik STEM di Layar Utama (HUD)
                  </span>
                  <p className="text-xs text-slate-400">
                    Jika dimatikan, grafik energi hanya akan muncul di sini (agar pandangan saat bermain tetap lapang dan lega).
                  </p>
                </div>
                <button
                  onClick={onToggleEnergyGraph}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    showEnergyGraph
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {showEnergyGraph ? '✓ Ditampilkan di HUD' : 'Disembunyikan di HUD'}
                </button>
              </div>

              {/* 4 Live Instrument Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Velocity */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-semibold">
                      <Gauge className="w-3.5 h-3.5 text-sky-400" />
                      KECEPATAN
                    </span>
                    <button
                      onClick={onToggleSpeedUnit}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 hover:bg-slate-700 font-mono"
                    >
                      {speedUnitLabel}
                    </button>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                      {displaySpeed}
                    </span>
                    <span className="text-xs text-slate-400 font-mono ml-1">{speedUnitLabel}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">{telemetry.fps} FPS</div>
                </div>

                {/* Altitude */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-semibold">
                      <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                      KETINGGIAN
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">DARI TANAH</span>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                      {Math.round(telemetry.altitude)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono ml-1">M</span>
                  </div>
                  <div className="text-[10px] text-sky-400 font-mono">
                    {telemetry.isOnGround ? 'MENYENTUH TANAH' : telemetry.isAttached ? 'BERAYUN' : 'MELAYANG'}
                  </div>
                </div>

                {/* Rope Tension */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-cyan-300">GAYA TEGANGAN</span>
                    <span className="text-[10px] text-slate-500 font-mono">{Math.round(telemetry.ropeLength)}m tali</span>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                      {Math.round(telemetry.tensionForce)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono ml-1">N</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 rounded-full ${
                        tensionRatio > 0.8 ? 'bg-rose-500' : tensionRatio > 0.5 ? 'bg-amber-400' : 'bg-sky-400'
                      }`}
                      style={{ width: `${tensionRatio * 100}%` }}
                    />
                  </div>
                </div>

                {/* Groundless Run */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-emerald-400">JARAK MELAYANG</span>
                    <span className="text-[10px] text-amber-400 font-mono">BEST: {telemetry.bestGroundlessDistance}m</span>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold font-mono text-emerald-300 tracking-tight">
                      {telemetry.groundlessDistance}
                    </span>
                    <span className="text-xs text-slate-400 font-mono ml-1">M</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {telemetry.streakCount > 0 ? `🔥 ${telemetry.streakCount}x Streak Ayunan` : 'Melayang bebas'}
                  </div>
                </div>
              </div>

              {/* Live STEM Energy Graph Embedded */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-['Chakra_Petch'] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-sky-400" />
                    Grafik Konservasi Energi Mekanik Real-Time
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">E_total = E_kinetik + E_potensial</span>
                </div>
                <EnergyGraph telemetry={telemetry} />
              </div>
            </div>
          )}

          {/* TAB 3: MESIN FISIKA (PHYSICS ENGINE) */}
          {activeTab === 'physics' && (
            <div className="space-y-6">
              {/* Presets Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">
                    Pilihan Preset Cepat Fisika
                  </label>
                  <button
                    onClick={onResetPhysics}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset ke Default
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(Object.keys(PHYSICS_PRESETS) as PresetName[]).map((key) => {
                    const p = PHYSICS_PRESETS[key];
                    const isSelected =
                      physicsConfig.gravity === p.config.gravity &&
                      physicsConfig.releaseBoost === p.config.releaseBoost;
                    return (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className={`p-3 rounded-2xl text-left border transition-all ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-md shadow-sky-500/10'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                        }`}
                      >
                        <div className="font-bold text-xs">{p.name}</div>
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{p.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gravity Slider */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white font-semibold">Percepatan Gravitasi (g)</span>
                    <span className="font-mono text-sky-400 font-bold">{physicsConfig.gravity.toFixed(1)} m/s²</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="28"
                    step="0.5"
                    value={physicsConfig.gravity}
                    onChange={(e) => handlePhysicsSliderChange('gravity', parseFloat(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Bumi standar adalah 9.81 m/s². Nilai lebih tinggi membuat ayunan lebih cepat dan tajam.
                  </span>
                </div>

                {/* Release Boost */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white font-semibold">Daya Lempar Lepas Tali (Release Boost)</span>
                    <span className="font-mono text-sky-400 font-bold">{physicsConfig.releaseBoost.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="2.5"
                    step="0.05"
                    value={physicsConfig.releaseBoost}
                    onChange={(e) => handlePhysicsSliderChange('releaseBoost', parseFloat(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Tambahan kecepatan saat melepaskan tali di titik terendah busur ayunan.
                  </span>
                </div>

                {/* Max Rope Length */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white font-semibold">Jangkauan Tali Jaring Maksimum</span>
                    <span className="font-mono text-sky-400 font-bold">{Math.round(physicsConfig.maxRopeLength)} m</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    step="5"
                    value={physicsConfig.maxRopeLength}
                    onChange={(e) => handlePhysicsSliderChange('maxRopeLength', parseFloat(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Jarak maksimum untuk menembakkan jaring ke dinding pencakar langit.
                  </span>
                </div>

                {/* Air Drag */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white font-semibold">Hambatan Udara (Aerodynamic Drag)</span>
                    <span className="font-mono text-sky-400 font-bold">{(physicsConfig.airDrag * 1000).toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0002"
                    max="0.006"
                    step="0.0002"
                    value={physicsConfig.airDrag}
                    onChange={(e) => handlePhysicsSliderChange('airDrag', parseFloat(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Gesekan udara saat melayang. Nilai rendah memungkinkan momentum meluncur lebih lama.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SUASANA & MODE */}
          {activeTab === 'environment' && (
            <div className="space-y-6">
              {/* Game Mode */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider">
                  Mode Permainan (Game Mode)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'freeroam', label: 'Free Roam', desc: 'Jelajah bebas kota tanpa batasan' },
                    { id: 'ring_challenge', label: 'Ring Course', desc: 'Tantangan melewati 12 ring udara' },
                    { id: 'distance_run', label: 'Distance Run', desc: 'Uji rekor melayang tanpa jatuh' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onChangeGameMode(m.id as GameMode)}
                      className={`p-3.5 rounded-2xl border text-left text-xs transition-all ${
                        gameMode === m.id
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-sm font-bold text-white">{m.label}</div>
                      <div className="text-xs text-slate-400 mt-1">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time of Day */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider">
                  Waktu & Atmosfer Kota
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'sunset', label: 'Sunset Sore', icon: Sun },
                    { id: 'night', label: 'Cyber Night', icon: Moon },
                    { id: 'day', label: 'Daylight Siang', icon: Sun },
                    { id: 'foggy', label: 'Moody Fog', icon: Cloud },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => onChangeTimeOfDay(t.id as TimeOfDay)}
                        className={`p-3 rounded-2xl border flex flex-col items-center gap-2 text-xs transition-all ${
                          timeOfDay === t.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold shadow-sm'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                        }`}
                      >
                        <Icon className="w-5 h-5 text-sky-400" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visualizations & Audio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={onToggleVectors}
                  className={`p-3.5 rounded-2xl border text-xs flex flex-col items-start gap-1 transition-all ${
                    showVectors
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold text-white">Vektor Gaya STEM</span>
                  <span className="text-[11px] text-slate-400">Tampilkan panah gaya tegangan tali & gravitasi</span>
                </button>

                <button
                  onClick={onToggleTrajectory}
                  className={`p-3.5 rounded-2xl border text-xs flex flex-col items-start gap-1 transition-all ${
                    showTrajectory
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold text-white">Jalur Trajektori</span>
                  <span className="text-[11px] text-slate-400">Prediksi garis lintasan pendulum di depan</span>
                </button>

                <button
                  onClick={onToggleMute}
                  className={`p-3.5 rounded-2xl border text-xs flex flex-col items-start gap-1 transition-all ${
                    !isMuted
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                      : 'bg-rose-500/20 border-rose-400 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    {!isMuted ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
                    <span>{isMuted ? 'Suara Dinonaktifkan' : 'Efek Suara Aktif'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Deru angin dan desis tembakan jaring</span>
                </button>
              </div>

              {/* Living City Assets Info Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-900 to-sky-950/30 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 font-['Chakra_Petch']">
                    Ekosistem Kota Aktif (Living City)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                    <Car className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block">Lalu Lintas Kendaraan</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                        Taksi kuning NYC, mobil patroli polisi NYPD dengan sirine strobo, sedan, dan van logistik berkeliling kota.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                    <Users className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block">Warga & Pejalan Kaki (NPC)</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                        Pejalan kaki berjalan di trotoar dan bersantai di rooftop. Mereka akan bersorak gembira saat Spider-Man berayun dekat!
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                    <Trees className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block">Aset Pendukung Jalanan</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                        Pepohonan rimbun, lampu jalan klasik Manhattan, hidran merah, bangku taman trotoar, dan halte transit bus.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PANDUAN BERMAIN (TUTORIAL) */}
          {activeTab === 'tutorial' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-['Chakra_Petch']">
                  AKADEMI AYUNAN WEBSWING
                </h3>
                <p className="text-xs text-slate-300">
                  Kuasai fisika pendulum dan konversi energi mekanik untuk melesat di antara gedung pencakar langit.
                </p>
              </div>

              {/* 3 Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-sm font-mono border border-sky-500/30">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Lompat Melambung</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tekan <strong>SPASI</strong> atau <strong>Klik Kanan</strong> di tanah/atap untuk melompat tinggi 22m ke udara. Arahkan mouse ke dinding gedung pencakar langit.
                  </p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-sm font-mono border border-amber-500/30">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tembak Jaring & Berayun</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Saat reticle cyan terkunci pada gedung, tekan <strong>Klik Kiri</strong> atau <strong>F</strong>. Gravitasi mengubah energi potensial menjadi laju ayunan cepat.
                  </p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm font-mono border border-emerald-500/30">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Jump-Release & Web-Zip</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tekan <strong>SPASI</strong> saat berayun untuk terlontar tinggi ke langit. Tekan <strong>SPASI</strong> lagi di udara untuk manuver <em>Air-Zip</em> dorongan maju cepat!
                  </p>
                </div>
              </div>

              {/* Pro Tips */}
              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-sky-400">
                  <Zap className="w-4 h-4" /> Tips Rantai Kombo Spider-Man
                </span>
                <p className="leading-relaxed">
                  Lompat (<strong>SPASI</strong>) &rarr; Tembak & Ayun (<strong>Klik Kiri</strong>) &rarr; Lepas Ketapel (<strong>SPASI</strong>) &rarr; Dorongan Udara (<strong>SPASI</strong>) &rarr; Ayun Ulang! Tahan <strong>Shift</strong> atau <strong>W</strong> untuk memendekkan tali jaring demi melipatgandakan kecepatan sudut!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={onResetPlayer}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Posisi Karakter [R]
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-95"
          >
            Selesai & Lanjutkan Bermain
          </button>
        </div>
      </div>
    </div>
  );
};
