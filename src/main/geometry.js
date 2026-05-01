const { screen } = require('electron');
const {
  BUBBLE_DOCK_THRESHOLD,
  BUBBLE_SIZE,
  BUBBLE_VISIBLE_RATIO,
  EDGE_GAP,
  PANEL_GAP,
  PANEL_MARGIN,
  PANEL_MAX_HEIGHT,
  PANEL_MIN_HEIGHT,
  PANEL_SIZE
} = require('./constants');

function clampBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const width = Math.min(Math.max(Math.round(bounds.width), 1), area.width);
  const height = Math.min(Math.max(Math.round(bounds.height), 1), area.height);
  const x = Math.min(Math.max(Math.round(bounds.x), area.x), area.x + area.width - width);
  const y = Math.min(Math.max(Math.round(bounds.y), area.y), area.y + area.height - height);

  return { x, y, width, height };
}

function validPoint(bounds) {
  return bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y);
}

function clampBubbleBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const width = BUBBLE_SIZE.width;
  const height = BUBBLE_SIZE.height;
  const x = Math.min(Math.max(Math.round(bounds.x), area.x), area.x + area.width - width);
  const y = Math.min(Math.max(Math.round(bounds.y), area.y), area.y + area.height - height);

  return { x, y, width, height };
}

function screenAreaForBounds(bounds) {
  return screen.getDisplayMatching({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(1, Math.round(bounds.width || BUBBLE_SIZE.width)),
    height: Math.max(1, Math.round(bounds.height || BUBBLE_SIZE.height))
  }).workArea;
}

function clampDockedBubbleBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const width = BUBBLE_SIZE.width;
  const height = BUBBLE_SIZE.height;
  const visibleWidth = Math.round(width * BUBBLE_VISIBLE_RATIO);
  const visibleHeight = Math.round(height * BUBBLE_VISIBLE_RATIO);
  const minX = area.x - (width - visibleWidth);
  const maxX = area.x + area.width - visibleWidth;
  const minY = area.y - (height - visibleHeight);
  const maxY = area.y + area.height - visibleHeight;
  const x = Math.min(Math.max(Math.round(bounds.x), minX), maxX);
  const y = Math.min(Math.max(Math.round(bounds.y), minY), maxY);

  return { x, y, width, height };
}

function defaultBubbleBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - BUBBLE_SIZE.width - EDGE_GAP,
    y: area.y + Math.round(area.height * 0.28),
    ...BUBBLE_SIZE
  };
}

function initialBubbleBounds(settings) {
  const saved = validPoint(settings.bubbleBounds) ? settings.bubbleBounds : defaultBubbleBounds();
  return clampBubbleBounds({
    x: saved.x,
    y: saved.y,
    ...BUBBLE_SIZE
  });
}

function dockBoundsForEdge(bounds, edge) {
  const area = screenAreaForBounds(bounds);
  const visibleWidth = Math.round(BUBBLE_SIZE.width * BUBBLE_VISIBLE_RATIO);
  const visibleHeight = Math.round(BUBBLE_SIZE.height * BUBBLE_VISIBLE_RATIO);
  const hiddenWidth = BUBBLE_SIZE.width - visibleWidth;
  const hiddenHeight = BUBBLE_SIZE.height - visibleHeight;
  const centeredX = Math.min(
    Math.max(bounds.x, area.x),
    area.x + area.width - BUBBLE_SIZE.width
  );
  const centeredY = Math.min(
    Math.max(bounds.y, area.y),
    area.y + area.height - BUBBLE_SIZE.height
  );

  switch (edge) {
    case 'left':
      return clampDockedBubbleBounds({
        x: area.x - hiddenWidth,
        y: centeredY,
        ...BUBBLE_SIZE
      });
    case 'right':
      return clampDockedBubbleBounds({
        x: area.x + area.width - visibleWidth,
        y: centeredY,
        ...BUBBLE_SIZE
      });
    case 'top':
      return clampDockedBubbleBounds({
        x: centeredX,
        y: area.y - hiddenHeight,
        ...BUBBLE_SIZE
      });
    case 'bottom':
      return clampDockedBubbleBounds({
        x: centeredX,
        y: area.y + area.height - visibleHeight,
        ...BUBBLE_SIZE
      });
    default:
      return clampBubbleBounds(bounds);
  }
}

function undockedBoundsFromDock(bounds, edge) {
  const area = screenAreaForBounds(bounds);
  const centeredX = Math.min(Math.max(bounds.x, area.x), area.x + area.width - BUBBLE_SIZE.width);
  const centeredY = Math.min(Math.max(bounds.y, area.y), area.y + area.height - BUBBLE_SIZE.height);

  switch (edge) {
    case 'left':
      return clampBubbleBounds({ x: area.x + EDGE_GAP, y: centeredY, ...BUBBLE_SIZE });
    case 'right':
      return clampBubbleBounds({ x: area.x + area.width - BUBBLE_SIZE.width - EDGE_GAP, y: centeredY, ...BUBBLE_SIZE });
    case 'top':
      return clampBubbleBounds({ x: centeredX, y: area.y + EDGE_GAP, ...BUBBLE_SIZE });
    case 'bottom':
      return clampBubbleBounds({ x: centeredX, y: area.y + area.height - BUBBLE_SIZE.height - EDGE_GAP, ...BUBBLE_SIZE });
    default:
      return clampBubbleBounds(bounds);
  }
}

