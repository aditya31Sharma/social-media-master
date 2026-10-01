/* Real garment lengths, in centimetres.

   The GLBs are not on a shared scale and cannot be made to be: an oversized
   tee measures 0.700 in its own units, an oversized hoodie 1.896, and a pair
   of sweatpants 1.903 - taller than the hoodie. Each asset was normalised on
   its own, so "fit each one to its box" produced trousers the size of a torso.

   So relative size comes from the garments themselves rather than the files.
   These are body lengths off the size charts, and one shared centimetres-to-
   pixels factor then puts every pairing in proportion. */

/* Calibrated in the lab, not taken raw off a size chart. An oversized hoodie
   measures about 72cm and sweatpants about 104, but a garment photographed
   flat reads smaller than the same garment on a body, and the board is drawn
   from flats - so the pair was tuned against it and signed off at 64 and 100.
   Every other top carries the same 64/72 adjustment and every other bottom the
   same 100/104, which keeps a tee correctly longer than a hoodie and a baby
   tee correctly shorter. */
const TOP = (64 / 72) * 1.10, BOTTOM = 100 / 104;   // tops asked up 10%

export const LENGTH_CM = {
  'Oversized Hoodie':     64 * 1.10,
  'Oversized Sweatshirt': 70 * TOP,
  'Polo Sweatshirt':      70 * TOP,
  'Oversized Tee':        74 * TOP,
  'Acid Wash Tee':        74 * TOP,
  'Layered Tee':          76 * TOP,
  'Waffle Tee':           74 * TOP,
  'Henley Waffle Tee':    74 * TOP,
  'Baby Tee':             42 * TOP,
  'Loose-Fit Sweatpants': 100,
  'Snapback Cap':         18 * TOP,
  'Classic Baseball Cap': 18 * TOP,
  'Ottoman Baseball Cap': 18 * TOP,
};

/* Anything unlisted is treated as a top of ordinary length rather than being
   fitted to its box, which is the failure this replaces. */
export const lengthOf = type => LENGTH_CM[type] || 72;

/* How far the waistband sits UP behind the top's hem. A top is worn over
   trousers, so the two overlap; without this they stack like two separate
   pictures. */
export const OVERLAP_CM = 5;

/* A cropped top finishes above the waistband rather than over it, so the
   standard overlap pushes it down into the trousers. These are centimetres to
   RAISE the top, by type. */
const LIFT_CM = {
  'Baby Tee': 13,
};
export const liftOf = type => LIFT_CM[type] || 0;

/* Which half of an outfit a garment belongs to. The bottomwear picker offers
   only bottoms - scrolling the whole catalogue to find a pair of trousers is
   not a search, it is a chore - and the topwear picker offers only tops. */
const BOTTOM_TYPES = /pant|jogger|short|trouser|sweatpant|skirt/i;
const HEADWEAR = /cap|hat|beanie/i;
export const isBottomwear = type => BOTTOM_TYPES.test(type || '');
export const isTopwear = type => !BOTTOM_TYPES.test(type || '') && !HEADWEAR.test(type || '');
