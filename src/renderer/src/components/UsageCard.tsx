import { formatCompactNumber, formatNumber, usageSummary } from '../utils';

export function UsageCard(props: { title: string; usage: ReturnType<typeof usageSummary>; primary?: boolean }) {
  const value = () => props.usage.usage;

  return (
    <article class={`usage-card risk-${props.usage.risk} ${props.primary ? 'primary' : ''}`}>
      <div class="card-head">
        <span>{props.title}</span>
        <strong>{props.usage.percentLabel}</strong>
      </div>
      <div class="quota-focus">
        <strong>{formatNumber(value().remaining_quota)}</strong>
        <span>
          已用 <b>{formatNumber(value().total_cost)}</b>
        </span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style={{ width: `${props.usage.percent}%` }} />
      </div>
      <div class="meta-row">
        <span>{formatNumber(value().request_count)} 次请求</span>
        <span>{formatCompactNumber(value().total_tokens)} tokens</span>
      </div>
    </article>
  );
}
