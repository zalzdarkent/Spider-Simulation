import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, ArrowUp, Zap } from 'lucide-react';

interface MobileControlsProps {
  onJoystickMove: (x: number, y: number) => void;
  onFireDown: () => void;
  onFireUp: () => void;
  onReelInDown: () => void;
  onReelInUp: () => void;
  onJump: () => void;
  onReset: () => void;
  isAttached: boolean;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onJoystickMove,
  onFireDown,
  onFireUp,
  onReelInDown,
  onReelInUp,
  onJump,
  onReset,
  isAttached,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsDraggingJoystick(true);
    updateKnob(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingJoystick || touchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateKnob(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setIsDraggingJoystick(false);
        setKnobPos({ x: 0, y: 0 });
        onJoystickMove(0, 0);
        break;
      }
    }
  };

  const updateKnob = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const maxRadius = rect.width / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobPos({ x: dx, y: dy });
    // Normalize -1 to 1
    onJoystickMove(dx / maxRadius, dy / maxRadius);
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex justify-between items-end p-6">
      {/* Left: Virtual Joystick */}
      <div
        ref={joystickBaseRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="pointer-events-auto w-28 h-28 rounded-full bg-slate-900/60 border-2 border-slate-700/60 backdrop-blur-md flex items-center justify-center relative touch-none shadow-xl"
      >
        <div
          className="w-12 h-12 rounded-full bg-sky-500/80 border border-sky-300 shadow-md transform pointer-events-none transition-transform duration-75"
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
        />
      </div>

      {/* Right Action Buttons */}
      <div className="pointer-events-auto flex flex-col items-end gap-3 touch-none">
        {/* Top auxiliary: Reel In & Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="w-11 h-11 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onTouchStart={onReelInDown}
            onTouchEnd={onReelInUp}
            className="w-12 h-12 rounded-full bg-amber-600/90 border border-amber-400 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform text-[10px] font-bold font-mono"
          >
            <ArrowUp className="w-4 h-4" />
            <span>REEL</span>
          </button>
        </div>

        {/* Primary Swing Fire Button */}
        <button
          onTouchStart={onFireDown}
          onTouchEnd={onFireUp}
          className={`w-20 h-20 rounded-full border-2 shadow-2xl flex flex-col items-center justify-center text-xs font-bold font-['Chakra_Petch'] transition-all active:scale-95 ${
            isAttached
              ? 'bg-amber-500 border-amber-300 text-slate-950 scale-105'
              : 'bg-sky-500/90 border-sky-300 text-white'
          }`}
        >
          <Zap className="w-6 h-6 fill-current mb-0.5" />
          <span>{isAttached ? 'RELEASE' : 'FIRE WEB'}</span>
        </button>
      </div>
    </div>
  );
};
