import { formatDistance } from '../../core/format.js';
import { CANVAS_HEIGHT as SCREEN_HEIGHT, CANVAS_WIDTH as SCREEN_WIDTH } from '../../engine/constants.js';
import { drawBlinking } from '../../engine/draw.js';
import { drawText } from '../../engine/font.js';
import { PALETTE } from '../../engine/palette.js';
import {
  drawForestLayer, drawMistySky, drawSnowfall, FAR_FOREST, NEAR_FOREST,
} from '../../engine/scenery.js';
import { hillHeightAt, inrunHeightAt, inrunPointAt } from './hill.js';
import { JUMP_CONFIG, predictTouchdown } from './skiJumpSim.js';
import { drawSkier as drawJumper, SKIER_STYLES, skierSilhouette } from './skier.js';

// This scene draws at the full 640×512 canvas resolution (see SkiJumpScene.highResolution).
export const PX_PER_M = 16;
export const KMH_PER_MS = 3.6;

const HUD_HEIGHT = 44;
const TEXT_SCALE = 2;
const DEG = Math.PI / 180;

// Where the skier sits on screen: centred on the inrun, upper left in flight so the slope ahead is visible.
const ANCHOR_INRUN = { x: 300, y: 240 };
const ANCHOR_FLIGHT = { x: 210, y: 180 };
const ANCHOR_BLEND_SECONDS = 1.2;

// Inrun slab cross-section in screen pixels, relative to the track line (the path the skier rides).
const FAR_RAIL_TOP = -14;
const TRACK_TOP = -8;
const NEAR_EDGE_TOP = 2;
const SIDE_TOP = 6;
const SIDE_BANDS = [PALETTE.wood1, PALETTE.wood2, PALETTE.wood3, PALETTE.wood4, PALETTE.wood5, PALETTE.wood6, PALETTE.wood7, PALETTE.wood8];
const SIDE_BAND_PX = 10;
const SLAB_BOTTOM = SIDE_TOP + SIDE_BANDS.length * SIDE_BAND_PX;
const PLATFORM_PX = 140;

const PILLAR_SPACING_M = 10;
const PILLAR_WIDTH_PX = 56;
const CONCRETE = [PALETTE.concrete0, PALETTE.concrete1, PALETTE.concrete2, PALETTE.concrete3];
const TABLE_WALL_FROM_M = -14;
const GUIDE_OFFSET_M = 1.2;
const VALLEY_Y = -40; // snow ground under the start of the inrun, in metres
const LIP_GROUND_Y = -4; // snow ground just below the lip, in metres
const SPECTATOR_COLORS = [PALETTE.suitPink, PALETTE.guide, PALETTE.wood2, PALETTE.pineLight, PALETTE.concrete1];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function anchorFor(state) {
  if (state.lipTime === null) return ANCHOR_INRUN;
  const t = Math.min(1, (state.time - state.lipTime) / ANCHOR_BLEND_SECONDS);
  return { x: lerp(ANCHOR_INRUN.x, ANCHOR_FLIGHT.x, t), y: lerp(ANCHOR_INRUN.y, ANCHOR_FLIGHT.y, t) };
}

// The camera follows the skier both ways; x is clamped at the end of the outrun.
export function cameraFor(state) {
  const anchor = anchorFor(state);
  const maxX = state.hill.outrunEnd * PX_PER_M - SCREEN_WIDTH;
  return {
    x: Math.min(maxX, state.x * PX_PER_M - anchor.x),
    y: state.y * PX_PER_M + anchor.y,
  };
}

export function toScreen(camera, x, y) {
  return { sx: Math.round(x * PX_PER_M - camera.x), sy: Math.round(camera.y - y * PX_PER_M) };
}

// 0 = flag hangs down (calm), 1 = flag horizontal (strongest wind).
export function windFlagLift(wind) {
  return Math.min(1, Math.max(0, wind / JUMP_CONFIG.maxWind));
}

export function formatWind(wind) {
  return `${wind.toFixed(1).replace('.', ',')} M/S`;
}

export function skierPose(state) {
  if (state.phase === 'fallen') return 'fallen';
  if (state.phase === 'landed') return 'telemark';
  if (state.phase === 'flight') return 'flight';
  return 'crouch';
}

function groundHeightAt(hill, x) {
  if (x >= 0) return hillHeightAt(hill, x);
  const t = Math.min(1, Math.max(0, x / hill.inrunStart.x));
  return LIP_GROUND_Y + (VALLEY_Y - LIP_GROUND_Y) * t;
}

