import { render } from 'solid-js/web';
import { BubbleApp } from './apps/BubbleApp';
import { PanelApp } from './apps/PanelApp';
import './styles.css';

const mode = new URLSearchParams(window.location.search).get('mode') === 'panel' ? 'panel' : 'bubble';

render(() => (mode === 'bubble' ? <BubbleApp /> : <PanelApp />), document.getElementById('root')!);
