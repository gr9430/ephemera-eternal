// randomize.js — "forego all creativity to an algorithm": fills a half-letter booklet with
// random layouts of grammar lines, clip art and Adam Goldman's photos (never flyers).
// composeZine and its helpers are pure (no DOM) and Node-tested in randomize.test.js;
// the Randomize object below wires the toolbar button and the two dialogs.

const RANDOM_PAGE = { w: 528, h: 816, margin: 48 };
const RANDOM_INK = '#1a1a1a';
const RANDOM_PAPER = '#f8f8f0';
const RANDOM_LAYOUTS = ['big-image', 'poem', 'collage', 'photo-slogan', 'ransom', 'big-type', 'repetition',
    'two-columns', 'snapshot-pile', 'photo-grid', 'wallpaper'];
// Relative odds; the photo-hungry layouts are rarer so Adam's 33 photos last longer
const RANDOM_LAYOUT_WEIGHTS = { 'snapshot-pile': 0.5, 'photo-grid': 0.5 };
const RANDOM_ALIGNMENTS = ['left', 'center', 'right'];
const RANDOM_GRIT = ['overlays/grit-1.png', 'overlays/grit-2.png'];
const RANDOM_TITLE = 'Ephemera Eternal';
const READABLE_CATEGORIES = ['Core', 'Sans Serif', 'Serif'];
const DISPLAY_CATEGORIES = ['Display', 'Experimental', 'Special'];

function randomTools(rng) {
    return {
        rng,
        int: (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)),
        float: (lo, hi) => lo + rng() * (hi - lo),
        pick: list => list[Math.floor(rng() * list.length)],
        shuffle: list => {
            const a = list.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }
    };
}

// Hands out items without repeats; reshuffles only once every item has been used
function makePool(items, r) {
    let queue = [];
    return () => {
        if (!items || items.length === 0) return null;
        if (queue.length === 0) queue = r.shuffle(items);
        return queue.pop();
    };
}

// Axis-aligned size of a w × h box rotated by deg
function rotatedSize(w, h, deg) {
    const a = Math.abs(deg || 0) * Math.PI / 180;
    return { w: w * Math.cos(a) + h * Math.sin(a), h: w * Math.sin(a) + h * Math.cos(a) };
}

// Moves (and if it can't fit, shrinks) an element so its rotated box sits inside the page's margins
function keepInside(el, page = RANDOM_PAGE) {
    const { w: pw, h: ph, margin: m } = page;
    let box = rotatedSize(el.w, el.h, el.rotation);
    const scale = Math.min(1, (pw - 2 * m) / box.w, (ph - 2 * m) / box.h);
    if (scale < 1) {
        el.w = Math.floor(el.w * scale);
        el.h = Math.floor(el.h * scale);
        box = rotatedSize(el.w, el.h, el.rotation);
    }
    const cx = Math.min(Math.max(el.x + el.w / 2, m + box.w / 2), pw - m - box.w / 2);
    const cy = Math.min(Math.max(el.y + el.h / 2, m + box.h / 2), ph - m - box.h / 2);
    el.x = cx - el.w / 2;
    el.y = cy - el.h / 2;
    return el;
}

// Generous height estimate for wrapped text (characters average ~0.62em wide)
function textHeight(content, fontSize, w) {
    const perLine = Math.max(1, Math.floor((w - 8) / (fontSize * 0.62)));
    const lines = Math.max(1, Math.ceil(content.length / perLine));
    return Math.ceil(lines * fontSize * 1.2 + 8);
}

// Text box sized by c.measure (the real rendered height in the browser, the estimate in Node).
// A tilt that would push the box past the margins is eased off instead of shrinking the box,
// since a narrower box re-wraps its text taller than measured.
function randomText(c, o) {
    const page = c.page || RANDOM_PAGE;
    const h = c.measure(o.content, o.font, o.fontSize, o.w);
    let rotation = o.rotation || 0;
    const fits = () => { const box = rotatedSize(o.w, h, rotation); return box.w <= page.w - 2 * page.margin && box.h <= page.h - 2 * page.margin; };
    while (!fits() && Math.abs(rotation) > 0.25) rotation /= 2;
    if (!fits()) rotation = 0;
    return keepInside({
        id: c.newId(), type: 'text', x: o.x, y: o.y, w: o.w, h,
        rotation, content: o.content, font: o.font, fontSize: o.fontSize,
        color: RANDOM_INK, bold: false, italic: false, align: o.align || 'left'
    }, page);
}

