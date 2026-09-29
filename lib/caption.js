/* The caption for a post.

   Built from the product's own copy rather than written fresh, because that
   copy is already the brand voice: it was authored against the print, it leads
   with the reference the design is actually about, and it names the audience
   instead of describing the garment. A caption that paraphrases it would only
   drift from it.

   The shape is four parts:

     hook      the first line of the product description, which is the line
               that carries the reference
     name      what the thing is, and the colour
     link      tenzen.in/<CODE>, the short link the pill on slide 1 already
               prints, so the caption and the artwork agree
     tags      the brand, the album the drop belongs to, and the category

   TUNING: this file is the only place the shape lives. Everything it produces
   is editable in the app before it is copied, so treat the output as a first
   draft rather than the final word. */

const BRAND_TAGS = ['tenzen', 'tenzenangels'];

const hashify = s => '#' + s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/* The first paragraph carries the print's reference; the second names who it
   is for. The third is fabric and construction and the fourth is the shipping
   line - both belong on a product page and neither belongs in a caption. */
const hook = paras => paras[0] || '';
const audience = paras =>
  (/for the ones who|built for/i.test(paras[1] || '') ? paras[1] : '');

export function buildCaption(product, { includeAudience = true } = {}) {
  if (!product) return '';
  const parts = [];

  const paras = product.paragraphs || [];
  const h = hook(paras);
  if (h) parts.push(h);

  const a = includeAudience ? audience(paras) : '';
  if (a) parts.push(a);

  const name = [product.heading, product.sub].filter(Boolean).join(' — ');
  const link = product.sku ? `tenzen.in/${product.sku}` : '';
  parts.push([name, link].filter(Boolean).join('\n'));

  const tags = [...BRAND_TAGS];
  if (product.album) tags.push(hashify(product.album).slice(1));
  if (product.type) tags.push(hashify(product.type).slice(1));
  parts.push(tags.map(t => '#' + t).join(' '));

  return parts.join('\n\n');
}

/* Instagram counts characters, and cuts a caption off at 125 in the feed
   before "more". Both numbers are worth seeing while editing. */
export function captionStats(text) {
  const n = [...(text || '')].length;
  return { chars: n, overLimit: n > 2200, firstLine: [...(text || '').split('\n')[0]].length };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* clipboard is blocked without a secure context or a user gesture the
       browser trusts, so fall back to the selection route. */
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