// ---- ground, structures and markings ----------------------------------------------------------

function drawGround(ctx, state, camera) {
  for (let sx = 0; sx < SCREEN_WIDTH; sx++) {
    const x = (sx + camera.x) / PX_PER_M;
    const { sy } = toScreen(camera, x, groundHeightAt(state.hill, x));
    if (sy >= SCREEN_HEIGHT) continue;
    const top = Math.max(sy, 0);
    ctx.fillStyle = PALETTE.snowLight;
    ctx.fillRect(sx, top, 1, SCREEN_HEIGHT - top);
    ctx.fillStyle = PALETTE.snowMid;
    ctx.fillRect(sx, top + 20, 1, Math.max(0, SCREEN_HEIGHT - top - 20));
    if (sy >= 0) {
      ctx.fillStyle = PALETTE.snowDark;
      ctx.fillRect(sx, sy, 1, 2);
    }
  }
}

// A vertical concrete block between screen columns [left, right) from y0 down to the ground,
// shaded from lit (left) to dark (right) in four vertical bands.
function drawConcreteBlock(ctx, camera, hill, left, right, y0) {
  const width = right - left;
  for (let sx = Math.max(0, left); sx < Math.min(SCREEN_WIDTH, right); sx++) {
    const x = (sx + camera.x) / PX_PER_M;
    const bottom = Math.min(SCREEN_HEIGHT, toScreen(camera, x, groundHeightAt(hill, x)).sy);
    if (bottom <= y0) continue;
    const band = Math.min(CONCRETE.length - 1, Math.floor(((sx - left) / width) * CONCRETE.length));
    ctx.fillStyle = CONCRETE[band];
    ctx.fillRect(sx, y0, 1, bottom - y0);
  }
}

function drawPillars(ctx, state, camera) {
  const { hill } = state;
  for (let x = hill.inrunStart.x + 5; x < TABLE_WALL_FROM_M - 3; x += PILLAR_SPACING_M) {
    const { sx, sy } = toScreen(camera, x, inrunHeightAt(hill, x));
    const left = sx - PILLAR_WIDTH_PX / 2;
    if (left > SCREEN_WIDTH || left + PILLAR_WIDTH_PX < 0) continue;
    drawConcreteBlock(ctx, camera, hill, left, left + PILLAR_WIDTH_PX, sy + SLAB_BOTTOM - 8);
  }
}

// The wide concrete wall under the takeoff table and its shadow on the snow in front of it.
function drawTableWall(ctx, state, camera) {
  const { hill } = state;
  const left = toScreen(camera, TABLE_WALL_FROM_M, 0).sx;
  const right = toScreen(camera, -1, 0).sx;
  for (let sx = Math.max(0, right); sx < Math.min(SCREEN_WIDTH, right + 140); sx++) {
    const x = (sx + camera.x) / PX_PER_M;
    const { sy } = toScreen(camera, x, groundHeightAt(hill, x));
    const depth = Math.max(0, 14 - Math.floor((sx - right) / 10));
    if (depth === 0) continue;
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(sx, sy, 1, depth);
  }
  for (let sx = Math.max(0, left); sx < Math.min(SCREEN_WIDTH, right); sx++) {
    const x = (sx + camera.x) / PX_PER_M;
    const y0 = toScreen(camera, x, inrunHeightAt(hill, x)).sy + SLAB_BOTTOM - 4;
    const bottom = Math.min(SCREEN_HEIGHT, toScreen(camera, x, groundHeightAt(hill, x)).sy);
    if (bottom <= y0) continue;
    const band = Math.min(CONCRETE.length - 1, Math.floor(((sx - left) / (right - left)) * CONCRETE.length));
    ctx.fillStyle = CONCRETE[band];
    ctx.fillRect(sx, y0, 1, bottom - y0);
  }
}

