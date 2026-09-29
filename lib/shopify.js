/* Reading the catalogue.

   The Storefront API rather than the storefront's own /products/<h>.js, for one
   reason: the SKU short code lives on a metafield, and the .js payload carries
   no metafields. The API also answers with permissive CORS, which .js does too
   but the admin API does not, so this is the only route that works from a page
   with no server behind it. */

const SHOP = 'xjaypt-f5.myshopify.com';

/* The public, read-only kind of Storefront token that every headless Shopify
   storefront ships in its client bundle. It reads products already published on
   tenzen.in and nothing else. It is NOT the Admin token; never swap one in.
   To rotate: make a new Storefront access token in the admin, paste it here. */
const TOKEN = '476ba38529f786d04dd455bac86b07d4';
const URL_ = `https://${SHOP}/api/2025-01/graphql.json`;

/* The four carousel orders, transcribed from the Figma board. Deliberately NOT
   the website's media orders - the site leads with a model shot, the carousel
   leads with the flat - so they are written out in full rather than derived. */
export const ORDERS = {
  'man-front':   ['Front', 'Model-Man-Front',   'Macro-Front', 'Model-Woman-Back',  'Back'],
  'man-back':    ['Back',  'Model-Man-Back',    'Macro-Back',  'Model-Woman-Front', 'Front'],
  'woman-front': ['Front', 'Model-Woman-Front', 'Macro-Front', 'Model-Man-Back',    'Back'],
  'woman-back':  ['Back',  'Model-Woman-Back',  'Macro-Back',  'Model-Man-Front',   'Front'],
};

/* How each position is treated, again straight off the board: the two flats
   carry the copy, the models sit plain on the gradient, and the close-up is the
   one slide that bleeds to all four edges. */
export const KINDS = ['flat', 'model', 'macro', 'model', 'flat'];

async function gql(query, variables = {}) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Storefront API ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

const Q_LIST = `query($cursor:String){
  products(first:100, after:$cursor, sortKey:CREATED_AT, reverse:true){
    pageInfo{ hasNextPage endCursor }
    nodes{ handle title productType tags
      sku: metafield(namespace:"tenzen", key:"sku_code"){ value } } } }`;

const Q_ONE = `query($h:String!){
  product(handle:$h){ handle title productType tags descriptionHtml
    sku: metafield(namespace:"tenzen", key:"sku_code"){ value }
    collections(first:15){ nodes{ title handle } }
    media(first:40){ nodes{ ... on MediaImage { image{ url width height } } } } } }`;

/* "Model-Man-Front_536fb994-....webp" -> "Model-Man-Front". Shopify appends a
   uuid on re-upload; the part before the first underscore is the name the
   studio actually gave the file. */
export function baseName(url) {
  const file = url.split('?')[0].split('/').pop() || '';
  return file.replace(/\.[a-z0-9]+$/i, '').split('_')[0];
}

/* Shopify serves any stored image at any width, so ask for the size about to be
   drawn instead of pulling 2800px and throwing most of it away. */
export function sized(url, w) {
  return `${url.split('?')[0]}?width=${Math.min(2800, Math.max(200, Math.round(w)))}`;
}

export async function loadCatalogue() {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 6; page++) {
    const d = await gql(Q_LIST, { cursor });
    out.push(...d.products.nodes);
    if (!d.products.pageInfo.hasNextPage) break;
    cursor = d.products.pageInfo.endCursor;
  }
  return out.map(p => ({
    handle: p.handle,
    title: p.title,
    type: p.productType || '',
    sku: p.sku?.value || '',
    order: (p.tags || []).find(t => ORDERS[t]) || 'man-front',
  }));
}

/* The heading is whatever the title says before the product type, the
   subheading is the type and the colour that trails it. Splitting on the type
   rather than on a word count is what keeps "The Ragnarsons Polo Sweatshirt
   Navy" from breaking in the wrong place. */
export function splitTitle(title, type) {
  if (type) {
    const at = title.toLowerCase().indexOf(type.toLowerCase());
    if (at > 0) return [title.slice(0, at).trim(), title.slice(at).trim()];
  }
  const words = title.split(/\s+/);
  const cut = Math.max(1, words.length - 3);
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

const variants = n => [n, `${n}-Alt`, `${n}-Full`];

/* A slot names one exact file, but not every SKU was shot the same way - baby
   tees have no man in them at all. Rather than fail, walk outwards from the
   wanted frame: its own alternate and full-length crops, then the same pose on
   the other model, then the other pose, then anything. */
export function fallbacks(want) {
  const chain = [...variants(want)];
  const m = want.match(/^Model-(Man|Woman)-(Front|Back)$/);
  if (m) {
    const [, who, side] = m;
    const other = who === 'Man' ? 'Woman' : 'Man';
    const flip = side === 'Front' ? 'Back' : 'Front';
    chain.push(...variants(`Model-${other}-${side}`),
               ...variants(`Model-${who}-${flip}`),
               ...variants(`Model-${other}-${flip}`), 'Model-Side');
  }
  if (want === 'Macro-Front') chain.push('Macro-Back');
  if (want === 'Macro-Back')  chain.push('Macro-Front');
  if (want === 'Front')       chain.push('Back');
  if (want === 'Back')        chain.push('Front');
  chain.push('Shoot-1', 'Shoot-2');
  return chain;
}

/* `used` keeps a carousel from showing the same photograph twice: a baby tee
   has no man's back to fall back to, and without this both model slides would
   land on the one woman's front shot it does have. A repeat still beats a gap,
   so the second pass ignores the set rather than dropping a slide. */
export function pickImage(byName, want, used) {
  const chain = fallbacks(want);
  for (const n of chain) if (byName[n] && !used.has(n)) return { name: n, ...byName[n] };
  for (const n of chain) if (byName[n]) return { name: n, ...byName[n] };
  const spare = Object.keys(byName).find(n => !used.has(n)) || Object.keys(byName)[0];
  return spare ? { name: spare, ...byName[spare] } : null;
}

export async function readProduct(handle) {
  const d = await gql(Q_ONE, { h: handle });
  if (!d.product) throw new Error('No product at that link.');
  const p = d.product;
  const byName = {};
  for (const n of p.media.nodes) {
    if (n.image) byName[baseName(n.image.url)] = n.image;
  }
  const [heading, sub] = splitTitle(p.title, p.productType || '');

  /* The collections a product sits in are split by what they are: the
     catalogue cuts (Men, New Arrivals, its own category) are not stories, the
     album it belongs to is. Only the album is worth naming in a caption. */
  const CUTS = /^(men|women|best ?sellers|new arrivals|tees|caps|sweatpants|hoodies|sweatshirts|polo sweatshirts|oversized|baby tees|waffle tees|fall-winter|hoodies & sweatshirts|shop all|all)/i;
  const album = (p.collections?.nodes || [])
    .map(c => c.title)
    .find(t => !CUTS.test(t) && !/^oversized|^snapback|^classic|^ottoman|^henley|^layered|^loose/i.test(t)) || '';

  return {
    handle: p.handle,
    title: p.title,
    heading, sub,
    /* `description` returns the copy with its paragraph breaks collapsed into
       spaces, which makes a four-paragraph product read as one run-on line.
       The HTML keeps them, so the paragraphs are split out here once. */
    paragraphs: (p.descriptionHtml || '')
      .split(/<\/p>/i)
      .map(x => x.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim())
      .filter(Boolean),
    album,
    type: p.productType || '',
    sku: p.sku?.value || '',
    order: (p.tags || []).find(t => ORDERS[t]) || 'man-front',
    byName,
  };
}
