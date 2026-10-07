// Logical low-resolution screen used by menus and older scenes; they are drawn scaled up by RESOLUTION_SCALE.
export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 256;
// The canvas itself; high-resolution scenes (scene.highResolution = true) draw in these pixels directly.
export const RESOLUTION_SCALE = 2;
export const CANVAS_WIDTH = SCREEN_WIDTH * RESOLUTION_SCALE;
export const CANVAS_HEIGHT = SCREEN_HEIGHT * RESOLUTION_SCALE;
export const FIXED_STEP = 1 / 60;
