// input.js — keyboard and mouse state for Ember Thief.
//
// The game reads movement from here every frame; the canvas click
// (throwing a pebble) is delivered as a one-shot event the game loop
// consumes, so a click is never thrown twice.

/** Keys the game treats as movement. */
const MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

/** Build an input tracker bound to the page and the canvas element. */
export function createInput(canvas) {
  const keysDown = new Set();
  const pressed = new Set();
  let click = null;

  function onKeyDown(event) {
    // Keep the page from scrolling on arrows / space while playing.
    if (event.code in MOVE_KEYS || event.code === 'Space') event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    keysDown.add(event.code);
  }

  function onKeyUp(event) {
    keysDown.delete(event.code);
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    click = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function onBlur() {
    keysDown.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Normalised movement direction from the keys held down. */
    moveDirection() {
      let x = 0;
      let y = 0;
      for (const code of keysDown) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },

    /** Whether Shift (sneak) is held. */
    isSneaking() {
      return keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');
    },

    /** Whether a key was pressed since the last frame (one-shot). */
    wasPressed(code) {
      return pressed.has(code);
    },

    /** The canvas click since the last frame, or null (one-shot). */
    takeClick() {
      const at = click;
      click = null;
      return at;
    },

    /** Clear one-shot state; call once per frame after the game reads it. */
    endFrame() {
      pressed.clear();
    },

    /** Stop listening (used when the game is torn down). */
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousedown', onMouseDown);
    },
  };
}
