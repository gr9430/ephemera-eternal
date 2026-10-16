/**
 * randomize.test.js — Node.js test for the pure composer in randomize.js.
 * No DOM required. A seeded random source makes every failure replayable.
 */

'use strict';

const R = require('./randomize.js');
const clipart = require('../data/clipart.json');
const photos = require('../data/photos.json');
const gallery = require('../data/gallery.json');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

// mulberry32: small seeded generator, returns [0, 1)
function seeded(seed) {
    return function () {
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const fonts = { readable: ['Liberation Mono', 'Inter-Regular', 'Libre-Baskerville'], display: ['Anthony', 'Avara-Black'] };
const SEEDS = [1, 2, 3, 42, 2026];
const BLEED = ['background-image', 'texture'];

function compose(seed, extra) {
    let id = 0, n = 0;
    return R.composeZine(Object.assign({
        line: symbol => `${symbol} line ${++n}`,
        clipart, photos, fonts,
        rng: seeded(seed),
        newId: () => ++id,
        insidePages: 24
    }, extra || {}));
}

const all = (pages, fn) => pages.every(p => p.elements.every(e => fn(e, p)));
// Wallpaper repeats one piece on its page on purpose, so there it counts as one draw
const srcs = pages => pages.flatMap(p => {
    const list = p.elements.filter(e => e.type === 'image' || e.type === 'background-image').map(e => e.src);
    return p.layout === 'wallpaper' ? [...new Set(list)] : list;
});

console.log('[structure]');
for (const seed of SEEDS) {
    const pages = compose(seed);
    const roles = pages.map(p => p.role);
    assert(`seed ${seed}: front cover, Your info, 24 inside, back cover`,
        roles.length === 27 && roles[0] === 'front-cover' && roles[1] === 'their-info' &&
        roles.slice(2, 26).every(r => r === 'inside') && roles[26] === 'back-cover');
    assert(`seed ${seed}: Your info is empty`, pages[1].elements.length === 0);
    const ids = pages.flatMap(p => [p.id, ...p.elements.map(e => e.id)]);
    assert(`seed ${seed}: page and element ids are unique`, new Set(ids).size === ids.length);
}

console.log('[sources]');
{
    const flyerSrcs = new Set(gallery.map(g => g.src));
    const allowed = new Set([...clipart, ...photos].map(i => i.src));
    for (const seed of SEEDS) {
        const used = srcs(compose(seed));
        assert(`seed ${seed}: no flyers`, used.every(s => !flyerSrcs.has(s) && !s.startsWith('images/flyers/')));
        assert(`seed ${seed}: images only from clip art and photos`, used.every(s => allowed.has(s)));
    }
}

console.log('[no repeat before the pool is used up]');
{
    const check = (used, pool) => {
        const poolSrcs = new Set(pool.map(i => i.src));
        let seen = new Set();
        for (const s of used.filter(u => poolSrcs.has(u))) {
            if (seen.size === poolSrcs.size) seen = new Set();
            if (seen.has(s)) return false;
            seen.add(s);
        }
        return true;
    };
    for (const seed of SEEDS) {
        const used = srcs(compose(seed));
        assert(`seed ${seed}: photos`, check(used, photos));
        assert(`seed ${seed}: clip art`, check(used, clipart));
    }
    const small = clipart.slice(0, 3);
    const used = srcs(compose(7, { clipart: small, photos: [] }));
    assert('tiny pool: reuses only after all 3 pieces used', check(used, small) && used.length > 3);
}

console.log('[layouts]');
{
    const seen = new Set();
    for (const seed of SEEDS) {
        const pages = compose(seed);
        assert(`seed ${seed}: front cover uses the front-cover layout`, pages[0].layout === 'front-cover');
        const rest = pages.slice(2);
        assert(`seed ${seed}: every inside page and the back cover has a known layout`, rest.every(p => R.RANDOM_LAYOUTS.includes(p.layout)));
        assert(`seed ${seed}: no layout twice in a row`, rest.every((p, i) => i === 0 || p.layout !== rest[i - 1].layout));
        rest.forEach(p => seen.add(p.layout));
    }
    assert('all four layouts show up', R.RANDOM_LAYOUTS.every(l => seen.has(l)));
}

console.log('[margins]');
for (const seed of SEEDS) {
    const inside = all(compose(seed), e => {
        if (BLEED.includes(e.type)) return true;
        const box = R.rotatedSize(e.w, e.h, e.rotation);
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        return cx - box.w / 2 >= 47.5 && cx + box.w / 2 <= 480.5 && cy - box.h / 2 >= 47.5 && cy + box.h / 2 <= 768.5;
    });
    assert(`seed ${seed}: every non-bleed element sits inside the margins`, inside);
}

console.log('[text]');
for (const seed of SEEDS) {
    const pages = compose(seed);
    assert(`seed ${seed}: text under 36px uses readable fonts`, all(pages, e => e.type !== 'text' || e.fontSize >= 36 || fonts.readable.includes(e.font)));
    assert(`seed ${seed}: text 36px and up uses display fonts`, all(pages, e => e.type !== 'text' || e.fontSize < 36 || fonts.display.includes(e.font)));
    assert(`seed ${seed}: text is near-black`, all(pages, e => e.type !== 'text' || e.color === '#1a1a1a'));
    const front = pages[0].elements.filter(e => e.type === 'text');
    assert(`seed ${seed}: front cover title is Ephemera Eternal in a display font`,
        front.length >= 2 && front[0].content === R.RANDOM_TITLE && fonts.display.includes(front[0].font));
    assert(`seed ${seed}: front cover subtitle is random output`, /^(slogan|origin) line \d+$/.test(front[1].content));
    assert(`seed ${seed}: photo + slogan pages use slogans`, pages.filter(p => p.layout === 'photo-slogan')
        .every(p => p.elements.filter(e => e.type === 'text').every(e => e.content.startsWith('slogan'))));
}

console.log('[poem lines never overlap]');
// A tall line must push the next one down, not run into it (boxes compared unrotated, 2px slack for tilt)
for (const seed of SEEDS) {
    const overlaps = compose(seed).filter(p => p.layout === 'poem').some(p => {
        const lines = p.elements.filter(e => e.type === 'text').sort((a, b) => a.y - b.y);
        return lines.some((e, i) => i > 0 && e.y < lines[i - 1].y + lines[i - 1].h - 2);
    });
    assert(`seed ${seed}: no poem line starts inside the one above`, !overlaps);
}
{
    const tall = () => 60;   // every line measures 60px: 7 lines cannot all fit in 720px with gaps
    const pages = compose(11, { measure: tall });
    const poems = pages.filter(p => p.layout === 'poem');
    assert('measure is used for text heights', all(pages, e => e.type !== 'text' || e.h === 60));
    assert('tall poem lines stack without overlap and stay on the page', poems.length > 0 && poems.every(p => {
        const lines = p.elements.filter(e => e.type === 'text').sort((a, b) => a.y - b.y);
        return lines.every((e, i) => (i === 0 || e.y >= lines[i - 1].y + lines[i - 1].h - 2) && e.y + e.h <= 768.5);
    }));
}

console.log('[collage items never overlap]');
// Text over text is unreadable; cut-outs over text nearly so. Items stack by tilted outline (2px slack).
{
    const span = e => { const half = R.rotatedSize(e.w, e.h, e.rotation).h / 2, cy = e.y + e.h / 2; return [cy - half, cy + half]; };
    let collages = 0;
    for (const seed of [...SEEDS, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
        const bad = compose(seed).filter(p => p.layout === 'collage').filter(p => {
            collages++;
            const items = p.elements.filter(e => e.type === 'text' || e.type === 'image').map(span).sort((a, b) => a[0] - b[0]);
            return items.some((s, i) => i > 0 && s[0] < items[i - 1][1] - 2);
        });
        assert(`seed ${seed}: no collage item overlaps the one above`, bad.length === 0);
    }
    assert('enough collage pages were checked', collages > 30);
    const tall = compose(11, { measure: () => 90 });
    assert('tall collage lines still stay on the page', tall.filter(p => p.layout === 'collage')
        .every(p => p.elements.every(e => BLEED.includes(e.type) || e.y + e.h <= 768.5)));
}

console.log('[layout set and odds]');
const MANY = Array.from({ length: 40 }, (_, i) => i + 100);
{
    const expected = ['big-image', 'poem', 'collage', 'photo-slogan', 'ransom', 'big-type', 'repetition', 'two-columns', 'snapshot-pile', 'photo-grid', 'wallpaper'];
    assert('11 inside layouts', expected.every(l => R.RANDOM_LAYOUTS.includes(l)) && R.RANDOM_LAYOUTS.length === 11);
    const counts = {};
    MANY.forEach(seed => compose(seed).slice(2).forEach(p => { counts[p.layout] = (counts[p.layout] || 0) + 1; }));
    assert('every layout shows up across seeds', expected.every(l => counts[l] > 0));
    const others = expected.filter(l => l !== 'snapshot-pile' && l !== 'photo-grid');
    const mean = others.reduce((sum, l) => sum + counts[l], 0) / others.length;
    assert(`snapshot pile and photo grid are rarer (${counts['snapshot-pile']}, ${counts['photo-grid']} vs mean ${mean.toFixed(0)})`,
        counts['snapshot-pile'] < mean * 0.75 && counts['photo-grid'] < mean * 0.75);
}

console.log('[text never overlaps text]');
{
    const box = e => { const b = R.rotatedSize(e.w, e.h, e.rotation), cx = e.x + e.w / 2, cy = e.y + e.h / 2; return [cx - b.w / 2, cy - b.h / 2, cx + b.w / 2, cy + b.h / 2]; };
    const hit = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 2 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 2;
    const bad = [];
    MANY.forEach(seed => compose(seed).forEach(p => {
        const texts = p.elements.filter(e => e.type === 'text').map(box);
        if (texts.some((a, i) => texts.some((b, j) => j > i && hit(a, b)))) bad.push(`${seed}:${p.layout}`);
    }));
    assert('no two text boxes touch on any page (' + bad.slice(0, 4).join(', ') + ')', bad.length === 0);
}

const pagesOf = (layout, extra) => MANY.flatMap(seed => compose(seed, extra)).filter(p => p.layout === layout);
const texts = p => p.elements.filter(e => e.type === 'text');
const images = p => p.elements.filter(e => e.type === 'image');
const byY = list => list.slice().sort((a, b) => a.y - b.y);

console.log('[long words keep their measured height]');
// Shrinking a text box to fit the margins narrows it, so the text re-wraps taller than measured
{
    const longLine = symbol => symbol === 'slogan' ? 'authenticity gentrification' : 'neighborhood revitalization committee';
    const pages = MANY.slice(0, 15).flatMap(seed => compose(seed, { line: longLine, measure: () => 90 }));
    const shrunk = pages.flatMap(p => p.elements.filter(e => e.type === 'text' && e.h !== 90).map(e => `${p.layout}:${e.content}`));
    assert('no text box is shrunk below its measured height (' + shrunk.slice(0, 3).join(', ') + ')', shrunk.length === 0);
}

console.log('[ransom note]');
{
    const pages = pagesOf('ransom');
    assert('ransom words: decorative fonts, 36-72px', pages.every(p => texts(p).every(e => fonts.display.includes(e.font) && e.fontSize >= 36 && e.fontSize <= 72)));
    assert('ransom words: one word each, in reading order top to bottom, from one slogan', pages.every(p => {
        const words = texts(p).map(e => e.content);
        return words.every(w => !/\s/.test(w)) && byY(texts(p)).map(e => e.content).join(' ') === words.join(' ') && /^slogan line \d+$/.test(words.join(' '));
    }));
    assert('ransom patches sit right under their word', pages.every(p => p.elements.every((e, i) => e.type !== 'background' ||
        (p.elements[i + 1] && p.elements[i + 1].type === 'text' && p.elements[i + 1].x === e.x && p.elements[i + 1].y === e.y))));
    assert('some words get patches, some do not', pages.some(p => p.elements.some(e => e.type === 'background')) &&
        pages.some(p => texts(p).length > p.elements.filter(e => e.type === 'background').length));
}

console.log('[big type]');
{
    const pages = pagesOf('big-type');
    assert('big type: slogan words one per line in one decorative font, then a small line', pages.every(p => {
        const big = texts(p).filter(e => e.fontSize >= 36), small = texts(p).filter(e => e.fontSize < 36);
        return big.length >= 1 && new Set(big.map(e => e.font)).size === 1 && big.every(e => !/\s/.test(e.content)) &&
            big.map(e => e.content).join(' ').startsWith('slogan') && small.length <= 1 &&
            small.every(e => e.y > Math.max(...big.map(b => b.y)));
    }));
    assert('big type words get bigger than slogans elsewhere', pages.some(p => texts(p).some(e => e.fontSize > 72)));
}

console.log('[repetition]');
{
    const pages = pagesOf('repetition');
    assert('repetition: one line repeated, readable fonts, more than one font', pages.every(p => {
        const t = texts(p);
        return t.length >= 1 && t.length <= 10 && new Set(t.map(e => e.content)).size === 1 && t.every(e => e.fontSize < 36);
    }) && pages.some(p => new Set(texts(p).map(e => e.font)).size > 1));
    const short = pagesOf('repetition', { measure: () => 30 });
    assert('repetition: 6-10 copies when lines are short', short.length > 0 && short.every(p => texts(p).length >= 6 && texts(p).length <= 10));
}

console.log('[two columns]');
{
    const pages = pagesOf('two-columns');
    assert('two columns: one picture, every line inside one of two columns', pages.every(p => {
        const xs = new Set(texts(p).map(e => Math.round(e.x)));
        return images(p).length === 1 && xs.size <= 2 && texts(p).every(e => e.rotation === 0 && e.w < 220);
    }));
    assert('two columns: text never covers the picture', pages.every(p => {
        const pic = images(p)[0];
        return texts(p).every(e => e.x + e.w <= pic.x || e.x >= pic.x + pic.w || e.y + e.h <= pic.y || e.y >= pic.y + pic.h);
    }));
    assert('two columns: both columns hold text', pages.every(p => new Set(texts(p).map(e => Math.round(e.x))).size === 2));
}

console.log('[snapshot pile]');
{
    const photoSrcs = new Set(photos.map(i => i.src));
    const pages = pagesOf('snapshot-pile');
    assert('snapshot pile: 2-3 of Adam\'s photos tilted up to 12 degrees', pages.length > 0 && pages.every(p =>
        images(p).length >= 2 && images(p).length <= 3 && images(p).every(e => photoSrcs.has(e.src) && Math.abs(e.rotation) <= 12)));
    assert('snapshot pile: photos overlap like a pile', pages.some(p => {
        const [a, b] = byY(images(p));
        return b.y < a.y + a.h;
    }));
    assert('snapshot pile: caption below the pile', pages.every(p => texts(p).length <= 1 &&
        texts(p).every(t => t.y >= Math.max(...images(p).map(e => e.y + e.h / 2 + R.rotatedSize(e.w, e.h, e.rotation).h / 2)))));
}

console.log('[photo grid]');
{
    const photoSrcs = new Set(photos.map(i => i.src));
    const pages = pagesOf('photo-grid');
    assert('photo grid: 4 untilted photos in a 2x2 grid', pages.length > 0 && pages.every(p => images(p).length === 4 &&
        images(p).every(e => photoSrcs.has(e.src) && e.rotation === 0) &&
        new Set(images(p).map(e => Math.round(e.x))).size === 2 && new Set(images(p).map(e => Math.round(e.y))).size === 2));
    assert('photo grid: each caption small and right under a photo', pages.every(p => texts(p).length <= 4 && texts(p).every(t =>
        t.fontSize <= 13 && images(p).some(e => Math.round(e.x) === Math.round(t.x) && t.y >= e.y + e.h && t.y <= e.y + e.h + 12))));
}

console.log('[clip-art wallpaper]');
{
    const clipSrcs = new Set(clipart.map(i => i.src));
    const pages = pagesOf('wallpaper');
    assert('wallpaper: one clip-art piece repeated 6-12 times', pages.every(p => images(p).length >= 6 && images(p).length <= 12 &&
        new Set(images(p).map(e => e.src)).size === 1 && clipSrcs.has(images(p)[0].src)));
    assert('wallpaper: one line on a paper strip, over the pattern', pages.every(p => {
        const strip = p.elements.findIndex(e => e.type === 'background'), line = p.elements.findIndex(e => e.type === 'text');
        return texts(p).length === 1 && strip > -1 && line === strip + 1 && strip > p.elements.findIndex(e => e.type === 'image');
    }));
}

console.log('[variants]');
{
    const big = pagesOf('big-image');
    const top = big.filter(p => p.variant === 'caption-top'), bottom = big.filter(p => p.variant === 'caption-bottom');
    assert('big image: caption-top and caption-bottom both show up', top.length > 0 && bottom.length > 0);
    assert('big image: caption-top puts the caption above the photo', top.every(p => !texts(p).length || !images(p).length || texts(p)[0].y < images(p)[0].y));
    assert('big image: caption-bottom puts it below', bottom.every(p => !texts(p).length || !images(p).length || texts(p)[0].y > images(p)[0].y));
    ['poem', 'collage'].forEach(layout => {
        const pages = pagesOf(layout);
        assert(`${layout}: left, center and right alignments show up`, ['left', 'center', 'right'].every(a => pages.some(p => p.variant === a)));
        assert(`${layout}: every line follows the page's alignment`, pages.every(p => texts(p).every(e => e.align === p.variant)));
    });
    const fronts = MANY.map(seed => compose(seed)[0]);
    assert('front cover: title-top and title-bottom both show up', ['title-top', 'title-bottom'].every(v => fronts.some(p => p.variant === v)));
    assert('front cover: title-bottom puts the title under the image', fronts.filter(p => p.variant === 'title-bottom')
        .every(p => !images(p).length || texts(p)[0].y > images(p)[0].y));
}

console.log('[grit]');
{
    const pages = SEEDS.flatMap(seed => compose(seed));
    const gritty = pages.filter(p => p.elements.some(e => e.type === 'texture'));
    assert('some pages get grit, most do not', gritty.length > 0 && gritty.length < pages.length / 2);
    assert('without an overlay list, grit is a top-layer overlay from the grit pair', gritty.every(p => {
        const last = p.elements[p.elements.length - 1];
        return last.type === 'texture' && R.RANDOM_GRIT.some(g => g.src === last.src) && last.opacity === 0.3 && last.blendMode === 'multiply';
    }));
    const overlays = [
        { src: 'overlays/a.png', alt: 'a', blendMode: 'normal', opacity: 0.2 },
        { src: 'overlays/b.png', alt: 'b', blendMode: 'multiply', opacity: 0.4 }
    ];
    const listed = SEEDS.flatMap(seed => compose(seed, { overlays })).filter(p => p.elements.some(e => e.type === 'texture'));
    assert('with data/overlays.json\'s list, each overlay comes with its own blend mode and opacity', listed.length > 0 && listed.every(p => {
        const last = p.elements[p.elements.length - 1];
        const o = overlays.find(o => o.src === last.src);
        return o && last.blendMode === o.blendMode && last.opacity === o.opacity && last.alt === o.alt;
    }));
    assert('and draws on the whole list', overlays.every(o => listed.some(p => p.elements.some(e => e.src === o.src))));
}

console.log('[missing data]');
{
    const noImages = compose(5, { clipart: [], photos: [] });
    assert('no clip art or photos: still 27 pages, no image elements', noImages.length === 27 &&
        all(noImages, e => e.type !== 'image' && e.type !== 'background-image'));
    const noText = compose(5, { line: () => '' });
    assert('empty grammar: no empty text elements', all(noText, e => e.type !== 'text' || e.content.length > 0));
    assert('empty grammar: title still there', noText[0].elements.some(e => e.content === R.RANDOM_TITLE));
    assert('empty grammar: no paper strip without a slogan', all(noText, e => e.type !== 'background'));
}

console.log('[repeatable]');
assert('same seed gives the same zine', JSON.stringify(compose(9)) === JSON.stringify(compose(9)));
assert('different seeds give different zines', JSON.stringify(compose(9)) !== JSON.stringify(compose(10)));

console.log('[line types are dealt like cards]');
{
    const deck = ['#elegy#', '#elegy#', '#flyer#', '#notice#', '#listing#'];
    for (const seed of SEEDS) {
        const calls = [];
        compose(seed, { lineTypes: deck, line: symbol => { calls.push(symbol); return `${symbol} line ${calls.length}`; } });
        const dealt = calls.filter(s => s !== 'slogan');
        assert(`seed ${seed}: every origin line comes from the deck`, dealt.length > 20 && dealt.every(s => ['elegy', 'flyer', 'notice', 'listing'].includes(s)));
        assert(`seed ${seed}: never the same line type twice in a row`, dealt.every((s, i) => i === 0 || s !== dealt[i - 1]));
        const blocks = [];
        for (let i = 0; i + deck.length <= dealt.length; i += deck.length) blocks.push(dealt.slice(i, i + deck.length).sort().join());
        const whole = deck.map(t => t.slice(1, -1)).sort().join();
        assert(`seed ${seed}: the whole deck (weights kept) is dealt before any card comes round again`, blocks.every(b => b === whole));
    }
}

console.log('[no sentence twice in a zine]');
{
    for (const seed of SEEDS) {
        const r = seeded(seed * 7);
        // 400 possible sentences per symbol, picked at random, so repeats would happen without the check
        const pages = compose(seed, { line: symbol => `${symbol} ${Math.floor(r() * 400)}` });
        const said = pages.filter(p => p.layout !== 'repetition').flatMap(p => texts(p)
            .filter(e => !(p.layout === 'ransom' || (p.layout === 'big-type' && e.fontSize >= 36)))
            .map(e => e.content)).filter(t => t !== R.RANDOM_TITLE);
        assert(`seed ${seed}: no sentence appears on two pages (${said.length} lines)`, new Set(said).size === said.length);
    }
}

console.log('[pictures on the text pages]');
{
    const box = e => { const b = R.rotatedSize(e.w, e.h, e.rotation), cx = e.x + e.w / 2, cy = e.y + e.h / 2; return [cx - b.w / 2, cy - b.h / 2, cx + b.w / 2, cy + b.h / 2]; };
    const hit = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 2 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 2;
    const clear = p => images(p).every(img => texts(p).every(t => !hit(box(img), box(t))));
    for (const layout of ['poem', 'repetition']) {
        const pages = pagesOf(layout);
        assert(`${layout}: one picture on every page`, pages.length > 0 && pages.every(p => images(p).length === 1));
        assert(`${layout}: the picture never covers a line`, pages.every(clear));
        assert(`${layout}: the picture sits above the text on some pages, below it on others`,
            pages.some(p => images(p)[0].y < texts(p)[0].y) && pages.some(p => images(p)[0].y > texts(p)[0].y));
    }
    for (const layout of ['ransom', 'big-type']) {
        const pages = pagesOf(layout);
        assert(`${layout}: a picture under the slogan when there is room, never over the words`,
            pages.some(p => images(p).length === 1) && pages.every(p => images(p).length <= 1 && clear(p)));
    }
    const accents = ['poem', 'repetition', 'ransom', 'big-type'].flatMap(l => pagesOf(l)).flatMap(p => images(p).map(e => e.src));
    const photoSrcs = new Set(photos.map(p => p.src));
    assert('accents mix Adam\'s photos and clip art', accents.some(s => photoSrcs.has(s)) && accents.some(s => !photoSrcs.has(s)));
    // Before the accents a zine showed 19-24 different pictures (of 83)
    const counts = MANY.map(seed => new Set(srcs(compose(seed))).size);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    assert(`every zine shows at least 25 different pictures (fewest ${Math.min(...counts)})`, Math.min(...counts) >= 25);
    assert(`zines average at least 30 different pictures (${mean.toFixed(1)})`, mean >= 30);
}

console.log('[randomFontLists]');
{
    const sources = [
        { family: 'Inter-Regular', category: 'Core' },
        { family: 'Work-Sans', category: 'Sans Serif' },
        { family: 'Libre-Baskerville', category: 'Serif' },
        { family: 'Anthony', category: 'Display' },
        { family: 'Mess', category: 'Experimental' },
        { family: 'Facade-Est', category: 'Special' }
    ];
    const available = { 'Liberation Mono': 'Liberation Mono', 'Inter-Regular': 'x', 'Libre-Baskerville': 'x', 'Anthony': 'x', 'Facade-Est': 'x' };
    const lists = R.randomFontLists(sources, available);
    assert('readable: Liberation Mono + loaded Core/Sans/Serif', lists.readable.join() === 'Liberation Mono,Inter-Regular,Libre-Baskerville');
    assert('display: loaded Display/Experimental/Special', lists.display.join() === 'Anthony,Facade-Est');
    const none = R.randomFontLists(sources, { 'Liberation Mono': 'Liberation Mono' });
    assert('no display fonts loaded: falls back to readable', none.display.join() === 'Liberation Mono');
}

console.log('[poster piles]');
{
    const POSTERS = [{ w: 816, h: 1056, margin: 48 }, { w: 816, h: 1344, margin: 48 }];
    const pile = (kind, seed, page, extra) => {
        let id = 0, n = 0;
        return R.composePile(Object.assign({
            kind, page, line: symbol => `${symbol} line ${++n}`, clipart, photos, fonts,
            rng: seeded(seed), newId: () => ++id
        }, extra || {}));
    };
    const inside = (e, page) => {
        const box = R.rotatedSize(e.w, e.h, e.rotation);
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        return cx - box.w / 2 >= page.margin - 0.5 && cx + box.w / 2 <= page.w - page.margin + 0.5 &&
            cy - box.h / 2 >= page.margin - 0.5 && cy + box.h / 2 <= page.h - page.margin + 0.5;
    };
    const inMiddle = (e, page) => {
        const cx = (e.x + e.w / 2) / page.w, cy = (e.y + e.h / 2) / page.h;
        return cx >= 0.3 - 0.01 && cx <= 0.7 + 0.01 && cy >= 0.3 - 0.01 && cy <= 0.7 + 0.01;
    };
    const flyerSrcs = new Set(gallery.map(g => g.src));
    const photoSrcs = new Set(photos.map(p => p.src)), clipSrcs = new Set(clipart.map(c => c.src));

    for (const page of POSTERS) for (const kind of ['protest', 'show-flyer']) for (const seed of SEEDS) {
        const els = pile(kind, seed, page);
        const tag = `${kind} ${page.w}x${page.h} seed ${seed}`;
        assert(`${tag}: inside the 48px margins (so above the credit strip)`, els.every(e => inside(e, page)));
        assert(`${tag}: centres in the middle 40%`, els.every(e => inMiddle(e, page)));
        assert(`${tag}: no flyers`, els.every(e => !flyerSrcs.has(e.src)));
        const firstText = els.findIndex(e => e.type === 'text');
        assert(`${tag}: pictures under text`, firstText === -1 || els.slice(firstText).every(e => e.type === 'text'));
        assert(`${tag}: tilt within 15°`, els.every(e => Math.abs(e.rotation) <= 15));
        assert(`${tag}: ids unique`, new Set(els.map(e => e.id)).size === els.length);
    }

    for (const seed of SEEDS) {
        const count = (els, symbol) => els.filter(e => e.type === 'text' && e.content.startsWith(symbol + ' ')).length;
        const p = pile('protest', seed, POSTERS[0]);
        const ph = p.filter(e => photoSrcs.has(e.src)).length, pc = p.filter(e => clipSrcs.has(e.src)).length;
        assert(`protest seed ${seed}: 1 slogan, 2-3 origin lines`, count(p, 'slogan') === 1 && count(p, 'origin') >= 2 && count(p, 'origin') <= 3);
        assert(`protest seed ${seed}: 1-2 photos, 2-3 clip art`, ph >= 1 && ph <= 2 && pc >= 2 && pc <= 3);
        const f = pile('show-flyer', seed, POSTERS[0]);
        const fc = f.filter(e => clipSrcs.has(e.src)).length;
        assert(`show flyer seed ${seed}: 2-4 band names, 1 venue, 1-2 details`,
            count(f, 'band_name') >= 2 && count(f, 'band_name') <= 4 && count(f, 'venue') === 1 && count(f, 'show_detail') >= 1 && count(f, 'show_detail') <= 2);
        assert(`show flyer seed ${seed}: no photos, 2-3 clip art`, f.every(e => !photoSrcs.has(e.src)) && fc >= 2 && fc <= 3);
    }

    const fallback = pile('show-flyer', 3, POSTERS[0], { line: s => (s === 'band_name' ? '' : `${s} line`) });
    assert('band_name missing: band words stand in', fallback.some(e => e.content === 'band line') && !fallback.some(e => e.content === 'band_name line'));
    const noDetail = pile('show-flyer', 3, POSTERS[0], { line: s => (s === 'show_detail' ? '' : `${s} line`) });
    assert('a missing symbol is left out, no empty text', noDetail.every(e => e.type !== 'text' || e.content.length > 0) && !noDetail.some(e => e.content === ''));
    let threw = false, nothing = null;
    try { nothing = pile('show-flyer', 3, POSTERS[0], { line: () => '', clipart: [], photos: [] }); } catch (err) { threw = true; }
    assert('no grammar, no pictures: empty pile, no error', !threw && Array.isArray(nothing) && nothing.length === 0);
    const textOnly = pile('protest', 3, POSTERS[1], { clipart: [], photos: [] });
    assert('no pictures: text only', textOnly.length > 0 && textOnly.every(e => e.type === 'text'));
    assert('unknown kind: empty', pile('mystery', 1, POSTERS[0]).length === 0);
    assert('same seed, same pile', JSON.stringify(pile('protest', 9, POSTERS[0])) === JSON.stringify(pile('protest', 9, POSTERS[0])));
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
