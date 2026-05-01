import { createMemo, For, Show } from 'solid-js';
import type { PackageElement } from '../types';
import { formatDate, formatNumber, packageTitle } from '../utils';

export function PackageList(props: { packages: PackageElement[] }) {
  const packages = createMemo(() =>
    [...(props.packages || [])]
      .sort((a, b) => new Date(b.expires_at || 0).getTime() - new Date(a.expires_at || 0).getTime())
      .slice(0, 3)
  );

  return (
    <div class="package-list">
      <Show
        when={packages().length > 0}
        fallback={
          <div class="package-item">
            <span class="package-main">暂无订阅包</span>
            <span class="package-meta">-</span>
          </div>
        }
      >
        <For each={packages()}>
          {(item) => (
            <div class="package-item" title={`${packageTitle(item)} / ${item.package_status || '-'}`}>
              <span class="package-main">
                {packageTitle(item)} · {item.package_status || '-'} · {formatNumber(item.package_quota ?? item.amount ?? 0)}
              </span>
              <span class="package-meta">{formatDate(item.expires_at)}</span>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
