import { useEffect, useRef } from 'react';
import { useEasterEggStore } from '../../store/easterEggStore';
import { soundEngine } from '../../utils/lightningSoundEngine';
import { LightningConfigModal } from './LightningConfigModal';

// Custom event interfaces
declare global {
  interface WindowEventMap {
    'nexsys:easteregg:start': CustomEvent<{ x: number; y: number }>;
    'nexsys:easteregg:stop': CustomEvent<void>;
    'nexsys:easteregg:config': CustomEvent<void>;
  }
}

interface Bolt {
  startX: number;
  startY: number;
  angle: number;
  color: string;
  intensity: number;
  maxDepth: number;
  createdAt: number;
}

const COLORS = ['#FF8C00', '#00BFFF', '#FFFFFF']; // Orange, Blue, White
const FADE_DURATION = 600; // ms to fade out a bolt (longer for less flicker)

export function LightningEasterEgg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isHoldingRef = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });
  const holdStartRef = useRef(0);
  const boltsRef = useRef<Bolt[]>([]);
  const lastBoltTimeRef = useRef(0);
  const requestRef = useRef<number | null>(null);
  
  const {
    jitter,
    baseLength,
    maxDepthBase,
    branchProbBase,
    spawnDelayBase,
    soundEnabled,
    soundVolume,
    soundPitch,
    soundCrackle,
    setConfigOpen
  } = useEasterEggStore();

  // Keep a ref to the latest params for the animation loop
  const paramsRef = useRef({ jitter, baseLength, maxDepthBase, branchProbBase, spawnDelayBase, soundEnabled, soundVolume, soundPitch, soundCrackle });
  useEffect(() => {
    paramsRef.current = { jitter, baseLength, maxDepthBase, branchProbBase, spawnDelayBase, soundEnabled, soundVolume, soundPitch, soundCrackle };
    if (soundEnabled) {
      soundEngine.setVolume(soundVolume);
      soundEngine.pitch = soundPitch;
      soundEngine.crackle = soundCrackle;
    } else {
      soundEngine.stop();
    }
  }, [jitter, baseLength, maxDepthBase, branchProbBase, spawnDelayBase, soundEnabled, soundVolume, soundPitch, soundCrackle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match screen
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const drawBoltSegment = (
      x: number,
      y: number,
      angle: number,
      depth: number,
      maxDepth: number,
      baseLen: number,
      color: string,
      alpha: number
    ) => {
      if (depth >= maxDepth) return;

      const p = paramsRef.current;
      const j = (Math.random() - 0.5) * p.jitter; 
      const newAngle = angle + j;
      const length = baseLen * (Math.random() * 0.4 + 0.8); 

      const nextX = x + Math.cos(newAngle) * length;
      const nextY = y + Math.sin(newAngle) * length;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nextX, nextY);
      
      ctx.strokeStyle = `rgba(${hexToRgb(color)}, ${alpha})`;
      ctx.lineWidth = Math.max(0.5, (maxDepth - depth) * 0.15); // Thinner lightning
      
      // Add subtle glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      
      ctx.stroke();
      ctx.shadowBlur = 0;

      drawBoltSegment(nextX, nextY, newAngle, depth + 1, maxDepth, baseLen, color, alpha);

      const branchProb = p.branchProbBase + (holdStartRef.current > 0 ? Math.min((performance.now() - holdStartRef.current) / 20000, 0.06) : 0);
      if (Math.random() < branchProb && depth < maxDepth - 2) {
        const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.3);
        drawBoltSegment(nextX, nextY, branchAngle, depth + 1, maxDepth, baseLen * 0.9, color, alpha);
      }
    };

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isHolding = isHoldingRef.current;
      const holdDuration = isHolding ? time - holdStartRef.current : 0;
      const p = paramsRef.current;
      
      // Spawn new bolts if holding for at least 2 seconds (2000ms)
      if (isHolding && holdDuration > 2000) {
        const activeHoldDuration = holdDuration - 2000; 
        const intensity = Math.min(activeHoldDuration / 8000, 1.0);
        
        if (p.soundEnabled) {
           soundEngine.updateIntensity(intensity);
        }

        const spawnDelay = Math.max(p.spawnDelayBase * 0.3, p.spawnDelayBase - activeHoldDuration / 20); 
        if (time - lastBoltTimeRef.current > spawnDelay) {
          boltsRef.current.push({
            startX: originRef.current.x,
            startY: originRef.current.y,
            angle: Math.random() * Math.PI * 2,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            intensity: intensity,
            maxDepth: Math.floor(p.maxDepthBase + intensity * 13), 
            createdAt: time
          });
          
          const lastBolt = boltsRef.current[boltsRef.current.length - 1];
          lastBolt.angle = (Math.random() * (Math.PI / 2)) + (Math.random() > 0.8 ? (Math.random() * Math.PI - Math.PI/2) : 0);
          
          lastBoltTimeRef.current = time;
        }
      }

      // Draw and fade active bolts
      boltsRef.current = boltsRef.current.filter(bolt => {
        const age = time - bolt.createdAt;
        if (age >= FADE_DURATION) return false;

        const alpha = 1 - (age / FADE_DURATION);
        
        const bLen = p.baseLength + bolt.intensity * 60;

        drawBoltSegment(
          bolt.startX,
          bolt.startY,
          bolt.angle,
          0,
          bolt.maxDepth,
          bLen,
          bolt.color,
          alpha * 0.8 // Slightly more transparent for subtleness
        );
        
        return true;
      });

      if (isHoldingRef.current || boltsRef.current.length > 0) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        requestRef.current = null;
      }
    };

    const handleStart = (e: CustomEvent<{ x: number; y: number }>) => {
      originRef.current = e.detail;
      holdStartRef.current = performance.now();
      isHoldingRef.current = true;
      if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(animate);
      }
      if (paramsRef.current.soundEnabled) {
        soundEngine.start(paramsRef.current.soundVolume);
      }
    };

    const handleStop = () => {
      isHoldingRef.current = false;
      soundEngine.stop();
    };

    const handleConfig = () => {
      setConfigOpen(true);
    };

    window.addEventListener('nexsys:easteregg:start', handleStart as EventListener);
    window.addEventListener('nexsys:easteregg:stop', handleStop as EventListener);
    window.addEventListener('nexsys:easteregg:config', handleConfig as EventListener);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('nexsys:easteregg:start', handleStart as EventListener);
      window.removeEventListener('nexsys:easteregg:stop', handleStop as EventListener);
      window.removeEventListener('nexsys:easteregg:config', handleConfig as EventListener);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      soundEngine.stop();
    };
  }, [setConfigOpen]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />
      <LightningConfigModal />
    </>
  );
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}
