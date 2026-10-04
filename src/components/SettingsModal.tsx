import React from 'react';
import { TimeOfDay, GameMode } from '../types/physics';
import { Settings, X, Sun, Moon, Cloud, Volume2, VolumeX, Eye, Compass, Laptop } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

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
  toggleSwingMode: boolean;
  onToggleSwingMode: () => void;
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
  toggleSwingMode,
  onToggleSwingMode,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold text-white font-['Chakra_Petch']">SIMULATION SETTINGS</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Mode */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Game Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'freeroam', label: 'Free Roam', desc: 'Open sandbox swing' },
              { id: 'ring_challenge', label: 'Ring Course', desc: 'Aerial canyon checkpoints' },
              { id: 'distance_run', label: 'Distance Run', desc: 'Longest groundless streak' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeGameMode(m.id as GameMode)}
                className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                  gameMode === m.id
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                }`}
              >
                <div>{m.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Environment & Sky */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            City Atmosphere & Lighting
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'sunset', label: 'Sunset', icon: Sun },
              { id: 'night', label: 'Cyber Night', icon: Moon },
              { id: 'day', label: 'Daylight', icon: Sun },
              { id: 'foggy', label: 'Moody Fog', icon: Cloud },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => onChangeTimeOfDay(t.id as TimeOfDay)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs transition-colors ${
                    timeOfDay === t.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Camera Perspective */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Camera Perspective
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onChangeCameraMode('third_person')}
              className={`p-3 rounded-xl border text-xs flex items-center justify-center gap-2 transition-colors ${
                cameraMode === 'third_person'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Third-Person Chase Cam</span>
            </button>
            <button
              onClick={() => onChangeCameraMode('first_person')}
              className={`p-3 rounded-xl border text-xs flex items-center justify-center gap-2 transition-colors ${
                cameraMode === 'first_person'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>First-Person Visor POV</span>
            </button>
          </div>
        </div>

        {/* Touchpad & Control Comfort Section */}
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white font-['Chakra_Petch'] tracking-wide">
                TOUCHPAD & LAPTOP COMFORT
              </span>
            </div>
            <button
              onClick={onToggleTouchpadMode}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition-colors ${
                isTouchpadMode ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isTouchpadMode ? 'MODE ON' : 'MODE OFF'}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Auto-Aim Magnet Lock */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">Magnet Auto-Aim (Aim Assist)</span>
                <span className="text-[11px] text-slate-400">
                  Magnetically latches onto skyscraper edges in your view (easier on touchpad)
                </span>
              </div>
              <input
                type="checkbox"
                checked={aimAssist}
                onChange={onToggleAimAssist}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            {/* Tap vs Hold Swing Fire Mode */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">Tap-to-Swing Toggle</span>
                <span className="text-[11px] text-slate-400">
                  Tap Space/Left-Click to attach, tap again to release (no need to hold down buttons)
                </span>
              </div>
              <input
                type="checkbox"
                checked={toggleSwingMode}
                onChange={onToggleSwingMode}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            {/* Look Sensitivity Slider */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Touchpad Look Sensitivity</span>
                <span className="font-mono text-amber-400 font-semibold">{(lookSensitivity * 1000).toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.0015"
                max="0.008"
                step="0.0005"
                value={lookSensitivity}
                onChange={(e) => onChangeLookSensitivity(parseFloat(e.target.value))}
                className="accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">
                Adjust how far the camera rotates per swipe on your laptop touchpad.
              </span>
            </div>
          </div>
        </div>

        {/* STEM & Physics Visualization Toggles */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            STEM & Physics Visualizations
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800 cursor-pointer hover:bg-slate-800">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">3D Force Vectors</span>
                <span className="text-[11px] text-slate-400">
                  Render Tension (Cyan), Gravity (Yellow), Velocity (Green), and Net Force (Orange)
                </span>
              </div>
              <input
                type="checkbox"
                checked={showVectors}
                onChange={onToggleVectors}
                className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800 cursor-pointer hover:bg-slate-800">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">Trajectory Prediction Arc</span>
                <span className="text-[11px] text-slate-400">
                  Show dynamic ballistic spline forecasting next 1.5 seconds of flight
                </span>
              </div>
              <input
                type="checkbox"
                checked={showTrajectory}
                onChange={onToggleTrajectory}
                className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800 cursor-pointer hover:bg-slate-800">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">Live Energy Graph (PE vs KE)</span>
                <span className="text-[11px] text-slate-400">
                  Real-time mechanical energy transfer graph on HUD
                </span>
              </div>
              <input
                type="checkbox"
                checked={showEnergyGraph}
                onChange={onToggleEnergyGraph}
                className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Audio */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800">
          <div className="flex items-center gap-2">
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
            <span className="text-xs font-semibold text-slate-200">Procedural Audio & Wind FX</span>
          </div>
          <button
            onClick={onToggleMute}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isMuted ? 'bg-slate-700 text-slate-300' : 'bg-sky-600 text-white'
            }`}
          >
            {isMuted ? 'Unmute' : 'Active'}
          </button>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