function visibleAnchorFromDock(bounds, edge) {
  const area = screenAreaForBounds(bounds);
  const centeredX = Math.min(
    Math.max(bounds.x, area.x),
    area.x + area.width - BUBBLE_SIZE.width
  );
  const centeredY = Math.min(
    Math.max(bounds.y, area.y),
    area.y + area.height - BUBBLE_SIZE.height
  );

  switch (edge) {
    case 'left':
      return clampBubbleBounds({ x: area.x, y: centeredY, ...BUBBLE_SIZE });
    case 'right':
      return clampBubbleBounds({ x: area.x + area.width - BUBBLE_SIZE.width, y: centeredY, ...BUBBLE_SIZE });
    case 'top':
      return clampBubbleBounds({ x: centeredX, y: area.y, ...BUBBLE_SIZE });
    case 'bottom':
      return clampBubbleBounds({ x: centeredX, y: area.y + area.height - BUBBLE_SIZE.height, ...BUBBLE_SIZE });
    default:
      return clampBubbleBounds(bounds);
  }
}

function dockPreviewForBubble(bounds) {
  const area = screenAreaForBounds(bounds);
  const fixed = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: BUBBLE_SIZE.width,
    height: BUBBLE_SIZE.height
  };
  const distances = [
    { edge: 'left', value: Math.abs(fixed.x - area.x) },
    { edge: 'right', value: Math.abs(area.x + area.width - (fixed.x + fixed.width)) },
    { edge: 'top', value: Math.abs(fixed.y - area.y) },
    { edge: 'bottom', value: Math.abs(area.y + area.height - (fixed.y + fixed.height)) }
  ];
  const nearest = distances.reduce((best, item) => (item.value < best.value ? item : best), distances[0]);

  return {
    active: nearest.value <= BUBBLE_DOCK_THRESHOLD,
    edge: nearest.value <= BUBBLE_DOCK_THRESHOLD ? nearest.edge : null,
    distance: Math.max(0, nearest.value),
    threshold: BUBBLE_DOCK_THRESHOLD
  };
}

function panelHeightForArea(area, requestedHeight) {
  const screenMax = Math.max(PANEL_MIN_HEIGHT, area.height - PANEL_MARGIN * 2);
  return Math.min(
    Math.max(Math.round(requestedHeight || PANEL_SIZE.height), PANEL_MIN_HEIGHT),
    Math.min(PANEL_MAX_HEIGHT, screenMax)
  );
}

function panelBoundsForBubble(bubbleBounds, requestedHeight = PANEL_SIZE.height) {
  const area = screenAreaForBounds(bubbleBounds);
  const panelHeight = panelHeightForArea(area, requestedHeight);
  const bubbleCenterX = bubbleBounds.x + bubbleBounds.width / 2;
  const bubbleCenterY = bubbleBounds.y + bubbleBounds.height / 2;
  const spaceLeft = bubbleBounds.x - area.x - PANEL_GAP;
  const spaceRight = area.x + area.width - (bubbleBounds.x + bubbleBounds.width) - PANEL_GAP;
  const preferLeft = spaceLeft >= PANEL_SIZE.width || (spaceLeft > spaceRight && spaceRight < PANEL_SIZE.width);
  const side = preferLeft ? 'right' : 'left';
  const rawX = preferLeft
    ? bubbleBounds.x - PANEL_SIZE.width - PANEL_GAP
    : bubbleBounds.x + bubbleBounds.width + PANEL_GAP;
  const rawY = bubbleCenterY - panelHeight / 2;
  const x = Math.min(
    Math.max(Math.round(rawX), area.x + PANEL_MARGIN),
    area.x + area.width - PANEL_SIZE.width - PANEL_MARGIN
  );
  const y = Math.min(
    Math.max(Math.round(rawY), area.y + PANEL_MARGIN),
    area.y + area.height - panelHeight - PANEL_MARGIN
  );
  const arrowY = Math.min(
    Math.max(Math.round(bubbleCenterY - y), 28),
    panelHeight - 28
  );

  return {
    bounds: { x, y, width: PANEL_SIZE.width, height: panelHeight },
    layout: {
      side,
      arrowY
    }
  };
}

function resolveBubbleRelease(bounds) {
  const fixed = clampBubbleBounds(bounds);
  const nearest = dockPreviewForBubble(fixed);

  if (!nearest.active) {
    return {
      docked: false,
      edge: null,
      bounds: fixed
    };
  }

  return {
    docked: true,
    edge: nearest.edge,
    bounds: dockBoundsForEdge(fixed, nearest.edge)
  };
}

function isNearAnyEdge(bounds) {
  return dockPreviewForBubble(bounds).active;
}

module.exports = {
  clampBounds,
  clampBubbleBounds,
  clampDockedBubbleBounds,
  defaultBubbleBounds,
  initialBubbleBounds,
  dockBoundsForEdge,
  undockedBoundsFromDock,
  visibleAnchorFromDock,
  panelBoundsForBubble,
  panelHeightForArea,
  dockPreviewForBubble,
  isNearAnyEdge,
  resolveBubbleRelease
};
