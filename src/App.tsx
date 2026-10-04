import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebSwingScene } from './renderer/WebSwingScene';
import { HUD } from './components/HUD';
import { EnergyGraph } from './components/EnergyGraph';
import { SettingsModal, SettingsTab } from './components/SettingsModal';
import { MobileControls } from './components/MobileControls';
import { PHYSICS_PRESETS, PhysicsConfig, TelemetryData, TimeOfDay, GameMode } from './types/physics';
import { PlayerInput } from './physics/swingPhysics';
import { soundEngine } from './audio/soundEngine';
import { modelManager } from './renderer/modelManager';
import confetti from 'canvas-confetti';
import { Play, Sparkles } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WebSwingScene | null>(null);

  // App & Simulation state
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [speedUnit, setSpeedUnit] = useState<'mph' | 'mps'>('mph');
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfig>(PHYSICS_PRESETS.balanced.config);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('sunset');
  const [cameraMode, setCameraMode] = useState<'third_person' | 'first_person'>('third_person');
  const [gameMode, setGameMode] = useState<GameMode>('freeroam');

  // Touchpad & Control Comfort state
  const [isTouchpadMode, setIsTouchpadMode] = useState<boolean>(true);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [aimAssist, setAimAssist] = useState<boolean>(true);
  const [lookSensitivity, setLookSensitivity] = useState<number>(0.0035);
  const [invertY, setInvertY] = useState<boolean>(false);
  const [toggleSwingMode, setToggleSwingMode] = useState<boolean>(true);

  // Visualization toggles
  const [showVectors, setShowVectors] = useState<boolean>(false);
  const [showTrajectory, setShowTrajectory] = useState<boolean>(false);
  const [showEnergyGraph, setShowEnergyGraph] = useState<boolean>(false);
  const [hudMode, setHudMode] = useState<'minimal' | 'full'>('minimal');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Unified Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('controls');

  // Telemetry
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    speedMps: 0,
    speedMph: 0,
    altitude: 75,
    ropeLength: 0,
    tensionForce: 0,
    gravityForce: 0,
    kineticEnergy: 0,
    potentialEnergy: 0,
    totalEnergy: 0,
    fps: 60,
    isAttached: false,
    isOnGround: false,
    streakCount: 0,
    groundlessDistance: 0,
    bestGroundlessDistance: 0,
    currentAnchorDistance: 0,
    hasTargetLock: false,
  });

  // Ring challenge metrics
  const [ringCount, setRingCount] = useState<number>(0);
  const totalRings = 12;

  // Touch & Mobile detection
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Input states
  const inputRef = useRef<PlayerInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    reelIn: false,
    sprint: false,
    fireWeb: false,
    releaseWeb: false,
  });

  // Keyboard camera look states (Arrow keys / Q / E)
  const keyboardCamRef = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  // Space press timing for smart hybrid tap-toggle vs hold-swing
  const spacePressTimeRef = useRef<number>(0);
  const isSpaceDownRef = useRef<boolean>(false);

  // Mouse camera drag states
  const isMouseDownRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mobile camera drag ref
  const touchCamIdRef = useRef<number | null>(null);
  const lastTouchCamPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    modelManager.preloadAll();
  }, []);

  // Listen to Pointer Lock changes
  useEffect(() => {
    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvasRef.current;
      setIsPointerLocked(locked);
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  const requestPointerLock = useCallback(() => {
    if (!canvasRef.current) return;
    if (document.pointerLockElement === canvasRef.current) {
      document.exitPointerLock();
    } else {
      try {
        canvasRef.current.requestPointerLock();
      } catch {
        // Pointer lock might require direct user gesture
      }
    }
  }, []);

  const handleRingCollected = useCallback((ringId: number, totalCollected: number) => {
    setRingCount(totalCollected);
    if (totalCollected === 12) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, []);

  // Initialize Scene
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new WebSwingScene({
      canvas: canvasRef.current,
      config: physicsConfig,
      timeOfDay,
      showVectors,
      showTrajectory,
      cameraMode,
      onRingCollected: handleRingCollected,
    });
    scene.aimAssist = aimAssist;
    scene.lookSensitivity = lookSensitivity;
    scene.invertY = invertY;
    sceneRef.current = scene;

    let animId: number;
    let lastAnimTime = performance.now();

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((time - lastAnimTime) / 1000, 0.05);
      lastAnimTime = time;

      if (sceneRef.current) {
        // Continuous keyboard camera rotation (for touchpad / keyboard-only players)
        const kbCamSpeed = 2.4; // radians per second
        let deltaYaw = 0;
        let deltaPitch = 0;
        if (keyboardCamRef.current.left) deltaYaw += kbCamSpeed * dt;
        if (keyboardCamRef.current.right) deltaYaw -= kbCamSpeed * dt;
        if (keyboardCamRef.current.up) deltaPitch += kbCamSpeed * dt;
        if (keyboardCamRef.current.down) deltaPitch -= kbCamSpeed * dt;

        if (deltaYaw !== 0 || deltaPitch !== 0) {
          sceneRef.current.rotateCameraByKeyboard(deltaYaw, deltaPitch);
        }

        const telem = sceneRef.current.update(time, inputRef.current);
        setTelemetry(telem);
        sceneRef.current.render();
      }
    };
    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      sceneRef.current?.handleResize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      scene.destroy();
    };
  }, [timeOfDay, handleRingCollected]);

  // Sync physics config changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setPhysicsConfig(physicsConfig);
    }
  }, [physicsConfig]);

  // Sync camera mode, vectors, aimAssist, lookSensitivity, invertY
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.cameraMode = cameraMode;
      sceneRef.current.showVectors = showVectors;
      sceneRef.current.showTrajectory = showTrajectory;
      sceneRef.current.aimAssist = aimAssist;
      sceneRef.current.lookSensitivity = lookSensitivity;
      sceneRef.current.invertY = invertY;
    }
  }, [cameraMode, showVectors, showTrajectory, aimAssist, lookSensitivity, invertY]);

  // Toggle Touchpad Mode helper
  const handleToggleTouchpadMode = () => {
    const next = !isTouchpadMode;
    setIsTouchpadMode(next);
    if (next) {
      setAimAssist(true);
      setToggleSwingMode(true);
      setLookSensitivity(0.0035);
    }
  };

  // Open Settings Modal with optional initial tab
  const handleOpenSettings = (tab: SettingsTab = 'controls') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        // Character Movement & Steering
        case 'KeyW':
          inputRef.current.forward = true;
          inputRef.current.reelIn = true;
          break;
        case 'KeyS':
          inputRef.current.backward = true;
          break;
        case 'KeyA':
          inputRef.current.left = true;
          break;
        case 'KeyD':
          inputRef.current.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inputRef.current.reelIn = true;
          inputRef.current.sprint = true;
          break;

        // Camera Pan with Q and E (Left hand)
        case 'KeyQ':
          keyboardCamRef.current.left = true;
          break;
        case 'KeyE':
          keyboardCamRef.current.right = true;
          break;

        // Camera Rotate with Arrow Keys (Right hand)
        case 'ArrowLeft':
        case 'KeyJ':
          keyboardCamRef.current.left = true;
          break;
        case 'ArrowRight':
        case 'KeyL':
          keyboardCamRef.current.right = true;
          break;
        case 'ArrowUp':
        case 'KeyI':
          keyboardCamRef.current.up = true;
          break;
        case 'ArrowDown':
        case 'KeyK':
          keyboardCamRef.current.down = true;
          break;

        // Jump / Air-Zip / Super Jump Release (Spider-Man Jump System)
        case 'Space':
        case 'KeyX':
          e.preventDefault();
          inputRef.current.jump = true;
          // In mid-air, if player already air-zipped and is targeting an anchor, Space also acts as web launch
          {
            const phys = sceneRef.current?.getPhysics();
            if (phys && !phys.isOnGround && !phys.isOnRoof && !phys.isAttached && phys.hasAirZipped) {
              sceneRef.current?.triggerWebShoot();
              inputRef.current.fireWeb = true;
            }
          }
          break;

        // Web Shooting & Swing (Left Click, F, or Enter)
        case 'KeyF':
        case 'Enter':
          e.preventDefault();
          if (!isSpaceDownRef.current) {
            isSpaceDownRef.current = true;
            spacePressTimeRef.current = performance.now();

            const isCurrentlyAttached = sceneRef.current?.getPhysics().isAttached;

            if (toggleSwingMode) {
              // Tap to toggle: if already attached, release! If not attached, shoot!
              if (isCurrentlyAttached) {
                sceneRef.current?.triggerWebRelease();
                inputRef.current.fireWeb = false;
              } else {
                sceneRef.current?.triggerWebShoot();
                inputRef.current.fireWeb = true;
              }
            } else {
              // Classic hold mode
              inputRef.current.fireWeb = true;
              sceneRef.current?.triggerWebShoot();
            }
          }
          break;

        case 'KeyR':
          sceneRef.current?.resetPosition();
          setRingCount(0);
          break;
        case 'KeyC':
          setCameraMode((prev) => (prev === 'third_person' ? 'first_person' : 'third_person'));
          break;
        case 'Escape':
        case 'KeyP':
          setIsSettingsOpen((prev) => {
            const next = !prev;
            if (next && document.pointerLockElement) {
              document.exitPointerLock();
            }
            return next;
          });
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        case 'KeyW':
          inputRef.current.forward = false;
          inputRef.current.reelIn = false;
          break;
        case 'KeyS':
          inputRef.current.backward = false;
          break;
        case 'KeyA':
          inputRef.current.left = false;
          break;
        case 'KeyD':
          inputRef.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inputRef.current.reelIn = false;
          inputRef.current.sprint = false;
          break;

        case 'KeyQ':
          keyboardCamRef.current.left = false;
          break;
        case 'KeyE':
          keyboardCamRef.current.right = false;
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          keyboardCamRef.current.left = false;
          break;
        case 'ArrowRight':
        case 'KeyL':
          keyboardCamRef.current.right = false;
          break;
        case 'ArrowUp':
        case 'KeyI':
          keyboardCamRef.current.up = false;
          break;
        case 'ArrowDown':
        case 'KeyK':
          keyboardCamRef.current.down = false;
          break;

        case 'Space':
        case 'KeyX':
          inputRef.current.jump = false;
          break;

        case 'KeyF':
        case 'Enter':
          isSpaceDownRef.current = false;
          if (!toggleSwingMode) {
            inputRef.current.fireWeb = false;
            sceneRef.current?.triggerWebRelease();
          } else {
            const pressDuration = performance.now() - spacePressTimeRef.current;
            if (pressDuration > 280 && sceneRef.current?.getPhysics().isAttached) {
              sceneRef.current?.triggerWebRelease();
              inputRef.current.fireWeb = false;
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleSwingMode]);

  // Mouse & Touchpad Aim Handlers on Canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left Click: Tembak Jaring & Berayun
      isMouseDownRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      const isCurrentlyAttached = sceneRef.current?.getPhysics().isAttached;

      if (toggleSwingMode) {
        if (isCurrentlyAttached) {
          sceneRef.current?.triggerWebRelease();
          inputRef.current.fireWeb = false;
        } else {
          sceneRef.current?.triggerWebShoot();
          inputRef.current.fireWeb = true;
        }
      } else {
        inputRef.current.fireWeb = true;
        sceneRef.current?.triggerWebShoot();
      }
    } else if (e.button === 2) {
      // Right Click: Lompat / Web-Zip / Jump Release
      e.preventDefault();
      inputRef.current.jump = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!sceneRef.current) return;

    // In Pointer Lock mode, movementX and movementY are available directly!
    // This allows smooth 1-finger touchpad looking without holding click.
    if (document.pointerLockElement === canvasRef.current) {
      sceneRef.current.rotateCamera(e.movementX, e.movementY);
      return;
    }

    // Normal mouse move: rotate camera if dragging
    if (isMouseDownRef.current) {
      const dx = e.movementX ?? (e.clientX - lastMousePosRef.current.x);
      const dy = e.movementY ?? (e.clientY - lastMousePosRef.current.y);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      sceneRef.current.rotateCamera(dx, dy);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isMouseDownRef.current = false;
      if (!toggleSwingMode) {
        inputRef.current.fireWeb = false;
        sceneRef.current?.triggerWebRelease();
      }
    } else if (e.button === 2) {
      inputRef.current.jump = false;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Only zoom when Ctrl is pressed or with mouse wheel, to avoid accidental pinch zoom on touchpad
    if (e.ctrlKey) {
      e.preventDefault();
      sceneRef.current?.zoomCamera(e.deltaY);
    }
  };

  // Mobile camera drag on right side of screen
  const handleTouchCameraStart = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    if (touch.clientX > window.innerWidth * 0.35 && touchCamIdRef.current === null) {
      touchCamIdRef.current = touch.identifier;
      lastTouchCamPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchCameraMove = (e: React.TouchEvent) => {
    if (touchCamIdRef.current === null || !sceneRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchCamIdRef.current) {
        const dx = touch.clientX - lastTouchCamPosRef.current.x;
        const dy = touch.clientY - lastTouchCamPosRef.current.y;
        lastTouchCamPosRef.current = { x: touch.clientX, y: touch.clientY };
        sceneRef.current.rotateCamera(dx * 1.5, dy * 1.5);
        break;
      }
    }
  };

  const handleTouchCameraEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchCamIdRef.current) {
        touchCamIdRef.current = null;
        break;
      }
    }
  };

  // Mobile Joystick callback
  const handleJoystickMove = (x: number, y: number) => {
    const deadzone = 0.15;
    inputRef.current.left = x < -deadzone;
    inputRef.current.right = x > deadzone;
    inputRef.current.forward = y < -deadzone;
    inputRef.current.backward = y > deadzone;
    const mag = Math.hypot(x, y);
    inputRef.current.sprint = mag > 0.75;
    inputRef.current.reelIn = mag > 0.75;
  };

  // Audio Toggle
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
  };

  const handleStartSimulation = () => {
    setHasStarted(true);
    soundEngine.playWebRelease();
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-['Plus_Jakarta_Sans'] select-none">
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onClick={() => {
          // If in touchpad mode or user clicks canvas, request pointer lock for smooth touchpad looking
          if (isTouchpadMode && !isPointerLocked) {
            requestPointerLock();
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
        onTouchStart={handleTouchCameraStart}
        onTouchMove={handleTouchCameraMove}
        onTouchEnd={handleTouchCameraEnd}
        className="w-full h-full block cursor-crosshair touch-none"
      />

      {/* Floating Minimalist HUD */}
      <HUD
        telemetry={telemetry}
        speedUnit={speedUnit}
        onToggleSpeedUnit={() => setSpeedUnit((prev) => (prev === 'mph' ? 'mps' : 'mph'))}
        gameMode={gameMode}
        ringCount={ringCount}
        totalRings={totalRings}
        hudMode={hudMode}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenSettings={handleOpenSettings}
        onReset={() => {
          sceneRef.current?.resetPosition();
          setRingCount(0);
        }}
      />

      {/* Real-time STEM Energy Graph in bottom-right (optional on HUD) */}
      {showEnergyGraph && (
        <div className="absolute bottom-20 md:bottom-24 right-4 md:right-6 pointer-events-auto z-10 w-72 md:w-80 hidden sm:block">
          <EnergyGraph telemetry={telemetry} />
        </div>
      )}

      {/* Mobile Virtual Controls */}
      {isMobile && (
        <MobileControls
          onJoystickMove={handleJoystickMove}
          onFireDown={() => {
            inputRef.current.fireWeb = true;
            sceneRef.current?.triggerWebShoot();
          }}
          onFireUp={() => {
            inputRef.current.fireWeb = false;
            sceneRef.current?.triggerWebRelease();
          }}
          onReelInDown={() => {
            inputRef.current.reelIn = true;
          }}
          onReelInUp={() => {
            inputRef.current.reelIn = false;
          }}
          onJump={() => {
            inputRef.current.jump = true;
            setTimeout(() => {
              inputRef.current.jump = false;
            }, 100);
          }}
          onReset={() => {
            sceneRef.current?.resetPosition();
            setRingCount(0);
          }}
          isAttached={telemetry.isAttached}
        />
      )}

      {/* First-time Landing Screen Overlay */}
      {!hasStarted && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl max-w-lg w-full p-8 shadow-2xl flex flex-col items-center text-center gap-6">
            {/* Logo Badge */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-['Chakra_Petch']">
                WEBSWING
              </h1>
              <p className="text-sm text-slate-300 max-w-md leading-relaxed">
                Simulasi fisika pendulum berayun di antara gedung pencakar langit kota metropolitan 3D.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-3 w-full text-xs">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1">
                <span className="font-bold text-sky-400 font-mono">120 Hz</span>
                <span className="text-slate-400">Sim Pendulum</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1">
                <span className="font-bold text-amber-400 font-mono">Auto-Aim</span>
                <span className="text-slate-400">Magnet Kunci</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1">
                <span className="font-bold text-emerald-400 font-mono">STEM Hub</span>
                <span className="text-slate-400">Analisis Energi</span>
              </div>
            </div>

            {/* Quick tips notice */}
            <div className="text-xs text-sky-300/90 font-mono bg-sky-500/10 px-4 py-2.5 rounded-xl border border-sky-500/30 flex items-center justify-center gap-2">
              <span>💻 [SPASI] Ayun / Lepas · [Mouse/Touchpad] Pandangan · [ESC] Pengaturan</span>
            </div>

            <button
              onClick={handleStartSimulation}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-sm transition-all duration-150 shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Mulai Berayun di Kota</span>
            </button>
          </div>
        </div>
      )}

      {/* Unified Settings & Information Hub System */}
      {isSettingsOpen && (
        <SettingsModal
          timeOfDay={timeOfDay}
          onChangeTimeOfDay={(newTime) => {
            setTimeOfDay(newTime);
            sceneRef.current?.setTimeOfDay(newTime);
          }}
          cameraMode={cameraMode}
          onChangeCameraMode={setCameraMode}
          showVectors={showVectors}
          onToggleVectors={() => setShowVectors((prev) => !prev)}
          showTrajectory={showTrajectory}
          onToggleTrajectory={() => setShowTrajectory((prev) => !prev)}
          showEnergyGraph={showEnergyGraph}
          onToggleEnergyGraph={() => setShowEnergyGraph((prev) => !prev)}
          hudMode={hudMode}
          onChangeHudMode={setHudMode}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          gameMode={gameMode}
          onChangeGameMode={(newMode) => {
            setGameMode(newMode);
            sceneRef.current?.resetPosition();
            setRingCount(0);
          }}
          isTouchpadMode={isTouchpadMode}
          onToggleTouchpadMode={handleToggleTouchpadMode}
          aimAssist={aimAssist}
          onToggleAimAssist={() => setAimAssist((prev) => !prev)}
          lookSensitivity={lookSensitivity}
          onChangeLookSensitivity={setLookSensitivity}
          invertY={invertY}
          onToggleInvertY={() => setInvertY((prev) => !prev)}
          toggleSwingMode={toggleSwingMode}
          onToggleSwingMode={() => setToggleSwingMode((prev) => !prev)}
          isPointerLocked={isPointerLocked}
          onRequestPointerLock={requestPointerLock}
          telemetry={telemetry}
          speedUnit={speedUnit}
          onToggleSpeedUnit={() => setSpeedUnit((prev) => (prev === 'mph' ? 'mps' : 'mph'))}
          physicsConfig={physicsConfig}
          onChangePhysicsConfig={setPhysicsConfig}
          onResetPhysics={() => setPhysicsConfig(PHYSICS_PRESETS.balanced.config)}
          onResetPlayer={() => {
            sceneRef.current?.resetPosition();
            setRingCount(0);
          }}
          initialTab={settingsTab}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </main>
  );
}
