import { createEffect, onCleanup, onMount } from 'solid-js';
import type { RiskLevel } from '../utils';

const CSS_SIZE = 88;
const TAU = Math.PI * 2;
const FONT_STACK = '"Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", Arial, sans-serif';

interface BubbleCanvasProps {
  remaining: string;
  percent: number;
  percentLabel: string;
  risk: RiskLevel;
  status: string;
}

interface BubbleSnapshot extends BubbleCanvasProps {
  pulse: number;
}

const themes: Record<RiskLevel, {
  accent: string;
  accentSoft: string;
  accentDim: string;
  top: string;
  mid: string;
  bottom: string;
  innerTop: string;
  innerBottom: string;
}> = {
  ok: {
    accent: '#43d6b8',
    accentSoft: 'rgba(67, 214, 184, 0.34)',
    accentDim: 'rgba(67, 214, 184, 0.13)',
    top: '#2a3435',
    mid: '#131c1d',
    bottom: '#080c0d',
    innerTop: '#202a2b',
    innerBottom: '#0a0e0f'
  },
  warn: {
    accent: '#e4b85c',
    accentSoft: 'rgba(228, 184, 92, 0.34)',
    accentDim: 'rgba(228, 184, 92, 0.13)',
    top: '#312b20',
    mid: '#19150f',
    bottom: '#0e0c08',
    innerTop: '#292318',
    innerBottom: '#0f0c08'
  },
  danger: {
    accent: '#ff7b72',
    accentSoft: 'rgba(255, 123, 114, 0.34)',
    accentDim: 'rgba(255, 123, 114, 0.12)',
    top: '#332427',
    mid: '#1a1113',
    bottom: '#10090a',
    innerTop: '#2b1b1e',
    innerBottom: '#10090a'
  }
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function applyCanvasSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.round(rect.width || CSS_SIZE);
  const height = Math.round(rect.height || CSS_SIZE);
  const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
  const scale = Math.max(2, dpr);
  const pixelWidth = Math.round(width * scale);
  const pixelHeight = Math.round(height * scale);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  return { width, height, scale };
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, minSize: number) {
  for (let size = startSize; size >= minSize; size -= 0.5) {
    ctx.font = `760 ${size}px ${FONT_STACK}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }

  return minSize;
}

function drawBubble(canvas: HTMLCanvasElement, snapshot: BubbleSnapshot) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const { width, height, scale } = applyCanvasSize(canvas);
  const cx = width / 2;
  const cy = height / 2;
  const theme = themes[snapshot.risk] || themes.ok;
  const percent = clamp(snapshot.percent, 0, 100);
  const loadingGlow = snapshot.status === 'loading' ? snapshot.pulse : 0;
  const cached = snapshot.status === 'cached';
  const accent = cached ? themes.warn.accent : theme.accent;
  const accentSoft = cached ? themes.warn.accentSoft : theme.accentSoft;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const outerRadius = Math.min(width, height) / 2 - 3.2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, TAU);
  ctx.clip();

  const body = ctx.createRadialGradient(cx - 18, cy - 24, 1, cx, cy + 8, outerRadius + 8);
  body.addColorStop(0, '#394243');
  body.addColorStop(0.28, theme.top);
  body.addColorStop(0.66, theme.mid);
  body.addColorStop(1, theme.bottom);
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, width, height);

  const lowerShade = ctx.createRadialGradient(cx + 16, cy + 32, 4, cx + 18, cy + 34, 46);
  lowerShade.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
  lowerShade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = lowerShade;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.42 + loadingGlow * 0.14;
  const ambient = ctx.createRadialGradient(cx - 20, cy - 18, 1, cx - 14, cy - 15, 44);
  ambient.addColorStop(0, accentSoft);
  ambient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 5.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius - 3.6, -Math.PI / 2, Math.PI * 1.5);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.105)';
  ctx.stroke();

  if (percent > 0.4) {
    const arcGradient = ctx.createLinearGradient(18, 12, 72, 76);
    arcGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    arcGradient.addColorStop(0.16, accent);
    arcGradient.addColorStop(1, accentSoft);
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius - 3.6, -Math.PI / 2, -Math.PI / 2 + TAU * (percent / 100));
    ctx.strokeStyle = arcGradient;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  const innerRadius = 33.6;
  ctx.beginPath();
  ctx.arc(cx, cy - 1, innerRadius, 0, TAU);
  const inner = ctx.createRadialGradient(cx - 12, cy - 20, 1, cx, cy + 12, innerRadius + 10);
  inner.addColorStop(0, theme.innerTop);
  inner.addColorStop(0.62, '#111718');
  inner.addColorStop(1, theme.innerBottom);
  ctx.fillStyle = inner;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
  ctx.shadowBlur = 11;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const topShine = ctx.createLinearGradient(0, 0, 0, 44);
  topShine.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  topShine.addColorStop(0.44, 'rgba(255, 255, 255, 0.05)');
  topShine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = topShine;
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy - 24, 27, 13, -0.12, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7fbfb';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
  ctx.shadowBlur = 2;
  const numberSize = fitFont(ctx, snapshot.remaining, 55, 25, 18);
  ctx.font = `760 ${numberSize}px ${FONT_STACK}`;
  ctx.fillText(snapshot.remaining, cx, cy - 6);

  ctx.shadowColor = 'transparent';
  ctx.font = `650 9px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(245, 248, 248, 0.54)';
  ctx.fillText('剩余', cx, cy + 16);
  ctx.restore();

  ctx.save();
  const pillText = snapshot.percentLabel;
  ctx.font = `780 10px ${FONT_STACK}`;
  const pillWidth = clamp(ctx.measureText(pillText).width + 15, 35, 55);
  const pillHeight = 16;
  const pillX = cx - pillWidth / 2;
  const pillY = height - 24;
  roundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 8);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = snapshot.status === 'loading' ? accentSoft : 'rgba(255, 255, 255, 0.09)';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.fillText(pillText, cx, pillY + pillHeight / 2 + 0.3);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius - 0.5, 0, TAU);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const edgeFade = ctx.createRadialGradient(cx, cy, outerRadius - 6, cx, cy, outerRadius + 1);
  edgeFade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edgeFade.addColorStop(0.74, 'rgba(0, 0, 0, 0.08)');
  edgeFade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = edgeFade;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function BubbleCanvas(props: BubbleCanvasProps) {
  let canvasRef!: HTMLCanvasElement;
  let frame = 0;
  let observer: ResizeObserver | undefined;

  function snapshot(pulse = 0): BubbleSnapshot {
    return {
      remaining: props.remaining,
      percent: props.percent,
      percentLabel: props.percentLabel,
      risk: props.risk,
      status: props.status,
      pulse
    };
  }

  createEffect(() => {
    const next = snapshot();
    window.cancelAnimationFrame(frame);

    if (next.status === 'loading') {
      const tick = (time: number) => {
        const pulse = (Math.sin(time / 240) + 1) / 2;
        drawBubble(canvasRef, { ...next, pulse });
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
      return;
    }

    frame = window.requestAnimationFrame(() => drawBubble(canvasRef, next));
  });

  onMount(() => {
    observer = new ResizeObserver(() => drawBubble(canvasRef, snapshot()));
    observer.observe(canvasRef);
    drawBubble(canvasRef, snapshot());
  });

  onCleanup(() => {
    window.cancelAnimationFrame(frame);
    observer?.disconnect();
  });

  return <canvas ref={canvasRef} class="bubble-canvas" width={CSS_SIZE} height={CSS_SIZE} aria-hidden="true" />;
}
