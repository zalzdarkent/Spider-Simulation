import React from 'react';
import { PhysicsConfig, PHYSICS_PRESETS, PresetName } from '../types/physics';
import { Sliders, X, RotateCcw } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface PhysicsPanelProps {
  config: PhysicsConfig;
  onChangeConfig: (newConfig: PhysicsConfig) => void;
  onClose: () => void;
}

export const PhysicsPanel: React.FC<PhysicsPanelProps> = ({ config, onChangeConfig, onClose }) => {
  const handleSliderChange = (key: keyof PhysicsConfig, value: number) => {
    onChangeConfig({
      ...config,
      [key]: value,
    });
  };

  const applyPreset = (presetKey: PresetName) => {
    const preset = PHYSICS_PRESETS[presetKey];
    onChangeConfig({ ...preset.config });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900/95 border-l border-slate-800 backdrop-blur-xl p-5 shadow-2xl z-50 flex flex-col justify-between overflow-y-auto">
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white font-['Chakra_Petch'] tracking-wide">
              PHYSICS ENGINE TUNER
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets Grid */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Quick Physics Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PHYSICS_PRESETS) as PresetName[]).map((key) => {
              const p = PHYSICS_PRESETS[key];
              const isSelected =
                config.gravity === p.config.gravity && config.releaseBoost === p.config.releaseBoost;
              return (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`px-3 py-2 rounded-lg text-left text-xs transition-all border ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{p.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders List */}
        <div className="flex flex-col gap-4">
          {/* Gravity Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Gravity Acceleration (g)</span>
              <span className="font-mono text-sky-400 font-semibold">{config.gravity.toFixed(1)} m/s²</span>
            </div>
            <input
              type="range"
              min="4"
              max="28"
              step="0.5"
              value={config.gravity}
              onChange={(e) => handleSliderChange('gravity', parseFloat(e.target.value))}
              className="accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Earth standard is 9.81 m/s². Higher = snappier pendulum arcs.</span>
          </div>

          {/* Release Boost Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Bottom Arc Release Boost</span>
              <span className="font-mono text-sky-400 font-semibold">{config.releaseBoost.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="2.2"
              step="0.05"
              value={config.releaseBoost}
              onChange={(e) => handleSliderChange('releaseBoost', parseFloat(e.target.value))}
              className="accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">1.0x = pure realistic momentum; 1.35x+ gives arcade superhero launch.</span>
          </div>

          {/* Max Web Cord Length */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Max Web Range</span>
              <span className="font-mono text-sky-400 font-semibold">{config.maxRopeLength} m</span>
            </div>
            <input
              type="range"
              min="40"
              max="160"
              step="5"
              value={config.maxRopeLength}
              onChange={(e) => handleSliderChange('maxRopeLength', parseInt(e.target.value))}
              className="accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Maximum distance to latch anchor points on distant skyscrapers.</span>
          </div>

          {/* Reel-in Velocity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Reel-In Climb Speed</span>
              <span className="font-mono text-sky-400 font-semibold">{config.reelSpeed.toFixed(0)} m/s</span>
            </div>
            <input
              type="range"
              min="6"
              max="32"
              step="2"
              value={config.reelSpeed}
              onChange={(e) => handleSliderChange('reelSpeed', parseFloat(e.target.value))}
              className="accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Speed at which web cord is reeled in when holding [W] or [Shift].</span>
          </div>

          {/* Aerodynamic Drag */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Air Resistance (Drag)</span>
              <span className="font-mono text-sky-400 font-semibold">{(config.airDrag * 1000).toFixed(1)}e-3</span>
            </div>
            <input
              type="range"
              min="0.0005"
              max="0.006"
              step="0.0002"
              value={config.airDrag}
              onChange={(e) => handleSliderChange('airDrag', parseFloat(e.target.value))}
              className="accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Atmospheric resistance dampens excessive speed.</span>
          </div>

          {/* Time Scale / Bullet-Time Slow Motion */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Simulation Time Scale</span>
              <span className="font-mono text-sky-400 font-semibold">{config.timeScale.toFixed(2)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.05"
                value={config.timeScale}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleSliderChange('timeScale', val);
                  if (val < 0.6) soundEngine.playSlowMotionToggle(true);
                }}
                className="flex-1 accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => {
                  const newScale = config.timeScale === 1.0 ? 0.3 : 1.0;
                  handleSliderChange('timeScale', newScale);
                  soundEngine.playSlowMotionToggle(newScale < 1.0);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono border ${
                  config.timeScale < 1.0
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {config.timeScale < 1.0 ? 'Slow-Mo Active' : 'Normal'}
              </button>
            </div>
            <span className="text-[10px] text-slate-500">Bullet-time physics allows studying pendulum angles in slow-mo.</span>
          </div>
        </div>
      </div>

      {/* Footer Reset */}
      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
        <button
          onClick={() => applyPreset('balanced')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors"
        >
          Done Tuning
        </button>
      </div>
    </div>
  );
};
