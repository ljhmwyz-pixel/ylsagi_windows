const API_URL = 'https://code.ylsagi.com/codex/info';
const TOKEN_ENV_NAMES = ['YLS_Codex_TOKEN', 'YLS_CODEX_TOKEN', 'CODEX_INFO_TOKEN'];
const BUBBLE_SIZE = { width: 88, height: 88 };
const PANEL_SIZE = { width: 404, height: 560 };
const PANEL_MIN_HEIGHT = 420;
const PANEL_MAX_HEIGHT = 680;
const EDGE_GAP = 14;
const PANEL_GAP = 12;
const PANEL_MARGIN = 10;
const BUBBLE_DOCK_THRESHOLD = 34;
const BUBBLE_VISIBLE_RATIO = 0.5;

module.exports = {
  API_URL,
  TOKEN_ENV_NAMES,
  BUBBLE_SIZE,
  PANEL_SIZE,
  PANEL_MIN_HEIGHT,
  PANEL_MAX_HEIGHT,
  EDGE_GAP,
  PANEL_GAP,
  PANEL_MARGIN,
  BUBBLE_DOCK_THRESHOLD,
  BUBBLE_VISIBLE_RATIO
};
