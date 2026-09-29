/* The caption maker.

   Modelled on what @tenzen.angels actually posts, not on the product page. The
   posted captions are short - a line, the drop, the link, the tags - and the
   product description is four paragraphs of it. An earlier version of this file
   pasted those paragraphs in, which read like a PDP and nothing like the feed.

   Three real captions, which is where every rule below comes from:

     Narcissistic Tendency. Live Now.
     #tenzen #tenzenangels #oversizedhoodie

     The Ragnarsons. LIVE NOW
     https://tenzen.in/TRSN43
     #tenzen #tenzenangels #streetwear

     The North remembers.
     Kingdom of Northumbria oversized sweatshirt white
     LIVE NOW
     #tenzen #tenzenangels #streetwear #sweatshirt #england

   So: two shapes. NAME leads with the drop's name and the call. LINE opens on
   a reference the print is about, then names the drop underneath. The link is
   optional and written in full. Tags always open #tenzen #tenzenangels and run
   to three or five, lowercase, no spaces. */

export const SHAPES = [
  { id: 'name', label: 'Name first' },
  { id: 'line', label: 'Line first' },
];

/* Locked, because every posted caption opens with these two. */
export const FIXED_TAGS = ['tenzen', 'tenzenangels'];

const tagify = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/* What the account tags beyond the two fixed ones: the broad one, the garment,
   and the drop it belongs to. Offered, not imposed - a caption ran #england
   for a Northumbria print, and no rule derives that from a catalogue. */
export function suggestTags(product) {
  if (!product) return [];
  const out = [];
  const add = (t, on) => { const v = tagify(t); if (v && !out.some(x => x.tag === v)) out.push({ tag: v, on }); };

  add('streetwear', true);
  add(product.type, true);                       // oversizedhoodie, polosweatshirt

  /* "Polo Sweatshirt" also gives the plain garment word, which is what the
     Northumbria caption used. */
  const last = (product.type || '').trim().split(/\s+/).pop();
  if (last && tagify(last) !== tagify(product.type)) add(last, false);

  if (product.album) add(product.album, false);  // absolutecinema
  return out;
}

/* The line a LINE-first caption opens on. The product copy's first sentence is
   written to carry the print's reference, which is the same job, so it is the
   suggestion - usually worth shortening by hand. */
export function suggestHook(product) {
  const first = (product?.paragraphs || [])[0] || '';
  const sentence = (first.match(/^[^.!?]*[.!?]/) || [first])[0];
  return sentence.trim();
}

/* Sentence case for the drop's full name, the way the Northumbria caption
   wrote it: "Kingdom of Northumbria oversized sweatshirt white" - the garment
   and colour drop to lower case, and so do the small joining words inside the
   name itself. The catalogue title-cases everything ("Kingdom Of"), which is
   right on a product page and wrong here. */
const SMALL = new Set(['of', 'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'de']);

function fullName(product) {
  const t = (product?.title || '').trim();
  if (!t) return '';
  const head = (product.heading || '').trim();
  const name = (head && t.toLowerCase().startsWith(head.toLowerCase()))
    ? head + t.slice(head.length).toLowerCase()
    : t;
  return name
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .join(' ');
}

export function buildCaption(product, opts = {}) {
  if (!product) return '';
  const { shape = 'name', hook = '', link = true, call = 'LIVE NOW', tags = [] } = opts;

  const blocks = [];
  const url = product.sku ? `https://tenzen.in/${product.sku}` : '';

  if (shape === 'line') {
    const line = (hook || suggestHook(product)).trim();
    if (line) blocks.push(line);
    blocks.push([fullName(product), call].filter(Boolean).join('\n'));
  } else {
    const name = (product.heading || product.title || '').trim();
    blocks.push(`${name}. ${call}`.trim());
  }

  if (link && url) blocks.push(url);

  const all = [...FIXED_TAGS, ...tags.filter(t => !FIXED_TAGS.includes(t))];
  if (all.length) blocks.push(all.map(t => '#' + t).join(' '));

  return blocks.join('\n\n');
}

/* Instagram allows 2,200 characters and truncates the feed preview at roughly
   125, which for captions this short is the only number that ever matters. */
export function captionStats(text) {
  const n = [...(text || '')].length;
  return { chars: n, overLimit: n > 2200 };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* Blocked outside a secure context or without a gesture the browser
       trusts, so fall back to the selection route. */
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
