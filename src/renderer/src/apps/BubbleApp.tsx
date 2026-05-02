import { createSignal, onCleanup, onMount } from 'solid-js';
import { BubbleCanvas } from '../components/BubbleCanvas';
import type { DockPreview } from '../types';
import { formatCompactNumber } from '../utils';
import { useCodexData } from '../hooks/useCodexData';

const api = window.floatingApi;

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
  const [dockPreview, setDockPreview] = createSignal<DockPreview>({ active: false, edge: null });

  const usedPercent = () => Math.min(100, Math.max(0, store.today().percent));
  const edgeClass = () => (dockPreview().active && dockPreview().edge ? `dock-${dockPreview().edge}` : '');
  const remaining = () => formatCompactNumber(store.today().usage.remaining_quota);
  const buttonLabel = () =>
    `Codex 用量：今日剩余 ${remaining()}，已用 ${store.today().percentLabel}，状态 ${store.healthLabel()}`;

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

  function flushMove() {
    moveFrame = 0;
    const dx = pendingDx;
    const dy = pendingDy;
    pendingDx = 0;
    pendingDy = 0;
    if (dx || dy) {
      void api.moveBy({ dx, dy });
    }
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
    dragging = false;
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
      void api.snapBubble();
    } else {
      void api.togglePanel();
    }

    dragging = false;
  }

  function onPointerCancel(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    dragging = false;
    flushMove();
    void api.snapBubble();
  }

  function onMouseEnter() {
    window.clearTimeout(leaveTimer);
    hoverTimer = window.setTimeout(() => {
      void api.revealDockedBubble();
    }, 120);
  }

  function onMouseLeave() {
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
      class={`bubble-shell risk-${store.today().risk} status-${store.statusTone()} ${dockPreview().active ? 'dock-preview' : ''} ${edgeClass()}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
    >
      <button
        class="bubble-view"
        type="button"
        tabindex="-1"
        title="点击打开面板，拖动移动"
        aria-label={buttonLabel()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <BubbleCanvas
          remaining={remaining()}
          percent={usedPercent()}
          percentLabel={store.today().percentLabel}
          risk={store.today().risk}
          status={store.statusTone()}
        />
      </button>
    </main>
  );
}