function randomImage(newId, item, x, y, w, h, rotation, page) {
    return keepInside({ id: newId(), type: 'image', x, y, w, h, rotation, src: item.src, alt: item.alt || '', filter: 'none' }, page);
}

const repeat = (value, n) => Array.from({ length: n }, () => value);

// Places an item at `aim` or lower, below the tilted outline `floor` of the item above.
// make(y) builds the element; returns { el, floor } or null once it no longer fits the page
// (or, given `limit`, once its tilted outline would reach below that line).
function stackBelow(floor, aim, w, h, rotation, make, limit) {
    const overhang = (rotatedSize(w, h, rotation).h - h) / 2;
    const y = Math.max(aim, floor + 6 + overhang);
    const el = make(y);
    if (el.y < y - 0.5) return null;   // keepInside had to lift it into the item above
    if (limit !== undefined && el.y + el.h + overhang > limit + 0.5) return null;
    return { el, floor: el.y + el.h + overhang };
}

// x for a w-wide box under the page's alignment, with a little jitter
function alignedX(c, align, w) {
    const room = 432 - w;
    if (align === 'right') return 48 + room - c.r.float(0, Math.min(60, room));
    if (align === 'center') return 48 + room / 2 + c.r.float(-1, 1) * Math.min(30, room / 2);
    return 48 + c.r.float(0, Math.min(60, room));
}

function pickPicture(c) {
    return c.r.rng() < 0.5 ? (c.nextPhoto() || c.nextClip()) : (c.nextClip() || c.nextPhoto());
}

// A solid paper strip behind a text element, so it reads over pictures
function paperStrip(c, text) {
    return keepInside({ id: c.newId(), type: 'background', x: 48, y: text.y - 12, w: 432, h: text.h + 24, rotation: 0, color: RANDOM_PAPER, opacity: 1 });
}

// Text-only layouts get one picture, above or below the text (photos and clip art take turns).
// The text then keeps to the rest of the page, between c.top and c.bottom.
function reserveAccent(c) {
    const item = c.nextAccent();
    if (!item) return null;
    const h = c.r.int(150, 230), w = Math.min(432, Math.round(h * c.r.float(0.9, 1.4)));
    const rotation = c.r.float(-6, 6);
    const tall = rotatedSize(w, h, rotation).h;
    const x = alignedX(c, c.variant || 'center', w);
    if (c.r.rng() < 0.5) {
        c.top = 48 + tall + 16;
        return randomImage(c.newId, item, x, 48 + (tall - h) / 2, w, h, rotation);
    }
    c.bottom = 768 - tall - 16;
    return randomImage(c.newId, item, x, 768 - tall + (tall - h) / 2, w, h, rotation);
}

// The slogan layouts keep their whole slogan; a picture goes in only if there's room below it
function accentBelow(c, els, floor) {
    const room = 768 - floor - 16;
    if (room < 140) return els;
    const item = c.nextAccent();
    if (!item) return els;
    const rotation = c.r.float(-6, 6);
    let h = Math.min(c.r.int(150, 260), room), w = Math.min(432, Math.round(h * c.r.float(0.9, 1.4)));
    const scale = Math.min(1, room / rotatedSize(w, h, rotation).h);
    h = Math.floor(h * scale);
    w = Math.floor(w * scale);
    const tall = rotatedSize(w, h, rotation).h;
    const top = floor + 16 + c.r.float(0, room - tall);
    return [randomImage(c.newId, item, 48 + c.r.float(0, 432 - w), top + (tall - h) / 2, w, h, rotation), ...els];
}