// One screen column of the inrun slab: far rail, icy track with a groove, lit near edge, then a
// tall wooden side face in eight shades with stair-stepped (dithered) band edges.
function drawSlabColumn(ctx, sx, trackY) {
  ctx.fillStyle = PALETTE.wood5;
  ctx.fillRect(sx, trackY + FAR_RAIL_TOP, 1, 2);
  ctx.fillStyle = PALETTE.wood7;
  ctx.fillRect(sx, trackY + FAR_RAIL_TOP + 2, 1, TRACK_TOP - FAR_RAIL_TOP - 2);
  ctx.fillStyle = PALETTE.trackIce;
  ctx.fillRect(sx, trackY + TRACK_TOP, 1, NEAR_EDGE_TOP - TRACK_TOP);
  ctx.fillStyle = PALETTE.trackGroove;
  ctx.fillRect(sx, trackY - 5, 1, 1);
  ctx.fillRect(sx, trackY - 2, 1, 1);
  ctx.fillStyle = PALETTE.wood0;
  ctx.fillRect(sx, trackY + NEAR_EDGE_TOP, 1, SIDE_TOP - NEAR_EDGE_TOP);
  SIDE_BANDS.forEach((color, index) => {
    const top = trackY + SIDE_TOP + index * SIDE_BAND_PX;
    ctx.fillStyle = color;
    ctx.fillRect(sx, top, 1, SIDE_BAND_PX);
    if (index > 0 && sx % 2 === 0) {
      ctx.fillStyle = SIDE_BANDS[index - 1];
      ctx.fillRect(sx, top, 1, 1);
    }
  });
  ctx.fillStyle = PALETTE.wood8;
  ctx.fillRect(sx, trackY + SLAB_BOTTOM, 1, 2);
}

function drawInrun(ctx, state, camera) {
  const { hill } = state;
  const start = toScreen(camera, hill.inrunStart.x, hill.inrunStart.y);
  const lip = toScreen(camera, 0, 0);
  for (let sx = Math.max(0, start.sx - PLATFORM_PX); sx < Math.min(SCREEN_WIDTH, start.sx); sx++) {
    drawSlabColumn(ctx, sx, start.sy);
  }
  for (let sx = Math.max(0, start.sx); sx <= Math.min(SCREEN_WIDTH - 1, lip.sx); sx++) {
    const x = (sx + camera.x) / PX_PER_M;
    drawSlabColumn(ctx, sx, toScreen(camera, x, inrunHeightAt(hill, x)).sy);
  }
  if (lip.sx >= -8 && lip.sx < SCREEN_WIDTH) {
    // End faces of the takeoff table: the near wood face and the far rail end.
    ctx.fillStyle = PALETTE.wood8;
    ctx.fillRect(lip.sx + 1, lip.sy + NEAR_EDGE_TOP, 6, SLAB_BOTTOM - NEAR_EDGE_TOP + 2);
    ctx.fillStyle = PALETTE.wood7;
    ctx.fillRect(lip.sx + 1, lip.sy + FAR_RAIL_TOP, 6, NEAR_EDGE_TOP - FAR_RAIL_TOP);
    ctx.fillStyle = PALETTE.trackIce;
    ctx.fillRect(lip.sx + 1, lip.sy + TRACK_TOP, 8, NEAR_EDGE_TOP - TRACK_TOP);
  }
}

function drawGuideLine(ctx, state, camera) {
  const { hill } = state;
  for (let sx = 0; sx < SCREEN_WIDTH; sx++) {
    const x = (sx + camera.x) / PX_PER_M;
    if (x < 8 || x > hill.hillSize + 15) continue;
    const { sy } = toScreen(camera, x, hillHeightAt(hill, x) + GUIDE_OFFSET_M);
    const joint = Math.floor(x) % 10 === 0;
    ctx.fillStyle = joint ? PALETTE.guideJoint : PALETTE.guide;
    ctx.fillRect(sx, sy, 1, 6);
  }
  for (let metres = 100; metres <= hill.hillSize; metres += 50) {
    const { sx, sy } = toScreen(camera, metres, hillHeightAt(hill, metres) + GUIDE_OFFSET_M);
    drawText(ctx, String(metres), sx, sy - 20, { align: 'center', scale: TEXT_SCALE, color: PALETTE.guideJoint });
  }
  for (const [metres, color] of [[hill.kPoint, PALETTE.green], [hill.hillSize, PALETTE.red]]) {
    const { sx, sy } = toScreen(camera, metres, hillHeightAt(hill, metres));
    ctx.fillStyle = color;
    ctx.fillRect(sx - 2, sy - 28, 4, 28);
  }
}

function drawSpectators(ctx, state, camera) {
  const { hill } = state;
  for (let metres = 150; metres <= hill.outrunEnd - 10; metres += 1.5) {
    const { sx, sy } = toScreen(camera, metres, hillHeightAt(hill, metres) - 7);
    if (sx < 0 || sx >= SCREEN_WIDTH - 8 || sy > SCREEN_HEIGHT) continue;
    const index = Math.round(metres * 2);
    ctx.fillStyle = PALETTE.helmet;
    ctx.fillRect(sx + 2, sy, 4, 4);
    ctx.fillStyle = SPECTATOR_COLORS[index % SPECTATOR_COLORS.length];
    ctx.fillRect(sx, sy + 4, 8, 10);
  }
}

