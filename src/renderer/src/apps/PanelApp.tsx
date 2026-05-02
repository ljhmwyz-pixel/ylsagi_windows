import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import logoUrl from '../assets/logo2.png';
import { Icon } from '../components/Icon';
import { PackageList } from '../components/PackageList';
import { SettingsPanel } from '../components/SettingsPanel';
import { UsageCard } from '../components/UsageCard';
import { useCodexData } from '../hooks/useCodexData';
import type { PanelLayout } from '../types';
import { formatNumber, packageLabel } from '../utils';

const api = window.floatingApi;

export function PanelApp() {
  const store = useCodexData();
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [visible, setVisible] = createSignal(false);
  const [layout, setLayout] = createSignal<PanelLayout>({ side: 'left', arrowY: 52 });
  let contentRef!: HTMLElement;
  let resizeFrame = 0;

  function requestPanelResize() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      if (!contentRef) return;
      const nextHeight = Math.ceil(contentRef.scrollHeight);
      void api.resizePanelToContent(nextHeight);
    });
  }

  onMount(() => {
    const unsubs = [
      api.onOpenSettings(() => setSettingsOpen(true)),
      api.onPanelVisibility((next) => setVisible(next)),
      api.onPanelLayout((next) => {
        setLayout({
          side: next?.side === 'right' ? 'right' : 'left',
          arrowY: Number.isFinite(next?.arrowY) ? next.arrowY : 52
        });
      })
    ];

    const observer = new ResizeObserver(requestPanelResize);
    observer.observe(contentRef);
    requestPanelResize();

    onCleanup(() => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      observer.disconnect();
      window.cancelAnimationFrame(resizeFrame);
    });
  });

  createEffect(() => {
    settingsOpen();
    store.alert();
    store.info();
    store.today().percent;
    store.week().percent;
    visible();
    requestPanelResize();
  });

  async function saveSettings(
    token: string,
    refreshSeconds: number,
    alwaysOnTop: boolean,
    panelLightDismiss: boolean,
    launchAtLogin: boolean
  ) {
    await api.saveSettings({
      token,
      refreshSeconds,
      compact: true,
      alwaysOnTop,
      panelLightDismiss,
      launchAtLogin
    });
    const next = await store.loadSettings();
    setSettingsOpen(false);
    store.notify('设置已保存');
    await store.fetchAndRender();
  }

  async function clearToken() {
    await api.clearToken();
    await store.loadSettings();
    store.notify('已清除保存的 Token');
  }

  async function copyDiagnostics() {
    await api.copyDiagnostics();
    store.notify('诊断信息已复制');
  }

  return (
    <main
      class={`panel-shell anchor-${layout().side} risk-${store.worstRisk()} ${visible() ? 'is-visible' : ''} ${store.loading() ? 'is-loading' : ''}`}
      style={{ '--arrow-y': `${layout().arrowY}px` }}
    >
      <section class="panel-content" ref={contentRef}>
        <header class="titlebar">
          <div class="drag-zone">
            <img class="brand-mark" src={logoUrl} alt="" aria-hidden="true" />
            <div class="title-stack">
              <div class="title">Codex 用量</div>
              <div class="subtitle">
                <span class={`status-dot ${store.statusTone()}`} />
                <span>{store.subtitle()}</span>
              </div>
            </div>
          </div>
          <div class="window-actions">
            <button class="icon-button" title="设置" aria-label="设置" onClick={() => setSettingsOpen(true)}>
              <Icon name="settings" />
            </button>
            <button class="icon-button" title="刷新" aria-label="刷新" onClick={store.fetchAndRender}>
              <Icon name="refresh" />
            </button>
            <button class="icon-button" title="关闭面板" aria-label="关闭面板" onClick={() => api.hidePanel()}>
              <Icon name="close" />
            </button>
          </div>
        </header>

        <Show when={store.alert()}>
          {(item) => (
            <section class="alert-banner" data-tone={item().tone}>
              {item().message}
            </section>
          )}
        </Show>

        <section class="identity-strip">
          <div class="user-line">
            <span id="email">{store.info()?.user?.email || store.info()?.user?.uid || '未知用户'}</span>
            <span class="level-pill">{packageLabel(store.info()?.package?.package_level)}</span>
          </div>
          <div class="balance-line">
            <span>余额</span>
            <strong>{formatNumber(store.info()?.userAccountInfo?.total_balance)}</strong>
          </div>
        </section>

        <section class="usage-stack">
          <UsageCard title="今日剩余" usage={store.today()} primary />
          <UsageCard title="本周剩余" usage={store.week()} />
        </section>

        <section class="quick-stats">
          <div>
            <span>今日请求</span>
            <strong>{formatNumber(store.today().usage.request_count)}</strong>
          </div>
          <div>
            <span>今日 Tokens</span>
            <strong>{formatNumber(store.today().usage.total_tokens)}</strong>
          </div>
          <div>
            <span>本周请求</span>
            <strong>{formatNumber(store.week().usage.request_count)}</strong>
          </div>
        </section>

        <section class="package-section">
          <div class="section-head">
            <span>订阅包</span>
            <span>{store.info()?.toDay || '-'}</span>
          </div>
          <PackageList packages={store.info()?.package?.packages || []} />
        </section>

        <SettingsPanel
          open={settingsOpen()}
          settings={store.settings()}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onClearToken={clearToken}
          onCopyDiagnostics={copyDiagnostics}
        />

        <div class={`toast ${store.toast() ? 'show' : ''}`} aria-live="polite">
          {store.toast()}
        </div>
      </section>
    </main>
  );
}
