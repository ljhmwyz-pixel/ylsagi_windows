import type { PackageElement, UserPackgeUsage } from './types';

export type RiskLevel = 'ok' | 'warn' | 'danger';

export function formatNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: number >= 100 ? 0 : 2
  }).format(number);
}

export function formatTime(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function clampPercent(value: unknown) {
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace('%', ''));
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
}

export function riskLevel(percent: number): RiskLevel {
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warn';
  return 'ok';
}

export function usageDefaults(usage?: Partial<UserPackgeUsage>): UserPackgeUsage {
  return {
    cache_read_cost: 0,
    input_cost: 0,
    input_tokens: 0,
    input_tokens_cached: 0,
    output_cost: 0,
    output_tokens: 0,
    output_tokens_reasoning: 0,
    remaining_quota: 0,
    request_count: 0,
    total_cost: 0,
    total_quota: 0,
    total_tokens: 0,
    used_percentage: '0%',
    ...usage
  };
}

export function usageSummary(usage?: Partial<UserPackgeUsage>) {
  const normalized = usageDefaults(usage);
  const percent = clampPercent(normalized.used_percentage);
  return {
    usage: normalized,
    percent,
    risk: riskLevel(percent),
    percentLabel: `${formatNumber(percent)}%`
  };
}

export function packageLabel(level?: number) {
  const number = Number(level);
  if (!Number.isFinite(number)) return '套餐 -';
  return `套餐 L${number}`;
}

export function packageTitle(item: Partial<PackageElement>) {
  return item.package_type || item.sub_type || 'package';
}
