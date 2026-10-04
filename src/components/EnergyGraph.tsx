import React, { useEffect, useRef } from 'react';
import { TelemetryData } from '../types/physics';
import { Zap, HelpCircle } from 'lucide-react';

interface EnergyGraphProps {
  telemetry: TelemetryData;
}

export const EnergyGraph: React.FC<EnergyGraphProps> = ({ telemetry }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<{ ke: number; pe: number; te: number }[]>([]);

  useEffect(() => {
    // Record current energy frame
    const history = historyRef.current;
    history.push({
      ke: telemetry.kineticEnergy,
      pe: telemetry.potentialEnergy,
      te: telemetry.totalEnergy,
    });
    if (history.length > 140) {
      history.shift();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < h; y += 25) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    if (history.length < 2) return;

    // Determine max scale
    let maxEnergy = 120000; // minimum baseline
    for (const pt of history) {
      if (pt.te > maxEnergy) maxEnergy = pt.te * 1.15;
    }

    const stepX = w / (history.length - 1);

    // 1. Draw Potential Energy (Yellow)
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = idx * stepX;
      const y = h - (pt.pe / maxEnergy) * (h - 8);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 2. Draw Kinetic Energy (Green)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = idx * stepX;
      const y = h - (pt.ke / maxEnergy) * (h - 8);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 3. Draw Total Energy (Cyan)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = idx * stepX;
      const y = h - (pt.te / maxEnergy) * (h - 8);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }, [telemetry]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-xl p-4 shadow-xl flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold text-white tracking-wider font-['Chakra_Petch']">
            MECHANICAL ENERGY CONSERVATION
          </h3>
        </div>
        <div
          title="Potential energy (height) converts to Kinetic energy (velocity) throughout the swing arc."
          className="text-slate-500 hover:text-slate-300 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Energy Canvas Plot */}
      <div className="relative w-full h-24 bg-slate-950/70 rounded-lg overflow-hidden border border-slate-800">
        <canvas ref={canvasRef} width={320} height={96} className="w-full h-full" />
      </div>

      {/* Legends & Numbers */}
      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
        <div className="flex flex-col">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Kinetic (Eₖ)
          </span>
          <span className="text-white font-semibold tabular-nums">
            {(telemetry.kineticEnergy / 1000).toFixed(1)} kJ
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-yellow-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
            Potential (Eₚ)
          </span>
          <span className="text-white font-semibold tabular-nums">
            {(telemetry.potentialEnergy / 1000).toFixed(1)} kJ
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-sky-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            Total (E)
          </span>
          <span className="text-white font-semibold tabular-nums">
            {(telemetry.totalEnergy / 1000).toFixed(1)} kJ
          </span>
        </div>
      </div>
    </div>
  );
};
