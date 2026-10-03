/* The reel board, transcribed from Figma node 4834:15588.

   Everything is in the board's own 3000 x 5333 space and multiplied through a
   single scale factor S at render time, exactly as the carousel does - so a
   1080-wide export and a 2160-wide one are the same drawing, not one resampled
   from the other. 5333/3000 is 16:9, so a 9:16 export of any height lands on
   the same numbers.

   The four photographs sit at +/-10 degrees. Figma reports them as bounding
   boxes of the ROTATED rect, so the numbers below are the unrotated content
   size and the centre the rotation happens about - which is what a canvas
   needs and what a bounding box cannot give you directly. Each was recovered
   from its box: for a w x h rect at angle a, the box is
   (w·cos a + h·sin a) x (w·sin a + h·cos a), and the centre is the box's. */

export const W = 3000, H = 5333;

/* Painted in this order, which is Figma's own: the bottom-left photograph is
   furthest back and the top-left one sits over the bottom-right. */
export const PHOTOS = [
  { slot: 'bl', w: 1200, h: 1800, deg:  15, cx:  551.37, cy: 3697.88 },
  { slot: 'tr', w: 1200, h: 1800, deg: -15, cx: 2446.50, cy: 1989.51 },
  { slot: 'br', w: 1800, h: 2700, deg:  10, cx: 2526.75, cy: 3929.78 },
  { slot: 'tl', w: 1500, h: 2250, deg: -10, cx:  471.96, cy: 1996.06 },
];

/* The two garments. Both boxes are 2:3, the ratio every product shot is
   framed at. Kept for reference; the render uses OUTFIT below, since the two
   are one object now. */
export const GARMENTS = {
  bottom: { x:  250,     y: 2055.21, w: 2500,    h: 3750    },
  top:    { x:  385.135, y:  233,    w: 2229.73, h: 3344.592 },
};

/* The garments share ONE box, because they are one outfit.

   They used to be fitted to their two boxes independently, and that was the
   bug behind trousers the size of a torso: the GLBs are not on a common
   scale - an oversized tee measures 0.700 in its own units, a hoodie 1.896,
   a pair of sweatpants 1.903 - so "fill your box" gave each garment an
   arbitrary size. Relative size now comes from real garment lengths in
   centimetres (see garment-scale.js) through one shared scale.

   This is Figma's own Group 1709, the box the two garments sit in together. */
export const OUTFIT = { x: 250, y: 233, w: 2500, h: 5572.21 };

/* Set in the lab against the board and signed off. `fitCm` is how much world
   height the box shows, so a smaller number is a closer view: 200 / 1.15 is
   the 15% step in.

   The outfit is anchored by its HEM rather than centred, and the hem is put
   `bleed` past the bottom of the frame so it runs off the edge instead of
   stopping short of it. Bleed is in board units, which is 30px at the 1080
   default and scales with any other export. */
export const FIT = {
  overlap: 5,                 // cm the waistband sits up behind the hem
  /* The pair is grouped and treated as one object: scaled together and
     lifted together, so their relationship never changes. */
  groupScale: 1.05,
  groupRise: 0.05,            // fraction of the frame's height, upwards
  /* The hoodie's body hangs forward of the trouser waist, so in profile the
     two read as offset. A small push back in depth lines their centres up. */
  topZ: -0.006,               // fraction of the frame's height, away from camera
  /* Centimetres of world across the FRAME's height, not the outfit box's.
     The box moves and resizes whenever the board is redrawn, and tying the
     framing to it silently rescaled the garments every time - which is what
     made them grow again after the last board update. Against the frame, 200
     means the same thing it meant in the lab. */
  fitCm: 200,
  nudge: -2,                  // cm of fine adjustment, up is negative
  bleed: 80 / (1080 / 3000),  // board units the hem runs past the frame (30 + 50)
};

/* Also from the lab. Two lights and no ambient: a hard key from the side with
   a strong rim, which is what gives the fabric its shape. The environment is
   left out of the materials entirely - `envMat: 0` - because any reflection on
   fleece reads as wet plastic rather than cotton. */
export const LIGHT = {
  exposure: 0.78, env: 0.94,
  key: 8, keyAz: 93, keyEl: 46,
  fill: 0, rim: 6.15, ambient: 0,
  shadows: true, tone: 'aces',
};

export const FABRIC = { roughness: 0.3, sheen: 0, envMat: 0 };

