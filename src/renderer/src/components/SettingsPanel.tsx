import { createEffect } from 'solid-js';
import type { Settings } from '../types';
import { Icon } from './Icon';

export function SettingsPanel(props: {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (
    token: string,
    refreshSeconds: number,
    alwaysOnTop: boolean,
    panelLightDismiss: boolean,
    launchAtLogin: boolean
  ) => void;
  onClearToken: () => void;
  onCopyDiagnostics: () => void;
}) {
  let tokenInput!: HTMLInputElement;
  let secondsInput!: HTMLInputElement;
  let topInput!: HTMLInputElement;
  let lightDismissInput!: HTMLInputElement;
  let launchInput!: HTMLInputElement;

  createEffect(() => {
    if (props.open) {
      requestAnimationFrame(() => tokenInput?.focus());
    }
  });

  return (
    <section class={`settings-panel ${props.open ? 'open' : ''}`} aria-hidden={!props.open}>
      <div class="panel-head">
        <strong>接口设置</strong>
        <button class="icon-button" title="关闭设置" aria-label="关闭设置" onClick={props.onClose}>
          <Icon name="close" />
        </button>
      </div>
      <label class="field">
        <span>Bearer Token</span>
        <input ref={tokenInput} type="password" placeholder="粘贴 token，支持带或不带 Bearer" />
      </label>
      <label class="field compact-field">
        <span>刷新间隔</span>
        <input ref={secondsInput} type="number" min="15" max="3600" step="15" value={props.settings.refreshSeconds} />
        <span>秒</span>
      </label>
      <label class="toggle-field">
        <span>窗口置顶</span>
        <input ref={topInput} type="checkbox" checked={props.settings.alwaysOnTop} />
      </label>
      <label class="toggle-field">
        <span>点击外部关闭面板</span>
        <input ref={lightDismissInput} type="checkbox" checked={props.settings.panelLightDismiss} />
      </label>
      <label class="toggle-field">
        <span>开机自动启动</span>
        <input ref={launchInput} type="checkbox" checked={props.settings.launchAtLogin} />
      </label>
      <div class="setting-status">
        {props.settings.tokenSource === 'env'
          ? 'Token 来自环境变量'
          : props.settings.tokenSource === 'saved'
            ? props.settings.tokenStorage === 'safeStorage'
              ? 'Token 已加密保存在本机'
              : 'Token 已保存（当前系统未启用加密）'
            : 'Token 未配置'}
      </div>
      <div class="maintenance-actions">
        <button class="secondary-button" onClick={() => window.floatingApi.resetPlacement()}>
          重置位置
        </button>
        <button class="secondary-button" onClick={() => window.floatingApi.openLogs()}>
          打开日志
        </button>
        <button class="secondary-button" onClick={() => window.floatingApi.openSettingsDir()}>
          配置目录
        </button>
        <button class="secondary-button" onClick={props.onCopyDiagnostics}>
          复制诊断
        </button>
      </div>
      <div class="panel-actions">
        <button class="secondary-button" onClick={props.onClearToken}>
          清除 Token
        </button>
        <button
          class="primary-button"
          onClick={() =>
            props.onSave(
              tokenInput.value,
              Number(secondsInput.value),
              topInput.checked,
              lightDismissInput.checked,
              launchInput.checked
            )
          }
        >
          保存并刷新
        </button>
      </div>
    </section>
  );
}
