import React from 'react';
import { X, Play, MousePointer, Compass, Zap, Target } from 'lucide-react';

interface TutorialModalProps {
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 flex flex-col gap-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex flex-col">
            <h2 className="text-lg md:text-xl font-bold text-white font-['Chakra_Petch'] flex items-center gap-2">
              WEBSWING FLIGHT ACADEMY
            </h2>
            <span className="text-xs text-sky-400 font-medium">Mastering Pendulum Physics & Aerodynamics</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Step Swing Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-xs font-mono">
              1
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Aim at Skyscraper</h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Look around using mouse or touch. When your crosshair highlights an anchor point on a building, a cyan lock reticle will appear.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs font-mono">
              2
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Hold to Swing</h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Press and hold <strong>Left Click</strong> or <strong>Space</strong>. Gravity converts your altitude into tangential swing momentum along a pendulum arc.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs font-mono">
              3
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Release & Launch</h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Release at the bottom of the arc to harvest maximum forward speed and boost! Immediately fire at the next tower to chain swings.
            </p>
          </div>
        </div>

        {/* Pro Tips Box */}
        <div className="bg-sky-950/30 border border-sky-800/50 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
            <Zap className="w-4 h-4" />
            <span>AEROBATIC PRO TIPS</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
            <li>
              <strong>Reel-In Climb:</strong> Hold <strong>W</strong> or <strong>Shift</strong> while swinging to shorten your cord and pump angular velocity!
            </li>
            <li>
              <strong>Touchpad Users:</strong> Tap <strong>[SPACE]</strong> to shoot web and tap again to release with boost! Use <strong>[Arrow Keys]</strong> or <strong>[Q]/[E]</strong> to turn the camera easily without dragging.
            </li>
            <li>
              <strong>Airtime Streaks:</strong> Stay airborne without touching rooftops or roads to build your Groundless Distance record.
            </li>
            <li>
              <strong>Ring Checkpoint Course:</strong> Toggle the Ring Challenge in Settings to race through high-altitude aerial rings.
            </li>
            <li>
              <strong>STEM Mode:</strong> Enable 3D Force Vectors to see tension, gravity, velocity, and net force vectors in real-time.
            </li>
          </ul>
        </div>

        {/* Controls Cheatsheet */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Keyboard & Touchpad Controls
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Shoot & Swing</span>
              <span className="text-amber-300 font-semibold">SPACE / Left Click</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Keyboard Look</span>
              <span className="text-amber-300 font-semibold">Arrow Keys or Q / E</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Aim & Look (Touchpad)</span>
              <span className="text-white font-semibold">Move Finger / Click to Lock</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Steer / Aerial Glide</span>
              <span className="text-white font-semibold">A / D / S</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Reel In / Climb</span>
              <span className="text-white font-semibold">W / Shift</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Look Behind (Rear View)</span>
              <span className="text-amber-300 font-semibold">X</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Quick Reset</span>
              <span className="text-white font-semibold">R</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-lg"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Launch Into City</span>
          </button>
        </div>
      </div>
    </div>
  );
};