/* Every photograph change also re-deals the card's angle and size. The board
   fixes four tilts and three sizes; these are the range those span, so a
   re-dealt card always looks like it belongs to the same design rather than
   like a different one. Sizes stay 2:3, which every product shot is. */
export const CARD_TILT = 15;              // degrees either way
export const CARD_W_MIN = 1200;
export const CARD_W_MAX = 1800;

/* The cards arrive out of focus and resolve as they reach their places. */
export const CARD_BLUR = 120;             // board units at the start of the move

/* And so do the garments on their way in. The stage canvas is transparent
   around them, so blurring the whole composite softens their silhouettes
   properly - there is no clip to leave a hard edge behind, which is what the
   cards needed a separate surface for. */
export const MODEL_BLUR = 150;            // board units at the start of the drop

export const LOGO = { w: 609.757, h: 200, top: 354 };

/* Both blocks carry the same two lines at the same sizes, and BOTH are drawn
   through a difference blend - white against white reads black, white against
   a dark photograph reads white - so neither is ever lost whatever drifts
   behind it. The board draws the top one in flat black, which is what that
   blend produces over the white it sits on anyway. */
export const TEXT = {
  title: { size: 84, weight: 500, lh: 1.0 },
  sub:   { size: 60, weight: 400, lh: 1.5 },
  tracking: -2,
  topRight:   { x: 1996, y:  758, align: 'left',  fill: '#ffffff', blend: 'difference' },
  bottomLeft: { x: 1004, y: 4828, align: 'right', fill: '#ffffff', blend: 'difference' },
};

export const FAMILY = '"Helvetica Neue", "HelveticaNeue", Helvetica, Arial, sans-serif';

/* 15 seconds at 60 frames a second. TURNS is whole revolutions across the
   clip, so frame 900 lands back on frame 0 whatever it is set to and the clip
   still loops without a seam. Two turns is 48 degrees a second. */
export const DURATION = 15;
export const FPS = 60;
export const FRAMES = DURATION * FPS;
export const TURNS = 2;

/* How long each photograph holds, near enough: the corners are staggered so
   they do not all cut at the same instant, and each one then divides its own
   remaining time equally, so the holds come out slightly different per corner
   and every corner still finishes exactly on 15 seconds. */
export const SWITCH = 0.5;
/* All four corners start together. They were staggered to avoid four
   simultaneous cuts, but cutting as one turns out to be the stronger read -
   the whole board changes at once - and it also collapses the four sound hits
   into a single clean one instead of four copies fighting each other. */
export const STAGGER = 0;                 // seconds between corner starts

/* The cut runs flat out for most of the clip and only settles at the end.
   Ramping from the very first frame started the slowdown far too early - by
   halfway it had already lost its urgency. So: SWITCH_FIRST holds all the way
   to DECEL_FROM, and only the last stretch ramps to SWITCH_LAST so the reel
   arrives somewhere instead of just stopping.

   Running flat out for ten seconds needs far more frames than a SKU has
   photographs, so they repeat - which is fine, and asked for. */
export const SWITCH_FIRST = 0.20;
export const SWITCH_LAST  = 1.30;
/* Where it starts to settle. Longer than it used to be and starting earlier,
   because the slowdown reads better spread over eight seconds than crammed
   into five. */
export const DECEL_FROM   = 7;

/* The opening runs in order rather than all at once: the garments arrive on
   an empty white frame, and only once they are in do the photographs spread
   out from the middle to their places. Overlapping the two made it a scramble
   - nothing was legible because everything moved together. */
export const MODEL_IN = 0.8;              // garments slide in
export const CARDS_IN = 0.7;              // then each photograph spreads
/* One corner at a time rather than all four together: a quarter second apart
   reads as four deliberate placements instead of one scatter. */
export const CARD_STAGGER = 0.25;
export const INTRO = MODEL_IN + CARDS_IN + CARD_STAGGER * (PHOTOS.length - 1);

/* And nothing cuts until that has finished and had a beat to settle. A
   photograph changing while the board is still assembling itself reads as a
   mistake rather than as an edit. */
export const SETTLE = 0.5;
export const SWITCH_START = INTRO + SETTLE;

/* Instagram serves reels at 1080x1920 and re-encodes anything larger, so that
   is the default rather than the ceiling. */
export const SIZES = [
  { w: 1080, label: '1080p', note: 'what Instagram serves' },
  { w: 1440, label: '1440p', note: 'headroom' },
  { w: 2160, label: '4K',    note: 'archival' },
];