// Each layout takes the composing context c and returns a page's elements, bottom layer first
const RANDOM_LAYOUT_BUILDERS = {
    // Photo with a caption below it, or (caption-top) above it
    'big-image': c => {
        c.variant = c.r.rng() < 0.5 ? 'caption-top' : 'caption-bottom';
        const els = [];
        const photo = c.nextPhoto();
        const content = c.line('origin');
        const font = c.r.pick(c.fonts.readable), fontSize = c.r.int(14, 18), rotation = c.r.float(-2, 2);
        const caption = y => randomText(c, { x: 54, y, w: 420, content, font, fontSize, rotation });
        if (c.variant === 'caption-top') {
            let floor = 48;
            if (content) {
                const placed = stackBelow(48, 48, 420, c.measure(content, font, fontSize, 420), rotation, caption);
                els.push(placed.el);
                floor = placed.floor;
            }
            if (photo) {
                const y = floor + 16;
                els.push(randomImage(c.newId, photo, 48, y, 432, Math.max(160, 768 - y - 20), c.r.float(-2, 2)));
            }
            return els;
        }
        if (photo) els.push(randomImage(c.newId, photo, 48, 48, 432, 480, c.r.float(-2, 2)));
        if (content) els.push(caption(photo ? 548 : 300));
        return els;
    },

    // Lines aim for evenly spaced bands; a tall line pushes the next one down (by tilted outline),
    // and lines that would no longer fit above the bottom margin are left out. One alignment per page.
    'poem': c => {
        c.variant = c.r.pick(RANDOM_ALIGNMENTS);
        const accent = reserveAccent(c);
        const els = accent ? [accent] : [];
        const n = c.r.int(4, 7);
        const band = (c.bottom - c.top) / n;
        let floor = c.top;
        for (let i = 0; i < n; i++) {
            const content = c.line('origin');
            if (!content) continue;
            const w = c.r.int(260, 400);
            const fontSize = c.r.int(14, 22);
            const rotation = c.r.float(-4, 4);
            const font = c.r.pick(c.fonts.readable);
            const x = alignedX(c, c.variant, w);
            const placed = stackBelow(floor, c.top + i * band + c.r.float(0, band * 0.25), w, c.measure(content, font, fontSize, w), rotation,
                y => randomText(c, { x, y, w, content, font, fontSize, rotation, align: c.variant }), c.bottom);
            if (!placed) break;
            els.push(placed.el);
            floor = placed.floor;
        }
        return els;
    },

    // Cut-outs get double-height bands, lines single. Like the poem, each item aims for its band
    // but stacks below the tilted outline of the one above; items that no longer fit are left out.
    'collage': c => {
        c.variant = c.r.pick(RANDOM_ALIGNMENTS);
        const els = [];
        const kinds = c.r.shuffle([...repeat('clip', c.r.int(2, 3)), ...repeat('line', c.r.int(2, 3))]);
        const unit = (RANDOM_PAGE.h - 2 * RANDOM_PAGE.margin) / kinds.reduce((sum, k) => sum + (k === 'clip' ? 2 : 1), 0);
        let top = RANDOM_PAGE.margin;     // where this item's band starts
        let floor = RANDOM_PAGE.margin;   // lowest point of the tilted item above
        for (const kind of kinds) {
            const height = unit * (kind === 'clip' ? 2 : 1);
            let placed;   // stays undefined when there is nothing to place
            if (kind === 'clip') {
                const piece = c.nextClip();
                if (piece) {
                    const rotation = c.r.float(-15, 15);
                    // Size by tilted outline so the cut-out fits its band
                    const size = Math.max(60, Math.min(c.r.int(120, 260), Math.floor(height / rotatedSize(1, 1, rotation).h)));
                    const x = 48 + c.r.float(0, 432 - size);
                    placed = stackBelow(floor, top + (height - size) / 2, size, size, rotation,
                        y => randomImage(c.newId, piece, x, y, size, size, rotation));
                }
            } else {
                const content = c.line('origin');
                if (content) {
                    const w = c.r.int(200, 360);
                    const fontSize = c.r.int(14, 20);
                    const rotation = c.r.float(-4, 4);
                    const font = c.r.pick(c.fonts.readable);
                    const x = alignedX(c, c.variant, w);
                    placed = stackBelow(floor, top + c.r.float(0, height * 0.2), w, c.measure(content, font, fontSize, w), rotation,
                        y => randomText(c, { x, y, w, content, font, fontSize, rotation, align: c.variant }));
                }
            }
            top += height;
            if (placed === undefined) continue;   // no piece or no line to place
            if (placed === null) break;           // no longer fits the page
            els.push(placed.el);
            floor = placed.floor;
        }
        return els;
    },

    // Full-page photo; the slogan sits on a solid paper strip so it stays readable
    'photo-slogan': c => {
        const els = [];
        const photo = c.nextPhoto();
        if (photo) {
            els.push({ id: c.newId(), type: 'background-image', x: 0, y: 0, w: 528, h: 816, rotation: 0, src: photo.src, alt: photo.alt || '', opacity: 1, blendMode: 'normal' });
        }
        const slogan = c.line('slogan');
        if (slogan) {
            const text = randomText(c, {
                x: 64, y: c.r.float(200, 560), w: 400, content: slogan,
                font: c.r.pick(c.fonts.display), fontSize: c.r.int(36, 56), align: 'center'
            });
            els.push(paperStrip(c, text));
            els.push(text);
        }
        return els;
    },

    // A slogan cut up word by word, each word in its own decorative font, size and tilt,
    // some on paper patches, in reading order down the page
    'ransom': c => {
        const els = [];
        let floor = RANDOM_PAGE.margin;
        for (const word of c.line('slogan').split(/\s+/).filter(Boolean)) {
            // Long words get a smaller size (never under 36px) so they don't break mid-word
            const fontSize = Math.max(36, Math.min(c.r.int(36, 72), Math.floor(408 / (word.length * 0.9))));
            const font = c.r.pick(c.fonts.display);
            const rotation = c.r.float(-12, 12);
            const w = Math.min(432, Math.ceil(word.length * fontSize * 0.9) + 24);
            const x = 48 + c.r.float(0, 432 - w);
            const placed = stackBelow(floor, floor + c.r.float(0, 30), w, c.measure(word, font, fontSize, w), rotation,
                y => randomText(c, { x, y, w, content: word, font, fontSize, rotation, align: 'center' }));
            if (!placed) break;
            if (c.r.rng() < 0.5) {
                const t = placed.el;
                els.push({ id: c.newId(), type: 'background', x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation, color: RANDOM_PAPER, opacity: 1 });
            }
            els.push(placed.el);
            floor = placed.floor;
        }
        return els.length ? accentBelow(c, els, floor) : els;
    },

    // A slogan blown up like a protest sign: one word per line in one huge font, then a small line
    'big-type': c => {
        const els = [];
        const words = c.line('slogan').split(/\s+/).filter(Boolean);
        const font = c.r.pick(c.fonts.display);
        const longest = Math.max(1, ...words.map(word => word.length));
        const fontSize = Math.max(36, Math.min(140, Math.floor(424 / (longest * 0.85))));
        let floor = RANDOM_PAGE.margin;
        for (const word of words) {
            const placed = stackBelow(floor, floor, 432, c.measure(word, font, fontSize, 432), 0,
                y => randomText(c, { x: 48, y, w: 432, content: word, font, fontSize }));
            if (!placed) break;
            els.push(placed.el);
            floor = placed.floor;
        }
        const content = c.line('origin');
        if (content) {
            const small = c.r.pick(c.fonts.readable), size = c.r.int(14, 18);
            const placed = stackBelow(floor + 10, floor + 10, 432, c.measure(content, small, size, 432), 0,
                y => randomText(c, { x: 48, y, w: 432, content, font: small, fontSize: size }));
            if (placed) {
                els.push(placed.el);
                floor = placed.floor;
            }
        }
        return els.length ? accentBelow(c, els, floor) : els;
    },

    // One line repeated down the page like a chant, each copy in its own readable font and indent
    'repetition': c => {
        const els = [];
        const content = c.line('origin');
        if (!content) return els;
        const accent = reserveAccent(c);
        if (accent) els.push(accent);
        const n = c.r.int(6, 10);
        let floor = c.top;
        for (let i = 0; i < n; i++) {
            const font = c.r.pick(c.fonts.readable), fontSize = c.r.int(14, 20), rotation = c.r.float(-3, 3);
            const w = c.r.int(300, 420);
            const x = 48 + c.r.float(0, 432 - w);
            const placed = stackBelow(floor, floor, w, c.measure(content, font, fontSize, w), rotation,
                y => randomText(c, { x, y, w, content, font, fontSize, rotation }), c.bottom);
            if (!placed) break;
            els.push(placed.el);
            floor = placed.floor;
        }
        return els;
    },

    // Newsprint: two narrow columns of lines, a picture set into one of them; text flows around it
    'two-columns': c => {
        const els = [];
        const gap = 24, colW = (432 - gap) / 2;
        const columns = [48, 48 + colW + gap];
        const picColumn = c.r.int(0, 1);
        const item = pickPicture(c);
        let pic = null;
        if (item) {
            const h = c.r.int(160, 280);
            pic = randomImage(c.newId, item, columns[picColumn], 48 + c.r.float(0, 720 - h), colW, h, 0);
            els.push(pic);
        }
        columns.forEach((x, column) => {
            let y = RANDOM_PAGE.margin;
            for (let guard = 0; guard < 16; guard++) {
                const content = c.line('origin');
                if (!content) break;
                const font = c.r.pick(c.fonts.readable), fontSize = c.r.int(12, 16);
                const h = c.measure(content, font, fontSize, colW);
                if (pic && column === picColumn && y < pic.y + pic.h + 8 && y + h > pic.y - 8) y = pic.y + pic.h + 12;
                if (y + h > 768) break;
                els.push(randomText(c, { x, y, w: colW, content, font, fontSize }));
                y += h + 8;
            }
        });
        return els;
    },

    // 2-3 of Adam's photos dropped in a loose, overlapping pile, a caption below
    'snapshot-pile': c => {
        const els = [];
        const n = c.r.int(2, 3);
        let lowest = RANDOM_PAGE.margin;
        for (let i = 0; i < n; i++) {
            const photo = c.nextPhoto();
            if (!photo) break;
            const w = c.r.int(200, 280), h = Math.round(w * c.r.float(0.75, 1.1)), rotation = c.r.float(-12, 12);
            const img = randomImage(c.newId, photo, 48 + c.r.float(0, 432 - w), 60 + i * 120 + c.r.float(0, 40), w, h, rotation);
            els.push(img);
            lowest = Math.max(lowest, img.y + img.h / 2 + rotatedSize(img.w, img.h, img.rotation).h / 2);
        }
        const content = c.line('origin');
        if (content && els.length) {
            const font = c.r.pick(c.fonts.readable), fontSize = c.r.int(14, 18), rotation = c.r.float(-2, 2);
            const placed = stackBelow(lowest, lowest, 400, c.measure(content, font, fontSize, 400), rotation,
                y => randomText(c, { x: 64, y, w: 400, content, font, fontSize, rotation }));
            if (placed) els.push(placed.el);
        }
        return els;
    },

    // Contact sheet: four photos in a tidy 2x2 grid, each with a tiny caption
    'photo-grid': c => {
        const els = [];
        const gap = 24, cellW = (432 - gap) / 2, rowH = (720 - gap) / 2;
        for (let i = 0; i < 4; i++) {
            const photo = c.nextPhoto();
            if (!photo) break;
            const x = 48 + (i % 2) * (cellW + gap), top = 48 + Math.floor(i / 2) * (rowH + gap);
            const content = c.line('origin');
            const font = c.r.pick(c.fonts.readable), fontSize = c.r.int(11, 13);
            const capH = content ? c.measure(content, font, fontSize, cellW) : 0;
            const imgH = rowH - capH - 8 >= 120 ? rowH - capH - 8 : rowH;
            els.push(randomImage(c.newId, photo, x, top, cellW, imgH, 0));
            if (content && imgH < rowH) els.push(randomText(c, { x, y: top + imgH + 8, w: cellW, content, font, fontSize }));
        }
        return els;
    },

    // One clip-art piece repeated in a loose staggered pattern, one line on a paper strip over it
    'wallpaper': c => {
        const els = [];
        const piece = c.nextClip();
        if (piece) {
            const n = c.r.int(6, 12);
            const cols = n <= 8 ? 2 : 3, rows = Math.ceil(n / cols);
            const cellW = 432 / cols, cellH = 720 / rows;
            const size = Math.floor(Math.min(cellW, cellH) * 0.75);
            for (let i = 0; i < n; i++) {
                const col = i % cols, row = Math.floor(i / cols);
                const stagger = (row % 2 ? 1 : -1) * cellW * 0.12;
                els.push(randomImage(c.newId, piece, 48 + col * cellW + (cellW - size) / 2 + stagger,
                    48 + row * cellH + (cellH - size) / 2, size, size, c.r.float(-10, 10)));
            }
        }
        const content = c.line('origin');
        if (content) {
            const text = randomText(c, {
                x: 64, y: c.r.float(200, 560), w: 400, content,
                font: c.r.pick(c.fonts.readable), fontSize: c.r.int(16, 22), align: 'center'
            });
            els.push(paperStrip(c, text));
            els.push(text);
        }
        return els;
    }
};

