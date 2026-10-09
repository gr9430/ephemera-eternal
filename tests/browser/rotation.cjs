// rotation.cjs — single-page view rotation: buttons, dragging moves with the mouse at every
// angle, and export captures the sheet unrotated.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    const hidden = id => page.$eval('#' + id, b => b.hidden);

    console.log('[buttons]');
    assert('hidden for half-letter', await hidden('rotate-right-btn') && await hidden('rotate-left-btn'));
    await page.selectOption('#page-format', 'single-page');
    await page.evaluate(() => setViewZoom(1));   // the sizes below are at 100%
    assert('shown for single-page', !(await hidden('rotate-right-btn')));

    await page.evaluate(() => {
        addElement(Object.assign(createTextElement(300, 300), { content: 'drag me', rotation: 0 }));
        state.selectedId = null;
        render();
    });
    const id = await page.evaluate(() => getCurrentPage().elements[0].id);
    const box = () => page.$eval(`[data-element-id="${id}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });

    for (const angle of [0, 90, 180, 270]) {
        console.log(`[${angle}°]`);
        await page.evaluate(a => setViewRotation(a), angle);
        assert('state and transform agree', await page.evaluate(a => state.viewRotation === a &&
            document.querySelector('.canvas-container').style.transform === (a ? `rotate(${a}deg)` : ''), angle));
        const area = await page.$eval('.canvas-area', el => ({ w: el.scrollWidth, h: el.scrollHeight }));
        const rotator = await page.$eval('#canvas-rotator', el => ({ w: el.offsetWidth, h: el.offsetHeight }));
        assert('rotator sized to the turned sheet', angle % 180 ? rotator.w === 816 && rotator.h === 1056 : rotator.w === 1056 && rotator.h === 816);
        assert('whole sheet reachable by scrolling', area.w >= rotator.w && area.h >= rotator.h);

        await page.$eval('.canvas-area', el => { el.scrollTop = 0; el.scrollLeft = 0; });
        await page.$eval(`[data-element-id="${id}"]`, el => el.scrollIntoView({ block: 'center', inline: 'center' }));
        const before = await box();
        await page.mouse.move(before.x, before.y);
        await page.mouse.down();
        await page.mouse.move(before.x + 20, before.y + 15, { steps: 4 });
        await page.mouse.move(before.x + 40, before.y + 30, { steps: 4 });
        await page.mouse.up();
        const after = await box();
        assert(`drag follows the mouse on screen (moved ${Math.round(after.x - before.x)},${Math.round(after.y - before.y)})`,
            Math.abs(after.x - before.x - 40) <= 2 && Math.abs(after.y - before.y - 30) <= 2);
    }

    console.log('[buttons step 90°]');
    await page.evaluate(() => setViewRotation(0));
    await page.click('#rotate-right-btn');
    assert('right = 90', await page.evaluate(() => state.viewRotation === 90));
    await page.click('#rotate-left-btn');
    await page.click('#rotate-left-btn');
    assert('left twice = 270', await page.evaluate(() => state.viewRotation === 270));

    console.log('[export captures the sheet unrotated]');
    const seen = await page.evaluate(async () => {
        setViewRotation(90);
        const transforms = [];
        const real = window.html2canvas;
        window.html2canvas = (el, opts) => { transforms.push(el.style.transform); return real(el, opts); };
        window.jspdf.jsPDF.API.save = function () {};
        await generatePDF();
        window.html2canvas = real;
        return { transforms, after: state.viewRotation };
    });
    assert('captured with no rotation', seen.transforms.length === 1 && seen.transforms[0] === '');
    assert('rotation restored afterwards', seen.after === 90);

    console.log('[resets]');
    await page.selectOption('#page-format', 'stapled');
    assert('format change resets to 0', await page.evaluate(() => state.viewRotation === 0));
    assert('not in project JSON', await page.evaluate(() => {
        setViewRotation(180);
        return !JSON.stringify(state, (k, v) => (PROJECT_JSON_SKIP.includes(k) ? undefined : v)).includes('viewRotation');
    }));

    await close();
    done();
})();