// ---- skier ------------------------------------------------------------------------------------

const SHADOW_FULL_HEIGHT_M = 4; // at or below this height the shadow is solid and dark
const SHADOW_FADE_HEIGHT_M = 25; // above this height the shadow is at its faintest

// Projects a screen point straight down onto the landing hill surface.
function projectToHill(state, camera, [px]) {
  const x = (px + camera.x) / PX_PER_M;
  return [px, toScreen(camera, x, hillHeightAt(state.hill, x)).sy];
}

// Fills a thin band along the hill between two projected points; `density` 0..1 thins it out
// with an ordered dither, so a high skier casts a faint, sparse shadow.
function fillShadowBand(ctx, a, b, halfWidth, density, color) {
  const left = Math.round(Math.min(a[0], b[0]));
  const right = Math.round(Math.max(a[0], b[0]));
  const span = Math.max(1, right - left);
  ctx.fillStyle = color;
  for (let sx = left; sx <= right; sx++) {
    const t = (sx - left) / span;
    const ySurface = Math.round(a[1] + (b[1] - a[1]) * (a[0] <= b[0] ? t : 1 - t));
    for (let dy = -halfWidth; dy <= halfWidth; dy++) {
      const threshold = ((sx & 1) * 2 + ((ySurface + dy) & 1)) / 4 + 0.125; // 2×2 Bayer matrix
      if (density < threshold) continue;
      ctx.fillRect(sx, ySurface + dy, 1, 1);
    }
  }
}

function drawShadow(ctx, state, camera) {
  if (state.phase !== 'flight') return;
  const height = state.y - hillHeightAt(state.hill, state.x);
  const fade = Math.min(1, Math.max(0, (height - SHADOW_FULL_HEIGHT_M) / (SHADOW_FADE_HEIGHT_M - SHADOW_FULL_HEIGHT_M)));
  const density = 1 - fade * 0.5;
  const color = fade < 0.35 ? PALETTE.concrete1 : fade < 0.7 ? PALETTE.concrete0 : PALETTE.shadow;
  const { sx, sy } = toScreen(camera, state.x, state.y);
  const silhouette = skierSilhouette('flight', sx, sy, state.angle);
  for (const [tail, tip] of silhouette.skis) {
    fillShadowBand(ctx, projectToHill(state, camera, tail), projectToHill(state, camera, tip), 2, density, color);
  }
  const [boots, head] = silhouette.body;
  fillShadowBand(ctx, projectToHill(state, camera, boots), projectToHill(state, camera, head), 4, density, color);
}

const SKIER_STYLE = SKIER_STYLES.classic;

function drawSkier(ctx, state, camera, time) {
  const { sx, sy } = toScreen(camera, state.x, state.y);
  const pose = skierPose(state);
  if (pose === 'crouch') {
    drawJumper(ctx, SKIER_STYLE, 'crouch', sx, sy - 2, inrunPointAt(state.hill, state.inrunDistance).angle);
  } else if (pose === 'flight') {
    drawJumper(ctx, SKIER_STYLE, 'flight', sx, sy, state.angle);
  } else if (pose === 'telemark') {
    const slope = Math.atan2(hillHeightAt(state.hill, state.x + 1) - hillHeightAt(state.hill, state.x), 1);
    drawJumper(ctx, SKIER_STYLE, 'telemark', sx, sy - 2, slope);
  } else {
    drawJumper(ctx, SKIER_STYLE, 'flight', sx, sy - 8, Math.PI + Math.sin(time * 5) * 0.3);
  }
}

// ---- HUD --------------------------------------------------------------------------------------

function drawWindFlag(ctx, wind) {
  const poleX = SCREEN_WIDTH - 32;
  ctx.fillStyle = PALETTE.concrete1;
  ctx.fillRect(poleX, 6, 2, 34);
  const angle = -90 * DEG + windFlagLift(wind) * 90 * DEG; // straight down in calm, horizontal at full wind
  for (let row = 0; row < 6; row++) {
    ctx.fillStyle = Math.floor(row / 2) % 2 === 0 ? PALETTE.orange : PALETTE.white;
    for (let i = 0; i <= 18; i++) {
      ctx.fillRect(Math.round(poleX + 2 + Math.cos(angle) * i), Math.round(8 + row - Math.sin(angle) * i), 1, 1);
    }
  }
  drawText(ctx, `TUULI ${formatWind(wind)}`, poleX - 12, 6, { align: 'right', scale: TEXT_SCALE, color: PALETTE.white });
}

