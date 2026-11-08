"use client";

import "./three-d.css";
import { useEffect, useRef } from "react";

type BlueprintHUDProps = {
  clientName?: string;
  durationHours?: string;
  dailyBudget?: string;
  perTxMax?: string;
  requireApproval?: string;
  allowSwap?: boolean;
  allowX402?: boolean;
};

export function BlueprintHUD({
  clientName = "Claude",
  durationHours = "24",
  dailyBudget = "100",
  perTxMax = "20",
  requireApproval = "15",
  allowSwap = false,
  allowX402 = true,
}: BlueprintHUDProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = 340;
    const height = 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let t = 0;

    // Ambient floating HUD geometry
    const nodes = [
      { x: 40, y: 80, size: 24, speed: 0.015 },
      { x: 300, y: 90, size: 20, speed: -0.012 },
      { x: 50, y: 320, size: 18, speed: 0.02 },
      { x: 290, y: 310, size: 22, speed: -0.015 },
    ];

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      t += 0.02;

      // Draw faint cyber blueprint grid
      ctx.strokeStyle = "rgba(153, 69, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 20; x <= width - 20; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, height - 20);
        ctx.stroke();
      }
      for (let y = 20; y <= height - 20; y += 25) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
      }

      // Floating floating cubes in corners
      nodes.forEach((n, i) => {
        const floatY = Math.sin(t + i) * 6;
        ctx.save();
        ctx.translate(n.x, n.y + floatY);
        ctx.rotate(t * 0.5 + i);
        ctx.strokeStyle = "rgba(153, 69, 255, 0.35)";
        ctx.fillStyle = "rgba(20, 15, 30, 0.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(-n.size / 2, -n.size / 2, n.size, n.size, 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, []);

  const clientInitial = clientName ? clientName[0].toUpperCase() : "C";

  return (
    <div className="blueprint-card">
      <canvas ref={canvasRef} className="blueprint-canvas" />

      <div className="blueprint-content">
        <div className="blueprint-head">
          <span className="blueprint-label">POLICY BLUEPRINT</span>
          <span className="blueprint-badge">DRAFTING</span>
        </div>

        <div className="blueprint-center">
          <div className="blueprint-avatar">
            <span>{clientInitial}</span>
          </div>
          <h3 className="blueprint-title">{clientName || "Claude"}</h3>
          <span className="blueprint-sub">{clientName || "Claude"} · USDC</span>
        </div>

        <div className="blueprint-metrics">
          <div className="blueprint-metric">
            <span className="blueprint-metric__tag">DURATION</span>
            <span className="blueprint-metric__val figure">{durationHours}h</span>
          </div>
          <div className="blueprint-metric">
            <span className="blueprint-metric__tag">DAILY</span>
            <span className="blueprint-metric__val figure">{dailyBudget}</span>
          </div>
          <div className="blueprint-metric">
            <span className="blueprint-metric__tag">PER TX</span>
            <span className="blueprint-metric__val figure">{perTxMax}</span>
          </div>
          <div className="blueprint-metric">
            <span className="blueprint-metric__tag">APPROVE</span>
            <span className="blueprint-metric__val figure">&gt;{requireApproval}</span>
          </div>
        </div>

        <div className="blueprint-flags">
          <span className={`blueprint-flag ${allowSwap ? "is-active" : ""}`}>
            SWAP EXECUTE {allowSwap ? "ON" : "OFF"}
          </span>
          <span className={`blueprint-flag ${allowX402 ? "is-active" : ""}`}>
            X402 {allowX402 ? "ON" : "OFF"}
          </span>
          <span className="blueprint-flag is-active">PHANTOM GATE</span>
        </div>

        <p className="blueprint-hint">Limits update live as you edit the form.</p>
      </div>
    </div>
  );
}
