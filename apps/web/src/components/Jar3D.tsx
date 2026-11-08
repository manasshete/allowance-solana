"use client";

import "./three-d.css";
import { useEffect, useRef } from "react";

export function Jar3D({ fillPercent = 100 }: { fillPercent?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = 160;
    const height = 220;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let t = 0;

    // Bubbles inside the liquid
    const bubbles = Array.from({ length: 8 }, () => ({
      x: Math.random() * 70 - 35,
      y: Math.random() * 80 + 30,
      r: Math.random() * 2 + 1,
      speed: Math.random() * 0.6 + 0.3,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      t += 0.03;

      const cx = width / 2;
      const cy = height / 2 + 8;
      const jarW = 44;
      const jarH = 68;

      // Outer ambient glow
      const glow = ctx.createRadialGradient(cx, cy + 10, 10, cx, cy + 10, 75);
      glow.addColorStop(0, "rgba(20, 241, 149, 0.28)");
      glow.addColorStop(0.5, "rgba(153, 69, 255, 0.12)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy + 10, 75, 0, Math.PI * 2);
      ctx.fill();

      // Jar floating float motion
      const floatY = Math.sin(t) * 3;

      // Back of jar (dark glass)
      ctx.fillStyle = "rgba(10, 32, 24, 0.7)";
      ctx.beginPath();
      ctx.roundRect(cx - jarW, cy - jarH + floatY, jarW * 2, jarH * 2, 16);
      ctx.fill();

      // Liquid fill
      const liquidHeight = (jarH * 1.8 * Math.min(Math.max(fillPercent, 10), 100)) / 100;
      const liquidTop = cy + jarH - liquidHeight + floatY;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx - jarW + 3, cy - jarH + 3 + floatY, jarW * 2 - 6, jarH * 2 - 6, 14);
      ctx.clip();

      // Liquid gradient
      const liquidGrad = ctx.createLinearGradient(0, liquidTop, 0, cy + jarH + floatY);
      liquidGrad.addColorStop(0, "#14F195");
      liquidGrad.addColorStop(0.3, "#0d925e");
      liquidGrad.addColorStop(1, "#073e2a");
      ctx.fillStyle = liquidGrad;

      // Liquid wave surface
      ctx.beginPath();
      ctx.moveTo(cx - jarW, cy + jarH + floatY);
      ctx.lineTo(cx - jarW, liquidTop);
      for (let x = cx - jarW; x <= cx + jarW; x += 4) {
        const wave = Math.sin((x / 14) + t * 2) * 2.5;
        ctx.lineTo(x, liquidTop + wave);
      }
      ctx.lineTo(cx + jarW, cy + jarH + floatY);
      ctx.closePath();
      ctx.fill();

      // Bubbles
      bubbles.forEach((b) => {
        b.y -= b.speed;
        if (b.y < -10) b.y = 80;
        const bx = cx + b.x + Math.sin(t + b.y * 0.1) * 2;
        const by = cy + jarH - b.y + floatY;
        if (by > liquidTop) {
          ctx.beginPath();
          ctx.arc(bx, by, b.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fill();
        }
      });

      ctx.restore();

      // Glass highlights (specular reflections on edges)
      const glassBorder = ctx.createLinearGradient(cx - jarW, 0, cx + jarW, 0);
      glassBorder.addColorStop(0, "rgba(20, 241, 149, 0.7)");
      glassBorder.addColorStop(0.2, "rgba(255, 255, 255, 0.4)");
      glassBorder.addColorStop(0.5, "rgba(20, 241, 149, 0.1)");
      glassBorder.addColorStop(0.8, "rgba(255, 255, 255, 0.2)");
      glassBorder.addColorStop(1, "rgba(20, 241, 149, 0.6)");

      ctx.beginPath();
      ctx.roundRect(cx - jarW, cy - jarH + floatY, jarW * 2, jarH * 2, 16);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = glassBorder;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#14F195";
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Specular highlight line along left side
      ctx.beginPath();
      ctx.moveTo(cx - jarW + 6, cy - jarH + 16 + floatY);
      ctx.lineTo(cx - jarW + 6, cy + jarH - 16 + floatY);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.stroke();

      // Floating jar lid
      const lidY = cy - jarH - 8 + floatY + Math.sin(t * 1.5) * 1.5;
      const lidW = 32;

      // Lid neck
      ctx.fillStyle = "#1e1e24";
      ctx.beginPath();
      ctx.roundRect(cx - lidW + 4, cy - jarH - 2 + floatY, (lidW - 4) * 2, 6, 2);
      ctx.fill();

      // Metallic top cap
      const lidGrad = ctx.createLinearGradient(cx - lidW, 0, cx + lidW, 0);
      lidGrad.addColorStop(0, "#4a4a58");
      lidGrad.addColorStop(0.5, "#8a8aa0");
      lidGrad.addColorStop(1, "#363644");
      ctx.fillStyle = lidGrad;
      ctx.beginPath();
      ctx.roundRect(cx - lidW, lidY, lidW * 2, 9, 4);
      ctx.fill();

      // Glowing indicator ring on lid
      ctx.beginPath();
      ctx.roundRect(cx - lidW + 6, lidY + 3, (lidW - 6) * 2, 3, 2);
      ctx.fillStyle = "#14F195";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#14F195";
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, [fillPercent]);

  return (
    <div className="jar-3d-wrap">
      <canvas ref={canvasRef} className="jar-3d-canvas" />
    </div>
  );
}
