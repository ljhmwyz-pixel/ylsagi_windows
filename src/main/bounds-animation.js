const activeAnimations = new WeakMap();

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function stopBoundsAnimation(win) {
  const animation = activeAnimations.get(win);
  if (animation) {
    clearInterval(animation.timer);
    activeAnimations.delete(win);
  }
}

function animateBounds(win, targetBounds, options = {}) {
  if (!win || win.isDestroyed()) return;
  const duration = Number(options.duration) || 180;
  const from = win.getBounds();
  const to = {
    x: Math.round(targetBounds.x),
    y: Math.round(targetBounds.y),
    width: Math.round(targetBounds.width || from.width),
    height: Math.round(targetBounds.height || from.height)
  };

  stopBoundsAnimation(win);

  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (!win || win.isDestroyed()) {
      clearInterval(timer);
      return;
    }

    const elapsed = Date.now() - startedAt;
    const progress = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(progress);
    const next = {
      x: Math.round(from.x + (to.x - from.x) * eased),
      y: Math.round(from.y + (to.y - from.y) * eased),
      width: Math.round(from.width + (to.width - from.width) * eased),
      height: Math.round(from.height + (to.height - from.height) * eased)
    };

    win.setBounds(next, false);
    if (progress >= 1) {
      clearInterval(timer);
      activeAnimations.delete(win);
      win.setBounds(to, false);
      if (typeof options.onDone === 'function') {
        options.onDone();
      }
    }
  }, 1000 / 60);

  activeAnimations.set(win, { timer });
}

module.exports = {
  animateBounds,
  stopBoundsAnimation
};
