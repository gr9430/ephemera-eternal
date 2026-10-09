// zoom.cjs — zoom buttons, Fit, dragging follows the mouse at any zoom and rotation, the PDF is
// captured at 100%, and zoom resets to Fit on format change and project load.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open({ width: 1280, height: 800 });
    const zoom = () => page.evaluate(() => state.viewZoom);

    console.log('[Fit on format change]');
    await page.selectOption('#page-format', 'poster-legal');
    const fit = await page.evaluate(() => {
        const area = document.querySelector('.canvas-area').getBoundingClientRect();
        const sheet = document.querySelector('.canvas-container').getBoundingClientRect();
        return { zoom: state.viewZoom, label: document.getElementById('zoom-level').textContent,
            inside: sheet.top >= area.top && sheet.bottom <= area.bottom && sheet.left >= area.left && sheet.right <= area.right };
    });
    assert('legal poster fits below 100%', fit.zoom < 1);
    assert('whole sheet in view', fit.inside);
    assert('readout matches', fit.label === Math.round(fit.zoom * 100) + '%');

    console.log('[buttons]');
    await page.evaluate(() => setViewZoom(1));
    await page.click('#zoom-in-btn');
    assert('+ goes to 125%', await zoom() === 1.25);
    await page.click('#zoom-out-btn');
    await page.click('#zoom-out-btn');
    assert('- twice goes to 75%', await zoom() === 0.75);
    await page.evaluate(() => setViewZoom(2));
    assert('+ disabled at 200%', await page.$eval('#zoom-in-btn', b => b.disabled));
    await page.evaluate(() => setViewZoom(0.25));
    assert('- disabled at 25%', await page.$eval('#zoom-out-btn', b => b.disabled));
    await page.click('#zoom-fit-btn');
    assert('Fit returns to the fitted zoom', await zoom() === fit.zoom);

    console.log('[drag follows the mouse]');
    await page.evaluate(() => {
        addElement(Object.assign(createTextElement(300, 300), { content: 'drag me', rotation: 0 }));
        state.selectedId = null;
        render();
    });
    const id = await page.evaluate(() => getCurrentPage().elements[0].id);
    const box = () => page.$eval(`[data-element-id="${id}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const where = () => page.evaluate(id => { const e = getCurrentPage().elements.find(e => e.id === id); return { x: e.x, y: e.y }; }, id);
    for (const [z, angle] of [[0.5, 0], [1.5, 0], [0.5, 90], [1.5, 270]]) {
        await page.evaluate(([z, a]) => { setViewRotation(a); setViewZoom(z); }, [z, angle]);
        await page.$eval(`[data-element-id="${id}"]`, el => el.scrollIntoView({ block: 'center', inline: 'center' }));
        const before = await box(), sheetBefore = await where();
        await page.mouse.move(before.x, before.y);
        await page.mouse.down();
        await page.mouse.move(before.x + 20, before.y + 15, { steps: 4 });
        await page.mouse.move(before.x + 40, before.y + 30, { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(50);   // mouseup clears the drag state 10ms later; don't start the next drag inside that
        const after = await box(), sheetAfter = await where();
        assert(`${z * 100}% ${angle}°: follows the mouse on screen`, Math.abs(after.x - before.x - 40) <= 2 && Math.abs(after.y - before.y - 30) <= 2);
        const moved = Math.hypot(sheetAfter.x - sheetBefore.x, sheetAfter.y - sheetBefore.y);
        assert(`${z * 100}% ${angle}°: moves 50/zoom on the sheet (${Math.round(moved)})`, Math.abs(moved - 50 / z) <= 3);
    }

    console.log('[PDF captured at 100%]');
    const seen = await page.evaluate(async () => {
        setViewRotation(90);
        setViewZoom(0.5);
        const shots = [];
        const real = window.html2canvas;
        window.html2canvas = (el, opts) => { shots.push({ transform: el.style.transform, w: el.getBoundingClientRect().width }); return real(el, opts); };
        window.jspdf.jsPDF.API.save = function () {};
        await generatePDF();
        window.html2canvas = real;
        return { shots, zoom: state.viewZoom, rotation: state.viewRotation };
    });
    assert('no transform and full width at capture', seen.shots.length === 1 && seen.shots[0].transform === '' && Math.round(seen.shots[0].w) === 816);
    assert('zoom and rotation restored', seen.zoom === 0.5 && seen.rotation === 90);

    console.log('[resets]');
    await page.evaluate(() => { setViewRotation(0); setViewZoom(1.75); });
    await page.selectOption('#page-format', 'poster-letter');   // harness accepts the confirm
    const z1 = await zoom();
    assert('format change refits', z1 !== 1.75 && z1 <= 1);
    await page.evaluate(() => setViewZoom(1.75));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zine-zoom-')), 'poster.json');
    // A real project file is the whole state (minus PROJECT_JSON_SKIP), as Save Project writes it
    fs.writeFileSync(file, await page.evaluate(() => JSON.stringify(
        Object.assign({}, state, { pageFormat: 'poster-legal', currentPage: 0, pages: [{ id: 1, elements: [] }] }),
        (key, value) => (PROJECT_JSON_SKIP.includes(key) ? undefined : value))));
    await page.setInputFiles('#load-json-input', file);
    await page.waitForFunction(() => state.pageFormat === 'poster-legal');
    const loaded = await page.evaluate(() => ({ zoom: state.viewZoom, h: document.querySelector('.canvas-container').offsetHeight }));
    assert('loaded poster is a legal sheet', loaded.h === 1344);
    assert('project load refits', loaded.zoom !== 1.75 && loaded.zoom <= 1);

    await close();
    done();
})();
