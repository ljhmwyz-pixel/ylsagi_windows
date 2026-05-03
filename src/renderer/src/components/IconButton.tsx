import { Icon, type IconName } from './Icon';

export function IconButton(props: {
  label: string;
  icon: IconName;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  class?: string;
}) {
  return (
    <button
      type={props.type || 'button'}
      class={`icon-button ${props.class || ''}`.trim()}
      aria-label={props.label}
      data-tooltip={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
    </button>
  );
}
