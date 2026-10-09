// poster-tools.cjs — full-sheet tools fill the current sheet (posters included), and resize/rotate
// handles keep their on-screen size at any zoom.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open({ width: 1366, height: 768 });
    const last = () => page.evaluate(() => { const els = getCurrentPage().elements; const e = els[els.length - 1]; return { type: e.type, w: e.w, h: e.h, x: e.x, y: e.y }; });

    for (const [format, w, h] of [['poster-legal', 816, 1344], ['poster-letter', 816, 1056], ['single-page', 1056, 816], ['half-letter', 528, 816]]) {
        console.log(`[${format}: full-sheet tools]`);
        await page.selectOption('#page-format', format);   // harness accepts the confirm
        await page.click('#add-background-btn');
        const bg = await last();
        assert(`Background covers ${w} x ${h}`, bg.type === 'background' && bg.w === w && bg.h === h && bg.x === 0 && bg.y === 0);
        await page.click('#grit-1-btn');
        const grit = await last();
        assert(`Grit covers ${w} x ${h}`, grit.type === 'texture' && grit.w === w && grit.h === h);
    }

    console.log('[handles keep their size on screen]');
    await page.selectOption('#page-format', 'poster-legal');
    const id = await page.evaluate(() => {
        const el = Object.assign(createTextElement(300, 300), { content: 'handles', rotation: 0 });
        addElement(el);
        state.selectedId = el.id;
        render();
        return el.id;
    });
    for (const z of [0.42, 1, 1.75]) {
        await page.evaluate(z => { setViewZoom(z); renderCanvas(); }, z);
        await page.$eval(`[data-element-id="${id}"]`, el => el.scrollIntoView({ block: 'center', inline: 'center' }));
        const m = await page.evaluate(id => {
            const el = document.querySelector(`[data-element-id="${id}"]`).getBoundingClientRect();
            const se = document.querySelector('.resize-handle.se').getBoundingClientRect();
            const rot = document.querySelector('.resize-handle.rotate').getBoundingClientRect();
            return { se: se.width, rot: rot.width, cornerX: se.left + se.width / 2 - el.right, cornerY: se.top + se.height / 2 - el.bottom };
        }, id);
        assert(`${z * 100}%: corner handle ~8px on screen (${m.se.toFixed(1)})`, Math.abs(m.se - 8) <= 1);
        assert(`${z * 100}%: rotate handle ~10px on screen (${m.rot.toFixed(1)})`, Math.abs(m.rot - 10) <= 1);
        // Handles hang off the inside of the element's 2px border, which scales with the sheet
        const slack = 2 * z + 1;
        assert(`${z * 100}%: corner handle centred on the corner`, Math.abs(m.cornerX) <= slack && Math.abs(m.cornerY) <= slack);
    }

    await close();
    done();
})();
