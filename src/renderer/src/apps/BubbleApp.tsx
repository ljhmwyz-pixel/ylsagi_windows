import { createSignal, onCleanup, onMount } from 'solid-js';
import type { DockPreview } from '../types';
import { formatCompactNumber, formatNumber } from '../utils';
import { useCodexData } from '../hooks/useCodexData';

const api = window.floatingApi;

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export function BubbleApp() {
  const store = useCodexData();
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragging = false;
  let pointerId: number | null = null;
  let hoverTimer: number | undefined;
  let leaveTimer: number | undefined;
  let pendingDx = 0;
  let pendingDy = 0;
  let moveFrame = 0;
  let particleId = 0;
  let lastParticleTime = 0;
  let velocityX = 0;
  let velocityY = 0;
  let lastMoveTime = 0;

  const [dockPreview, setDockPreview] = createSignal<DockPreview>({ active: false, edge: null });
  const [isHovered, setIsHovered] = createSignal(false);
  const [particles, setParticles] = createSignal<Particle[]>([]);
  const [dragVelocity, setDragVelocity] = createSignal({ x: 0, y: 0 });
  const [isDraggingState, setIsDraggingState] = createSignal(false);

  const usedPercent = () => Math.min(100, Math.max(0, store.today().percent));
  const edgeClass = () => (dockPreview().active && dockPreview().edge ? `dock-${dockPreview().edge}` : '');
  const remaining = () => formatCompactNumber(store.today().usage.remaining_quota);
  const requestCount = () => formatNumber(store.today().usage.request_count);
  const statusLabel = () => {
    const tone = store.statusTone();
    if (tone === 'loading') return '同步中';
    if (tone === 'cached') return '缓存';
    if (tone === 'danger') return '高风险';
    if (tone === 'warn') return '注意';
    return '正常';
  };
  const buttonLabel = () =>
    `今日剩余 ${remaining()}，已用 ${store.today().percentLabel}，状态 ${store.healthLabel()}`;

  onMount(() => {
    const unsubscribe = api.onDockPreview((preview) => {
      setDockPreview({
        active: Boolean(preview?.active),
        edge: preview?.edge || null
      });
    });

    onCleanup(() => {
      unsubscribe();
      window.cancelAnimationFrame(moveFrame);
    });
  });

  function spawnParticles(x: number, y: number, count: number, velocityMag: number) {
    const now = Date.now();
    if (now - lastParticleTime < 16) return;
    lastParticleTime = now;

    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * velocityMag * 0.5 + velocityMag * 0.3;
      newParticles.push({
        id: particleId++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 30 + Math.random() * 20,
        size: 2 + Math.random() * 3
      });
    }
    setParticles((prev) => [...prev.slice(-30), ...newParticles]);
  }

  function updateParticles() {
    setParticles((prev) =>
      prev
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vx: p.vx * 0.95,
          vy: p.vy * 0.95,
          life: p.life - 1 / p.maxLife
        }))
        .filter((p) => p.life > 0)
    );
  }

  function flushMove() {
    moveFrame = 0;
    const dx = pendingDx;
    const dy = pendingDy;
    pendingDx = 0;
    pendingDy = 0;
    if (dx || dy) {
      void api.moveBy({ dx, dy });
      const now = Date.now();
      const dt = now - lastMoveTime;
      if (dt > 0) {
        velocityX = dx / dt * 16;
        velocityY = dy / dt * 16;
        setDragVelocity({ x: velocityX, y: velocityY });
      }
      lastMoveTime = now;

      const shellEl = document.querySelector('.bubble-shell');
      if (shellEl) {
        const rect = shellEl.getBoundingClientRect();
        spawnParticles(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          Math.min(Math.hypot(dx, dy) * 0.3, 3),
          Math.hypot(dx, dy)
        );
      }
    }
    requestAnimationFrame(updateParticles);
  }

  function queueMove(dx: number, dy: number) {
    pendingDx += dx;
    pendingDy += dy;
    if (!moveFrame) {
      moveFrame = window.requestAnimationFrame(flushMove);
    }
  }

  function onPointerDown(event: PointerEvent) {
    const target = event.currentTarget as HTMLButtonElement;
    pointerId = event.pointerId;
    startX = event.screenX;
    startY = event.screenY;
    lastX = event.screenX;
    lastY = event.screenY;
    lastMoveTime = Date.now();
    dragging = false;
    setIsDraggingState(false);
    setParticles([]);
    window.clearTimeout(leaveTimer);
    window.clearTimeout(hoverTimer);
    target.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;

    const totalDx = event.screenX - startX;
    const totalDy = event.screenY - startY;
    const dx = event.screenX - lastX;
    const dy = event.screenY - lastY;

    if (!dragging && Math.hypot(totalDx, totalDy) > 4) {
      dragging = true;
      setIsDraggingState(true);
      void api.beginDrag();
    }

    if (dragging && (dx || dy)) {
      lastX = event.screenX;
      lastY = event.screenY;
      queueMove(dx, dy);
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;
    const target = event.currentTarget as HTMLButtonElement;
    target.releasePointerCapture(event.pointerId);
    pointerId = null;

    if (dragging) {
      flushMove();
      setTimeout(() => setIsDraggingState(false), 300);
      void api.snapBubble();
    } else {
      void api.togglePanel();
    }

    dragging = false;
    setDragVelocity({ x: 0, y: 0 });
  }

  function onPointerCancel(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    dragging = false;
    setIsDraggingState(false);
    flushMove();
    void api.snapBubble();
  }

  function onMouseEnter() {
    setIsHovered(true);
    window.clearTimeout(leaveTimer);
    hoverTimer = window.setTimeout(() => {
      void api.revealDockedBubble();
    }, 120);
  }

  function onMouseLeave() {
    setIsHovered(false);
    window.clearTimeout(hoverTimer);
    if (dragging || pointerId !== null) return;
    leaveTimer = window.setTimeout(() => {
      void api.hideDockedBubble();
    }, 260);
  }

  function onContextMenu(event: MouseEvent) {
    event.preventDefault();
    void api.showBubbleMenu();
  }

  return (
    <main
      class={`bubble-shell risk-${store.today().risk} status-${store.statusTone()} ${dockPreview().active ? 'dock-preview' : ''} ${edgeClass()} ${isDraggingState() ? 'is-dragging' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
    >
      <div class="particle-container" aria-hidden="true">
        {particles().map((p) => (
          <div
            class="particle"
            style={{
              left: `${p.x}px`,
              top: `${p.y}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.life,
              transform: `scale(${p.life})`
            }}
          />
        ))}
      </div>
      <button
        class="bubble-view"
        type="button"
        tabindex="-1"
        aria-label={buttonLabel()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <span class="capsule-mark" aria-hidden="true">
          <svg class="progress-ring" viewBox="0 0 40 40" aria-hidden="true">
            <circle
              class="progress-ring-track"
              cx="20"
              cy="20"
              r="17"
            />
            <circle
              class="progress-ring-value"
              cx="20"
              cy="20"
              r="17"
              stroke-dashoffset={`${106.8 - (usedPercent() / 100) * 106.8}`}
              style={{ transform: 'rotate(-90deg)', 'transform-origin': 'center' }}
            />
          </svg>
          <span class="inner-glow" />
          <span class="outer-ring" />
        </span>
        <span class="capsule-main">
          <span class="capsule-label">
            <span class="capsule-dot" aria-hidden="true" />
            {statusLabel()}
          </span>
          <strong class="quota-value">{remaining()}</strong>
        </span>
        <span class="capsule-side">
          <strong class="percent-value">{store.today().percentLabel}</strong>
          <span class="request-count">{requestCount()} 请求</span>
        </span>
      </button>
    </main>
  );
}
