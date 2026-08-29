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
  onSpecialAnimComplete
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas dimensions for high DPI
    const width = 220;
    const height = 240;
    canvas.width = width;
    canvas.height = height;

    const mistakes = Math.max(0, maxLives - livesLeft);

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

    // Normal static / live draw
    drawHangmanStatic(ctx, width, height, mistakes);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [livesLeft, maxLives, isRoundOver, roundResult]);

  function drawHangmanStatic(ctx, w, h, mistakes) {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#a855f7';
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Base
    if (mistakes >= 1) {
      ctx.beginPath();
      ctx.moveTo(20, 220);
      ctx.lineTo(100, 220);
      ctx.stroke();
    }
    // 2. Pole
    if (mistakes >= 2) {
      ctx.beginPath();
      ctx.moveTo(50, 220);
      ctx.lineTo(50, 20);
      ctx.stroke();
    }
    // 3. Beam
    if (mistakes >= 3) {
      ctx.beginPath();
      ctx.moveTo(50, 20);
      ctx.lineTo(150, 20);
      ctx.moveTo(50, 50);
      ctx.lineTo(80, 20);
      ctx.stroke();
    }
    // 4. Rope
    if (mistakes >= 4) {
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(150, 20);
      ctx.lineTo(150, 50);
      ctx.stroke();
    }
    // 5. Head
    if (mistakes >= 5) {
      ctx.strokeStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.beginPath();
      ctx.arc(150, 65, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 6. Body
    if (mistakes >= 6) {
      ctx.beginPath();
      ctx.moveTo(150, 80);
      ctx.lineTo(150, 140);
      ctx.stroke();
    }
    // 7. Left Arm
    if (mistakes >= 7) {
      ctx.beginPath();
      ctx.moveTo(150, 95);
      ctx.lineTo(125, 120);
      ctx.stroke();
    }
    // 8. Right Arm
    if (mistakes >= 8) {
      ctx.beginPath();
      ctx.moveTo(150, 95);
      ctx.lineTo(175, 120);
      ctx.stroke();
    }
    // 9. Left Leg
    if (mistakes >= 9) {
      ctx.beginPath();
      ctx.moveTo(150, 140);
      ctx.lineTo(130, 185);
      ctx.stroke();
    }
    // 10. Right Leg
    if (mistakes >= 10) {
      ctx.beginPath();
      ctx.moveTo(150, 140);
      ctx.lineTo(170, 185);
      ctx.stroke();
    }
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