// "Ephemera Eternal" and a random subtitle above one picture (title-top), or below it (title-bottom)
function composeFrontCover(c) {
    c.variant = c.r.rng() < 0.5 ? 'title-top' : 'title-bottom';
    const titleFont = c.r.pick(c.fonts.display), titleSize = c.r.int(44, 64), tilt = c.r.float(-3, 3);
    const subtitle = c.line(c.r.rng() < 0.5 ? 'slogan' : 'origin');
    const subFont = c.r.pick(c.fonts.readable), subSize = c.r.int(18, 24);
    const item = pickPicture(c);
    const title = y => randomText(c, { x: 59, y, w: 410, content: RANDOM_TITLE, font: titleFont, fontSize: titleSize, rotation: tilt, align: 'center' });
    const sub = y => randomText(c, { x: 48, y, w: 432, content: subtitle, font: subFont, fontSize: subSize, align: 'center' });
    const picture = (y, h) => randomImage(c.newId, item, 48, y, 432, h, c.r.float(-3, 3));
    const titleH = c.measure(RANDOM_TITLE, titleFont, titleSize, 410);
    const subH = subtitle ? c.measure(subtitle, subFont, subSize, 432) : 0;
    const overhang = (rotatedSize(410, titleH, tilt).h - titleH) / 2;

    if (c.variant === 'title-top') {
        const els = [title(60)];
        let bottom = els[0].y + els[0].h + overhang;
        if (subtitle) {
            els.push(sub(bottom + 16));
            bottom = els[1].y + els[1].h;
        }
        if (item) els.push(picture(bottom + 24, Math.max(120, 768 - bottom - 24 - 20)));
        return els;
    }
    // title-bottom: words stacked up from the bottom margin, the picture fills the space above
    const subY = 768 - subH;
    const titleY = (subtitle ? subY - 16 : 768) - titleH - overhang;
    const els = [title(titleY)];
    if (subtitle) els.push(sub(subY));
    if (item) els.push(picture(48, Math.max(120, titleY - overhang - 24 - 48 - 20)));
    return els;
}

