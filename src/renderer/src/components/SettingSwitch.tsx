import * as Switch from '@kobalte/core/switch';

export function SettingSwitch(props: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Switch.Root class="toggle-field" checked={props.checked} onChange={props.onChange}>
      <div class="toggle-copy">
        <Switch.Label>{props.label}</Switch.Label>
        <Switch.Description>{props.description}</Switch.Description>
      </div>
      <Switch.Input />
      <Switch.Control class="switch-control">
        <Switch.Thumb class="switch-thumb" />
      </Switch.Control>
    </Switch.Root>
  );
}
