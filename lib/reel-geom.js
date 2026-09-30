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
  { slot: 'bl', w:  900, h: 1350, deg:  10, cx:  519.38, cy: 3657.89 },
  { slot: 'tr', w: 1200, h: 1800, deg:  10, cx: 2446.50, cy: 2205.52 },
  { slot: 'br', w: 1500, h: 2250, deg:  10, cx: 2556.96, cy: 4267.14 },
  { slot: 'tl', w: 1500, h: 2250, deg: -10, cx:  471.96, cy: 1996.06 },
];

/* The two garments. The bottom one is painted first so the top one overlaps
   it, which is what makes the pair read as one outfit rather than two
   pictures. Both boxes are 2:3, the ratio every product shot is framed at. */
export const GARMENTS = {
  bottom: { x:  250,     y: 1583.2, w: 2500,    h: 3750    },
  top:    { x:  385.135, y:   81,   w: 2229.73, h: 3344.592 },
};

/* How much of its box each garment fills, and how far it sits off the box's
   centre, in board units.

   These are the screen-test numbers the brief asked for rather than derived
   ones: the board's flat artwork is a photograph of the garment with its own
   margin inside a 2:3 frame, and a bare model has none, so fitting the model
   to the box edge renders it noticeably bigger than the board shows it. These
   were set by rendering frame 0 beside the board and matching the hem lines -
   hoodie hem at 46.9% of the frame's height, trouser hem at 92.8%. */
export const FIT = {
  top:    { fill: 0.75, offsetY: -137 },
  bottom: { fill: 0.80, offsetY:    0 },
};

export const LOGO = { w: 609.757, h: 200, top: 354 };

/* Both blocks carry the same two lines at the same sizes. The bottom one is
   right-aligned and drawn through a difference blend, which is what keeps it
   legible whether the photograph behind it is black or white. */
export const TEXT = {
  title: { size: 84, weight: 500, lh: 1.0 },
  sub:   { size: 60, weight: 400, lh: 1.5 },
  tracking: -2,
  topRight:   { x: 1996, y:  758, align: 'left',  fill: '#000000', blend: 'source-over' },
  bottomLeft: { x: 1004, y: 4546, align: 'right', fill: '#ffffff', blend: 'difference' },
};

export const FAMILY = '"Helvetica Neue", "HelveticaNeue", Helvetica, Arial, sans-serif';

/* 15 seconds, one full turn, 60 frames a second. 900 frames, and frame 900 is
   frame 0 again, so the clip loops without a seam. */
export const DURATION = 15;
export const FPS = 60;
export const FRAMES = DURATION * FPS;

/* Instagram serves reels at 1080x1920 and re-encodes anything larger, so that
   is the default rather than the ceiling. */
export const SIZES = [
  { w: 1080, label: '1080p', note: 'what Instagram serves' },
  { w: 1440, label: '1440p', note: 'headroom' },
  { w: 2160, label: '4K',    note: 'archival' },
];