// About one page in four gets a grit overlay on top
function maybeGrit(c, els) {
    if (c.r.rng() < 0.25) {
        els.push({ id: c.newId(), type: 'texture', x: 0, y: 0, w: 528, h: 816, rotation: 0, src: c.r.pick(RANDOM_GRIT), alt: 'grit overlay', blendMode: 'multiply', opacity: 0.3 });
    }
    return els;
}

function weightedPick(r, names) {
    const weight = name => RANDOM_LAYOUT_WEIGHTS[name] || 1;
    let t = r.rng() * names.reduce((sum, name) => sum + weight(name), 0);
    for (const name of names) {
        t -= weight(name);
        if (t < 0) return name;
    }
    return names[names.length - 1];
}

// Runs one layout builder; a builder that picks a variant (alignment, caption side...) sets c.variant
function composePage(c, page, build) {
    c.variant = null;
    c.top = RANDOM_PAGE.margin;                     // the text's share of the page; reserveAccent
    c.bottom = RANDOM_PAGE.h - RANDOM_PAGE.margin;  // narrows it to make room for a picture
    const elements = maybeGrit(c, build(c));
    return Object.assign(page, c.variant ? { variant: c.variant } : {}, { elements });
}

// Poster Randomize: raw material dropped around the middle of the sheet for the participant to
// arrange. Each text entry: [grammar symbol, fewest, most, font list, [smallest, largest size]]
const PILE_RECIPES = {
    'protest': {
        texts: [['slogan', 1, 1, 'display', [40, 56]], ['origin', 2, 3, 'readable', [16, 22]]],
        photos: [1, 2], clips: [2, 3]
    },
    'show-flyer': {
        texts: [['band_name', 2, 4, 'display', [28, 44]], ['venue', 1, 1, 'display', [24, 36]], ['show_detail', 1, 2, 'readable', [16, 22]]],
        photos: [0, 0], clips: [2, 3]
    }
};
const PILE_SPREAD = 0.2;   // centres land within ±20% of the sheet from its middle
const PILE_TILT = 15;      // degrees either way

