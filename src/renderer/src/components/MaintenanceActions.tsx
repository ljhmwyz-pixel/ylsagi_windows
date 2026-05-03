import { Icon } from './Icon';

export function MaintenanceActions(props: {
  onCopyDiagnostics: () => void | Promise<void>;
}) {
  return (
    <div class="maintenance-actions">
      <button class="secondary-button" type="button" onClick={() => window.floatingApi.resetPlacement()}>
        <Icon name="reset" />
        重置位置
      </button>
      <button class="secondary-button" type="button" onClick={() => window.floatingApi.openLogs()}>
        <Icon name="fileText" />
        打开日志
      </button>
      <button class="secondary-button" type="button" onClick={() => window.floatingApi.openSettingsDir()}>
        <Icon name="folder" />
        配置目录
      </button>
      <button class="secondary-button" type="button" onClick={props.onCopyDiagnostics}>
        <Icon name="copy" />
        复制诊断
      </button>
    </div>
  );
}
