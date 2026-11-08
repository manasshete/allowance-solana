"use client";

import "./three-d.css";
import { useEffect, useRef, useState } from "react";

export function Radar3D({ activeContact }: { activeContact?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const size = 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let t = 0;
    const cx = size / 2;
    const cy = size / 2 - 15;

    // Floating 3D cubes around the center
    const cubes = [
      { r: 75, angle: 0.2, speed: 0.015, size: 16, color: "#9945FF" },
      { r: 95, angle: 1.8, speed: -0.012, size: 20, color: "#14F195" },
      { r: 60, angle: 3.4, speed: 0.02, size: 14, color: "#ca9ff5" },
      { r: 110, angle: 4.8, speed: -0.01, size: 18, color: "#80ecff" },
    ];

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      t += 0.025;

      // Draw isometric grid lines
      ctx.strokeStyle = "rgba(236, 228, 253, 0.07)";
      ctx.lineWidth = 1;
      for (let x = 30; x <= size - 30; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, size - 40);
        ctx.stroke();
      }
      for (let y = 20; y <= size - 40; y += 22) {
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(size - 30, y);
        ctx.stroke();
      }

      // Radar scanning beam
      const scanAngle = t * 1.5;
      const grad = ctx.createConicGradient(scanAngle, cx, cy);
      grad.addColorStop(0, "rgba(20, 241, 149, 0.25)");
      grad.addColorStop(0.15, "rgba(153, 69, 255, 0.08)");
      grad.addColorStop(0.3, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 110, 0, Math.PI * 2);
      ctx.fill();

      // Concentric range rings
      [40, 75, 110].forEach((radius) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(20, 241, 149, 0.25)";
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Orbiting 3D floating nodes
      cubes.forEach((c) => {
        c.angle += c.speed;
        const x = cx + Math.cos(c.angle) * c.r;
        const y = cy + Math.sin(c.angle) * c.r * 0.55; // isometric projection squish

        // Draw node
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t + c.angle);

        ctx.fillStyle = "rgba(16, 16, 24, 0.9)";
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = c.color;
        ctx.beginPath();
        ctx.roundRect(-c.size / 2, -c.size / 2, c.size, c.size, 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // Center Contact Target Pad
      const padSize = 48;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(18, 20, 26, 0.95)";
      ctx.strokeStyle = isListening ? "#14F195" : "#ca9ff5";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 16;
      ctx.shadowColor = isListening ? "#14F195" : "#ca9ff5";
      ctx.beginPath();
      ctx.roundRect(-padSize / 2, -padSize / 2, padSize, padSize, 12);
      ctx.fill();
      ctx.stroke();

      // Center Icon or target badge
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Mini target badge on bottom right
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.roundRect(14, 14, 28, 14, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#14F195";
      ctx.font = "8px monospace";
      ctx.fillText("G...", 18, 24);

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, [isListening, activeContact]);

  return (
    <div className="radar-3d-wrap">
      <canvas ref={canvasRef} className="radar-3d-canvas" />

      <div className="radar-3d-overlay">
        <div>
          <span className="radar-3d-sub">RESOLVER</span>
          <h4 className="radar-3d-title">
            {activeContact ? `mapped: ${activeContact}` : "speak a name"}
          </h4>
          <p className="radar-3d-rule">One name, one address — never guesses</p>
        </div>

        <button
          type="button"
          className={`radar-3d-toggle ${isListening ? "is-live" : ""}`}
          onClick={() => setIsListening(!isListening)}
        >
          <span>{isListening ? "Listening" : "Standby"}</span>
          <span className="radar-3d-dot" />
        </button>
      </div>
    </div>
  );
}