function composePile({ kind, page, line, clipart, photos, fonts, rng, newId, measure }) {
    const recipe = PILE_RECIPES[kind];
    if (!recipe) return [];
    const r = randomTools(rng);
    const c = { r, newId, page, measure: measure || ((content, font, fontSize, w) => textHeight(content, fontSize, w)) };
    const nextPhoto = makePool(photos, r), nextClip = makePool(clipart, r);
    // Top-left corner that puts a w × h box's centre at a random spot in the middle of the sheet
    const spot = (w, h) => ({
        x: page.w / 2 + r.float(-PILE_SPREAD, PILE_SPREAD) * page.w - w / 2,
        y: page.h / 2 + r.float(-PILE_SPREAD, PILE_SPREAD) * page.h - h / 2
    });
    const tilt = () => r.float(-PILE_TILT, PILE_TILT);
    const pictures = [], texts = [];

    const addPicture = item => {
        if (!item) return;
        const w = r.int(200, 320), h = Math.round(w * r.float(0.75, 1.33));
        const at = spot(w, h);
        pictures.push(randomImage(newId, item, at.x, at.y, w, h, tilt(), page));
    };
    for (let i = r.int(...recipe.photos); i > 0; i--) addPicture(nextPhoto());
    for (let i = r.int(...recipe.clips); i > 0; i--) addPicture(nextClip());

    // band_name belongs to the grammar project; until it exists, single band words stand in
    const say = symbol => line(symbol) || (symbol === 'band_name' ? line('band') : '') || '';
    for (const [symbol, fewest, most, list, [small, large]] of recipe.texts) {
        for (let i = r.int(fewest, most); i > 0; i--) {
            const content = say(symbol);
            if (!content) continue;
            const w = r.int(260, 340);
            const font = r.pick(fonts[list]), fontSize = r.int(small, large);
            const at = spot(w, c.measure(content, font, fontSize, w));
            texts.push(randomText(c, { x: at.x, y: at.y, w, content, font, fontSize, rotation: tilt(), align: 'center' }));
        }
    }
    return [...pictures, ...texts];
}