function drawHud(ctx, state, label) {
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, SCREEN_WIDTH, HUD_HEIGHT);
  drawText(ctx, `${Math.round(state.speed * KMH_PER_MS)} KM/H`, 8, 6, { scale: TEXT_SCALE, color: PALETTE.white });
  drawText(ctx, label, 8, 24, { scale: TEXT_SCALE, color: PALETTE.skyLight });
  if (state.phase === 'flight') {
    const degrees = Math.round(state.angle / DEG);
    drawText(ctx, `KULMA ${degrees}°`, 300, 6, { align: 'center', scale: TEXT_SCALE, color: PALETTE.white });
    ctx.fillStyle = PALETTE.darkGrey;
    ctx.fillRect(240, 27, 120, 8);
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(298, 25, 4, 12);
    ctx.fillStyle = PALETTE.yellow;
    ctx.fillRect(240 + Math.round((120 * Math.min(90, degrees)) / 90) - 2, 25, 4, 12);
  }
  drawWindFlag(ctx, state.wind);
}

// Landing cue: a bar that shows the time left to touchdown, with the green zone where a press lands perfectly.
const CUE = { x: 200, y: 470, width: 240, height: 10, maxSeconds: 1.2 };

function drawLandingCue(ctx, state) {
  if (state.phase !== 'flight') return;
  const eta = predictTouchdown(state, CUE.maxSeconds + 0.1);
  if (eta === null || state.takeoff?.late) return;
  const { perfectLandingGap, poorLandingGap } = JUMP_CONFIG;
  const xAt = (seconds) => CUE.x + Math.round(CUE.width * (1 - seconds / CUE.maxSeconds)); // the touchdown is at the right end
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(CUE.x - 2, CUE.y - 2, CUE.width + 4, CUE.height + 4);
  ctx.fillStyle = PALETTE.darkGrey;
  ctx.fillRect(CUE.x, CUE.y, CUE.width, CUE.height);
  ctx.fillStyle = PALETTE.green;
  ctx.fillRect(xAt(poorLandingGap), CUE.y, xAt(perfectLandingGap) - xAt(poorLandingGap), CUE.height);
  const marker = Math.min(CUE.x + CUE.width - 2, xAt(Math.min(eta, CUE.maxSeconds)));
  ctx.fillStyle = PALETTE.yellow;
  ctx.fillRect(marker, CUE.y - 4, 4, CUE.height + 8);
  if (eta <= poorLandingGap && eta >= perfectLandingGap) {
    drawText(ctx, 'NYT!', SCREEN_WIDTH / 2, CUE.y - 30, { align: 'center', scale: 3, color: PALETTE.green, shadow: PALETTE.black });
  }
}

function drawBanner(ctx, state, time) {
  if (state.phase === 'ready') {
    drawBlinking(ctx, 'VÄLILYÖNTI = LÄHTÖ', SCREEN_WIDTH / 2, 400, time, { scale: TEXT_SCALE, color: PALETTE.night });
  } else if (state.phase === 'landed') {
    drawText(ctx, formatDistance(state.distance), SCREEN_WIDTH / 2, 80, { align: 'center', scale: 4, color: PALETTE.yellow, shadow: PALETTE.wood8 });
  } else if (state.phase === 'fallen') {
    drawText(ctx, 'KAATUMINEN', SCREEN_WIDTH / 2, 80, { align: 'center', scale: 4, color: PALETTE.red, shadow: PALETTE.black });
  }
}

export function renderSkiJump(ctx, { state, label, time }) {
  const camera = cameraFor(state);
  drawMistySky(ctx, camera);
  drawForestLayer(ctx, camera, FAR_FOREST);
  drawForestLayer(ctx, camera, NEAR_FOREST);
  drawGround(ctx, state, camera);
  drawPillars(ctx, state, camera);
  drawTableWall(ctx, state, camera);
  drawInrun(ctx, state, camera);
  drawSpectators(ctx, state, camera);
  drawGuideLine(ctx, state, camera);
  drawShadow(ctx, state, camera);
  drawSkier(ctx, state, camera, time);
  drawSnowfall(ctx, time);
  drawHud(ctx, state, label);
  drawBanner(ctx, state, time);
  drawLandingCue(ctx, state);
}
