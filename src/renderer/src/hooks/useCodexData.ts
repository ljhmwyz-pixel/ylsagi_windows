import { createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { ApiError, ApifoxModel, DataState, Settings } from '../types';
import { formatTime, usageSummary } from '../utils';

const api = window.floatingApi;
const defaultFreshness: DataState['freshness'] = { ageMs: null, stale: false, expired: false };

const defaultSettings: Settings = {
  hasToken: false,
  tokenSource: 'none',
  tokenStorage: 'none',
  schemaVersion: 0,
  refreshSeconds: 60,
  compact: true,
  alwaysOnTop: true,
  panelLightDismiss: true,
  launchAtLogin: false
};

export function useCodexData() {
  const [settings, setSettings] = createSignal<Settings>(defaultSettings);
  const [data, setData] = createSignal<ApifoxModel | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = createSignal<string | null>(null);
  const [freshness, setFreshness] = createSignal<DataState['freshness']>(defaultFreshness);
  const [loading, setLoading] = createSignal(false);
  const [alert, setAlert] = createSignal<{ message: string; tone: 'warn' | 'danger' } | null>(null);
  const [toast, setToast] = createSignal('');
  const [cached, setCached] = createSignal(false);

  let toastTimer: number | undefined;

  const info = createMemo(() => data()?.state);
  const today = createMemo(() => usageSummary(info()?.userPackgeUsage));
  const week = createMemo(() => usageSummary(info()?.userPackgeUsage_week));
  const worstRisk = createMemo(() => (today().percent >= week().percent ? today().risk : week().risk));
  const subtitle = createMemo(() => {
    if (loading()) return '正在刷新';
    if (alert()) return data() ? '数据可能已过期' : '刷新失败';
    if (cached()) return lastFetchedAt() ? `缓存 ${freshnessLabel() || formatTime(lastFetchedAt() || undefined)}` : '缓存数据';
    return lastFetchedAt() ? `已更新 ${formatTime(lastFetchedAt() || undefined)}` : '等待刷新';
  });
  const statusTone = createMemo(() => {
    if (loading()) return 'loading';
    if (alert()) return alert()?.tone || 'warn';
    if (cached()) return 'cached';
    return worstRisk();
  });
  const healthLabel = createMemo(() => {
    if (loading()) return '同步中';
    if (alert()?.tone === 'danger') return '需处理';
    if (alert()) return '离线缓存';
    if (cached()) return '缓存';
    if (worstRisk() === 'danger') return '高风险';
    if (worstRisk() === 'warn') return '注意';
    return '正常';
  });

  function notify(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setToast(''), 2600);
  }

  async function loadSettings() {
    const next = await api.getSettings();
    setSettings(next);
    return next;
  }

  function staleMessage(error: ApiError) {
    if (!data()) return error.message || '请求失败';
    const time = lastFetchedAt() ? `上次成功 ${formatTime(lastFetchedAt() || undefined)}` : '正在显示上次成功数据';

    if (error.code === 'NO_TOKEN') return '需要配置 Token';
    if (error.status === 401 || error.status === 403) return `Token 可能无效，${time}`;
    if (error.status) return `接口异常 HTTP ${error.status}，${time}`;
    return `网络不可用，${time}`;
  }

  function freshnessLabel(value = freshness()) {
    if (!Number.isFinite(value.ageMs ?? NaN)) return '';
    const minutes = Math.max(1, Math.round((value.ageMs || 0) / 60000));
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.max(1, Math.round(minutes / 60));
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.max(1, Math.round(hours / 24))} 天前`;
  }

  function applyDataState(next: DataState, options: { notifyErrors?: boolean } = {}) {
    setLoading(Boolean(next.loading));
    setData(next.data);
    setLastFetchedAt(next.fetchedAt);
    setFreshness(next.freshness || defaultFreshness);
    setCached(Boolean(next.cached));

    if (next.error) {
      const tone = next.error.code === 'NO_TOKEN' ? 'danger' : 'warn';
      setAlert({ message: staleMessage(next.error), tone });
      if (options.notifyErrors) {
        notify(next.error.message || '请求失败');
      }
      return;
    }

    if (next.cached) {
      const message = next.warning?.message || '网络不可用';
      const age = freshnessLabel(next.freshness || defaultFreshness);
      const prefix = age ? `正在显示 ${age} 的缓存数据` : '正在显示缓存数据';
      setAlert({ message: `${prefix}，${message}`, tone: next.freshness?.expired ? 'danger' : 'warn' });
      if (options.notifyErrors) {
        notify('已显示上次成功数据');
      }
      return;
    }

    setAlert(null);
    if (next.data && Number(next.data.code) !== 0 && next.data.msg && options.notifyErrors) {
      notify(next.data.msg);
    }
  }

  async function fetchAndRender() {
    const next = await api.refreshData();
    applyDataState(next, { notifyErrors: true });
  }

  onMount(() => {
    const unsubs = [
      api.onSettingsChanged(() => {
        void loadSettings();
      }),
      api.onDataState((next) => applyDataState(next))
    ];

    void (async () => {
      await loadSettings();
      applyDataState(await api.getDataState());
    })();

    onCleanup(() => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      window.clearTimeout(toastTimer);
    });
  });

  return {
    settings,
    data,
    info,
    today,
    week,
    worstRisk,
    statusTone,
    healthLabel,
    subtitle,
    freshness,
    loading,
    alert,
    toast,
    notify,
    loadSettings,
    fetchAndRender
  };
}