// Origin lines are dealt like cards from lineTypes (the grammar's origin list, e.g. "#elegy#", so a
// type listed twice comes up twice as often): the whole deck before any type comes round again, and
// never the same type twice in a row. Any symbol: a sentence already used in this zine is redrawn
// (a few tries) so the grammar's variety spreads across the pages.
function lineDealer(line, lineTypes, r) {
    const simple = Array.isArray(lineTypes) && lineTypes.length > 0 && lineTypes.every(t => /^#[^#.\[\]]+#$/.test(t));
    const deck = simple ? lineTypes.map(t => t.slice(1, -1)) : null;
    let hand = [], last = null;
    const count = list => list.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map());
    // Can what's left be laid out with no type twice in a row, after a card of type prev?
    const workable = (rest, prev) => {
        const counts = count(rest);
        const most = Math.max(0, ...counts.values());
        if (most > Math.ceil(rest.length / 2)) return false;
        return !(2 * most - 1 === rest.length && counts.get(prev) === most);
    };
    const deal = () => {
        if (hand.length === 0) hand = r.shuffle(deck);
        const choices = hand.map((t, i) => i).filter(i => hand[i] !== last);
        const good = choices.filter(i => workable(hand.filter((_, j) => j !== i), hand[i]));
        const i = good.length ? r.pick(good) : choices.length ? r.pick(choices) : 0;
        last = hand.splice(i, 1)[0];
        return last;
    };
    const said = new Set();
    const fresh = get => {
        let text = get();
        for (let tries = 0; text && said.has(text) && tries < 8; tries++) text = get();
        if (text) said.add(text);
        return text;
    };
    return symbol => {
        if (symbol === 'origin' && deck) {
            const type = deal();
            return fresh(() => line(type));
        }
        return fresh(() => line(symbol));
    };
}

function composeZine({ line, lineTypes, clipart, photos, fonts, rng, newId, insidePages, measure }) {
    const r = randomTools(rng);
    const nextPhoto = makePool(photos, r), nextClip = makePool(clipart, r);
    let photoTurn = r.rng() < 0.5;
    const c = {
        r, newId, fonts, nextPhoto, nextClip,
        line: lineDealer(line, lineTypes, r),
        // Pictures for the text-only layouts, photos and clip art taking turns
        nextAccent: () => (photoTurn = !photoTurn) ? (nextPhoto() || nextClip()) : (nextClip() || nextPhoto()),
        measure: measure || ((content, font, fontSize, w) => textHeight(content, fontSize, w))
    };
    const pages = [
        composePage(c, { id: newId(), role: 'front-cover', layout: 'front-cover' }, composeFrontCover),
        { id: newId(), role: 'their-info', elements: [] }
    ];
    let previous = null;
    for (let i = 0; i <= insidePages; i++) {   // the extra pass is the back cover
        const layout = weightedPick(r, RANDOM_LAYOUTS.filter(name => name !== previous));
        previous = layout;
        pages.push(composePage(c, { id: newId(), role: i < insidePages ? 'inside' : 'back-cover', layout }, RANDOM_LAYOUT_BUILDERS[layout]));
    }
    return pages;
}

// Splits the editor's loaded fonts into readable (small text) and display (title, slogans)
function randomFontLists(sources, available) {
    const loaded = categories => sources.filter(f => categories.includes(f.category) && f.family in available).map(f => f.family);
    const readable = ['Liberation Mono', ...loaded(READABLE_CATEGORIES)];
    const display = loaded(DISPLAY_CATEGORIES);
    return { readable, display: display.length ? display : readable };
}

