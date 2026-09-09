'use client';
import { useEffect, useRef } from 'react';

const HANGMAN_PARTS = [
  'gallowsBase',
  'gallowsPole',
  'gallowsBeam',
  'gallowsRope',
  'head',
  'body',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg'
];

export default function HangmanCanvas({
  livesLeft = 10,
  maxLives = 10,
  isRoundOver = false,
  roundResult = null,
  isSpecialAnimating = false,
  stickmanMood = 'neutral',
  onSpecialAnimComplete
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas dimensions for high DPI
    const width = 330;
    const height = 360;
    canvas.width = width;
    canvas.height = height;

    const isNightmare = maxLives === 4;
    const baseMistakes = isNightmare ? 6 : 0;
    const mistakes = Math.min(Math.max(0, baseMistakes + (maxLives - livesLeft)), 10);
    const isDead = livesLeft <= 0 || mistakes >= 10;

    // If death animation triggered
    if (isRoundOver && roundResult === 'setter_wins') {
      runDeathAnimation(ctx, width, height, onSpecialAnimComplete);
      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }

    // If escape animation triggered
    if (isRoundOver && roundResult === 'guesser_wins') {
      runEscapeAnimation(ctx, width, height, mistakes, onSpecialAnimComplete);
      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }

    // Continuous 60fps Idle Physics & Liveliness Loop
    const loop = (now) => {
      const elapsed = now - startTimeRef.current;
      drawAnimatedFrame(ctx, width, height, mistakes, isDead, stickmanMood, elapsed);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [livesLeft, maxLives, isRoundOver, roundResult, stickmanMood, onSpecialAnimComplete]);

  function drawAnimatedFrame(ctx, w, h, mistakes, isDead, mood, timeMs) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const scale = w / 220;
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const t = timeMs * 0.001; // in seconds

    // 1. Natural Ambient Rope Swaying Physics
    const ropeSway = Math.sin(t * 1.8) * 0.045;
    const ropeLength = 36;
    const beamRopeX = 145;
    const beamRopeY = 18;
    const ropeEndX = beamRopeX + Math.sin(ropeSway) * ropeLength;
    const ropeEndY = beamRopeY + Math.cos(ropeSway) * ropeLength;

    // 2. Always draw the full glowing Neon Gallows Scaffold
    ctx.strokeStyle = isDead ? '#ef4444' : '#7c3aed';
    ctx.shadowColor = isDead ? '#fca5a5' : '#a855f7';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;

    // Base
    ctx.beginPath();
    ctx.moveTo(15, 225);
    ctx.lineTo(185, 225);
    ctx.stroke();

    // Vertical Mast Pole
    ctx.beginPath();
    ctx.moveTo(55, 225);
    ctx.lineTo(55, 18);
    ctx.stroke();

    // Top Overhead Beam
    ctx.beginPath();
    ctx.moveTo(55, 18);
    ctx.lineTo(155, 18);
    ctx.stroke();

    // Corner Angle Brace Strut
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(55, 50);
    ctx.lineTo(85, 18);
    ctx.stroke();

    // 3. Hanging Rope with Swaying Motion
    ctx.lineWidth = 3;
    ctx.strokeStyle = isDead ? '#ef4444' : '#f59e0b';
    ctx.shadowColor = isDead ? '#fca5a5' : '#f59e0b';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(beamRopeX, beamRopeY);
    ctx.lineTo(ropeEndX, ropeEndY);
    ctx.stroke();

    // If 0 mistakes: Draw a dangling rope noose loop swinging gently
    if (mistakes === 0) {
      ctx.beginPath();
      ctx.arc(ropeEndX, ropeEndY + 8, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.restore();
      return;
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // 4. Draw Animated Hanging Stickman from Rope End
    ctx.save();
    ctx.translate(ropeEndX, ropeEndY);
    ctx.rotate(ropeSway);

    const isHappy = mood === 'happy';
    const isPanic = mistakes >= 5 && !isDead;
    const isBlinking = Math.sin(t * 1.2) > 0.94;
    const breathOffset = Math.sin(t * 2.5) * 1.2;
    const cheerHopY = isHappy ? -Math.abs(Math.sin(t * 8)) * 5 : 0;

    ctx.translate(0, cheerHopY);

    // ── Head (Mistake >= 1) ──────────────────────────────────
    if (mistakes >= 1) {
      ctx.strokeStyle = isDead ? '#ef4444' : '#c084fc';
      ctx.shadowColor = isDead ? '#fca5a5' : '#c084fc';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;

      const headCenterY = 18;
      const headRadius = 16;
      ctx.beginPath();
      ctx.arc(0, headCenterY, headRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Facial Features
      ctx.save();
      if (isDead) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-6, 12); ctx.lineTo(-2, 18);
        ctx.moveTo(-2, 12); ctx.lineTo(-6, 18);
        ctx.moveTo(2, 12);  ctx.lineTo(6, 18);
        ctx.moveTo(6, 12);  ctx.lineTo(2, 18);
        ctx.stroke();
      } else if (isHappy) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(-5, 16, 2.5, Math.PI, 0, false);
        ctx.arc(5, 16, 2.5, Math.PI, 0, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 20, 4.5, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();
      } else if (isPanic) {
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(-5, 15, isBlinking ? 0.5 : 2.5, 0, Math.PI * 2);
        ctx.arc(5, 15, isBlinking ? 0.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, 24);
        ctx.quadraticCurveTo(0, 21, 5, 24);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        if (isBlinking) {
          ctx.rect(-6, 15, 3, 1);
          ctx.rect(3, 15, 3, 1);
        } else {
          ctx.arc(-5, 15, 2, 0, Math.PI * 2);
          ctx.arc(5, 15, 2, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 22, 3, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Body Torso (Mistake >= 2) ───────────────────────────
    if (mistakes >= 2) {
      ctx.strokeStyle = isDead ? '#ef4444' : '#c084fc';
      ctx.lineWidth = 3.5;
      const torsoStartY = 34;
      const torsoEndY = 90 + breathOffset;
      ctx.beginPath();
      ctx.moveTo(0, torsoStartY);
      ctx.lineTo(0, torsoEndY);
      ctx.stroke();

      // ── Left Arm (Mistake >= 3) ───────────────────────────
      if (mistakes >= 3) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 48);
        if (isHappy) {
          ctx.lineTo(-24, 28);
        } else {
          ctx.lineTo(-24, 76 + breathOffset * 0.5);
        }
        ctx.stroke();
      }

      // ── Right Arm (Mistake >= 4) ──────────────────────────
      if (mistakes >= 4) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 48);
        if (isHappy) {
          ctx.lineTo(24, 28);
        } else {
          ctx.lineTo(24, 76 + breathOffset * 0.5);
        }
        ctx.stroke();
      }

      // ── Left Leg (Mistake >= 5) ───────────────────────────
      if (mistakes >= 5) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, torsoEndY);
        ctx.lineTo(-20, torsoEndY + 45);
        ctx.stroke();
      }

      // ── Right Leg (Mistake >= 6) ──────────────────────────
      if (mistakes >= 6) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, torsoEndY);
        ctx.lineTo(20, torsoEndY + 45);
        ctx.stroke();
      }

      // ── Left Hand Detail (Mistake >= 7) ───────────────────
      if (mistakes >= 7) {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(isHappy ? -24 : -24, isHappy ? 26 : 78, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Right Hand Detail (Mistake >= 8) ──────────────────
      if (mistakes >= 8) {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(isHappy ? 24 : 24, isHappy ? 26 : 78, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Left Foot (Mistake >= 9) ──────────────────────────
      if (mistakes >= 9) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-20, torsoEndY + 45);
        ctx.lineTo(-28, torsoEndY + 46);
        ctx.stroke();
      }

      // ── Right Foot (Mistake >= 10) ────────────────────────
      if (mistakes >= 10) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(20, torsoEndY + 45);
        ctx.lineTo(28, torsoEndY + 46);
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.restore();
  }

  function runDeathAnimation(ctx, w, h, onComplete) {
    let start = null;
    const duration = 2200; // ms

    const drawGallows = (doorAngle) => {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 14;

      // Pole & Beam
      ctx.beginPath();
      ctx.moveTo(50, 220);
      ctx.lineTo(50, 20);
      ctx.lineTo(150, 20);
      ctx.moveTo(50, 50);
      ctx.lineTo(80, 20);
      ctx.stroke();

      // Floor Trapdoor (swings open)
      ctx.beginPath();
      ctx.moveTo(20, 220);
      ctx.lineTo(50, 220);
      ctx.stroke();

      ctx.save();
      ctx.translate(50, 220);
      ctx.rotate(doorAngle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(60, 0);
      ctx.stroke();
      ctx.restore();
    };

    const drawSwingingMan = (angle, dropY, ropeSnapped) => {
      if (!ropeSnapped) {
        ctx.strokeStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(150, 20);
        ctx.lineTo(150 + Math.sin(angle) * 30, 20 + Math.cos(angle) * 30);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(150 + Math.sin(angle) * 30, 20 + Math.cos(angle) * 30 + dropY);
      ctx.rotate(angle);

      ctx.strokeStyle = '#ff3344';
      ctx.shadowColor = '#ff2a2a';
      ctx.shadowBlur = 16;

      // Head
      ctx.beginPath();
      ctx.arc(0, 15, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Dead eyes (X X)
      ctx.beginPath();
      ctx.moveTo(-7, 10); ctx.lineTo(-3, 16);
      ctx.moveTo(-3, 10); ctx.lineTo(-7, 16);
      ctx.moveTo(3, 10); ctx.lineTo(7, 16);
      ctx.moveTo(7, 10); ctx.lineTo(3, 16);
      ctx.stroke();

      // Body & Limbs
      ctx.beginPath();
      ctx.moveTo(0, 30); ctx.lineTo(0, 90);
      ctx.moveTo(0, 45); ctx.lineTo(-25, 75);
      ctx.moveTo(0, 45); ctx.lineTo(25, 75);
      ctx.moveTo(0, 90); ctx.lineTo(-20, 135);
      ctx.moveTo(0, 90); ctx.lineTo(20, 135);
      ctx.stroke();

      ctx.restore();
    };

    const loop = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      const scale = w / 220;
      ctx.scale(scale, scale);

      const doorAngle = Math.min(Math.PI / 2.2, (elapsed / 400) * (Math.PI / 2.2));
      const swingAngle = Math.sin(elapsed * 0.006) * 0.25 * Math.max(0, 1 - elapsed / 2000);

      let dropY = 0;
      let ropeSnapped = false;

      if (elapsed > 1600) {
        ropeSnapped = true;
        const fallT = (elapsed - 1600) / 1000;
        dropY = 0.5 * 1800 * (fallT * fallT);
      }

      drawGallows(doorAngle);
      drawSwingingMan(swingAngle, dropY, ropeSnapped);
      ctx.restore();

      if (elapsed < duration) {
        animFrameRef.current = requestAnimationFrame(loop);
      } else {
        if (onComplete) onComplete();
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }

  function runEscapeAnimation(ctx, w, h, mistakes, onComplete) {
    let start = null;
    const duration = 1800; // ms

    const loop = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      const scale = w / 220;
      ctx.scale(scale, scale);

      // Gallows
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(20, 220); ctx.lineTo(100, 220);
      ctx.moveTo(50, 220); ctx.lineTo(50, 20); ctx.lineTo(150, 20);
      ctx.moveTo(50, 50); ctx.lineTo(80, 20);
      ctx.stroke();

      // Broken rope
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(150, 20); ctx.lineTo(150, 38);
      ctx.stroke();

      // Stickman sprint off the right edge
      const sprintSpeed = (elapsed / 1000) * 160;
      const posX = 150 + sprintSpeed;
      const legCycle = Math.sin(elapsed * 0.02) * 22;

      ctx.save();
      ctx.translate(posX, 0);

      ctx.strokeStyle = '#22d3ee';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 16;

      // Head
      ctx.beginPath();
      ctx.arc(0, 65, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Body
      ctx.beginPath();
      ctx.moveTo(0, 80); ctx.lineTo(0, 140);
      // Running arms
      ctx.moveTo(0, 95); ctx.lineTo(-legCycle, 120);
      ctx.moveTo(0, 95); ctx.lineTo(legCycle, 120);
      // Running legs
      ctx.moveTo(0, 140); ctx.lineTo(-legCycle, 185);
      ctx.moveTo(0, 140); ctx.lineTo(legCycle, 185);
      ctx.stroke();

      ctx.restore();
      ctx.restore();

      if (elapsed < duration) {
        animFrameRef.current = requestAnimationFrame(loop);
      } else {
        if (onComplete) onComplete();
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }

  return (
    <div className="hangman-canvas-wrap">
      <canvas ref={canvasRef} id="hangman-canvas" className="hangman-canvas" />
    </div>
  );
}