const Randomize = {
    init: function () {
        const confirmModal = document.getElementById('randomize-confirm-modal');
        const doneModal = document.getElementById('randomize-done-modal');
        const pileModal = document.getElementById('randomize-pile-modal');
        // A poster gets a pile added; every other format gets the whole-zine Randomize
        document.getElementById('randomize-btn').addEventListener('click', () =>
            (isPoster(state.pageFormat) ? pileModal : confirmModal).classList.add('show'));
        pileModal.addEventListener('click', e => {
            const btn = e.target.closest('button[data-pile]');
            if (!btn && e.target !== pileModal) return;
            pileModal.classList.remove('show');
            if (btn && btn.dataset.pile) Randomize.addPile(btn.dataset.pile);
        });
        document.getElementById('randomize-no-btn').addEventListener('click', () => confirmModal.classList.remove('show'));
        document.getElementById('randomize-yes-btn').addEventListener('click', () => {
            confirmModal.classList.remove('show');
            Randomize.apply();
            doneModal.classList.add('show');
        });
        document.getElementById('randomize-ok-btn').addEventListener('click', Randomize.finish);
        // A backdrop click or Escape answers No on the confirm dialog and OK on the IBM dialog
        confirmModal.addEventListener('click', e => { if (e.target === confirmModal) confirmModal.classList.remove('show'); });
        doneModal.addEventListener('click', e => { if (e.target === doneModal) Randomize.finish(); });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (pileModal.classList.contains('show')) pileModal.classList.remove('show');
            else if (confirmModal.classList.contains('show')) confirmModal.classList.remove('show');
            else if (doneModal.classList.contains('show')) Randomize.finish();
        });
    },

    // A symbol the grammar doesn't have (or hasn't loaded yet) gives no text, not "[symbol]"
    line: function (symbol) {
        const options = state.grammar && state.grammar[symbol];
        return options && options.length ? Tracery.expand(state.grammar, symbol).trim() : '';
    },

    // Real rendered height of a text box (styled like the editor's .zine-text), so wide
    // display fonts get the room they need instead of spilling past their box
    measure: function (content, font, fontSize, w) {
        const probe = document.createElement('div');
        probe.className = 'zine-text';
        Object.assign(probe.style, {
            position: 'absolute', left: '-9999px', top: '0', visibility: 'hidden',
            width: (w - 4) + 'px',   // inside the element's 2px border
            fontFamily: font + ', Liberation Mono, monospace', fontSize: fontSize + 'px'
        });
        probe.textContent = content;
        document.body.appendChild(probe);
        const h = probe.offsetHeight + 4;
        probe.remove();
        return Math.ceil(h);
    },

    apply: function () {
        const oldBack = (state.pages || []).find(page => page.role === 'back-cover');
        const oldFront = (state.pages || []).find(page => page.role === 'front-cover');
        const pages = composeZine({
            line: Randomize.line,
            lineTypes: state.grammar && state.grammar.origin,
            clipart: state.clipartImages || [],
            photos: state.photoImages || [],
            fonts: randomFontLists(fontSources, state.fonts || {}),
            rng: Math.random,
            newId: generateId,
            insidePages: maxInsidePages(),
            measure: Randomize.measure
        });
        pages.forEach(page => { delete page.layout; delete page.variant; });
        // A fixed cover (opening night, the workshop back) keeps its stored page as it was
        if (FixedPages.replaces('front-cover')) pages[0] = oldFront || { id: generateId(), role: 'front-cover', elements: [] };
        if (FixedPages.replaces('back-cover')) pages[pages.length - 1] = oldBack || { id: generateId(), role: 'back-cover', elements: [] };
        state.pageFormat = 'half-letter';
        state.pages = pages;
        // Your info starts with the locked "I forewent my creativity..." note (see infoFormLayout)
        state.meta.info = { randomized: true };
        const theirInfo = pages.find(page => page.role === 'their-info');
        theirInfo.elements = InfoForm.elements([], state.meta.info);
        state.currentPage = 0;
        state.viewRotation = 0;
        state.selectedId = null;
        state.editingId = null;
        render();
        fitViewZoom();
    },

    // Poster: adds a pile of material around the middle of the sheet; nothing is replaced
    addPile: function (kind) {
        const { w, h } = sheetSize();
        const elements = composePile({
            kind,
            page: { w, h, margin: RANDOM_PAGE.margin },
            line: Randomize.line,
            clipart: state.clipartImages || [],
            photos: state.photoImages || [],
            fonts: randomFontLists(fontSources, state.fonts || {}),
            rng: Math.random,
            newId: generateId,
            measure: Randomize.measure
        });
        getCurrentPage().elements.push(...elements);
        state.selectedId = null;
        state.editingId = null;
        render();
    },

    finish: function () {
        document.getElementById('randomize-done-modal').classList.remove('show');
        state.currentPage = state.pages.findIndex(page => page.role === 'their-info');
        state.selectedId = null;
        state.editingId = null;
        render();
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { composeZine, composePile, randomFontLists, rotatedSize, PILE_RECIPES, RANDOM_LAYOUTS, RANDOM_TITLE, RANDOM_GRIT };
}
