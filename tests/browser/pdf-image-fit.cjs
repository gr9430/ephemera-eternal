// pdf-image-fit.cjs — pictures in the PDF keep their proportions. html2canvas ignores CSS
// object-fit and stretches every <img> to its box, so the PDF capture must match what the
// browser actually shows for contain-fit (photos, clip art) and cover-fit (full-page photo) pictures.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    await page.waitForFunction(() => state.photoImages.length);

    // Mean per-channel difference between the on-screen page and the PDF capture of it, 0-255
    const difference = async (makeElement) => {
        await page.evaluate(async (make) => {
            const photo = state.photoImages.find(p => p.src.includes('goldman')) || state.photoImages[0];
            const probe = new Image();
            probe.src = photo.src;
            await probe.decode();
            state.currentPage = 0;
            getCurrentPage().elements = [eval(make)(photo)];
            state.selectedId = null;
            render();
            document.querySelector('.canvas-container').classList.add('hide-guides');
            await new Promise(r => setTimeout(r, 300));
        }, makeElement.toString());
        const shot = (await page.locator('.canvas-container').screenshot()).toString('base64');
        return page.evaluate(async (shot) => {
            const captured = await captureEditorPage(0);
            const draw = async (source) => {
                const c = document.createElement('canvas');
                c.width = 132; c.height = 204;
                c.getContext('2d').drawImage(source, 0, 0, 132, 204);
                return c.getContext('2d').getImageData(0, 0, 132, 204).data;
            };
            const img = new Image();
            img.src = 'data:image/png;base64,' + shot;
            await img.decode();
            const a = await draw(img), b = await draw(captured);
            let sum = 0;
            for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
            return sum / (a.length / 4) / 3;
        }, shot);
    };

    console.log('[contain: a tall photo in a wide box]');
    const contain = await difference(photo => Object.assign(createImageElement(48, 300, photo.src, ''), { w: 432, h: 140, rotation: 0 }));
    assert(`PDF matches the screen (difference ${contain.toFixed(1)})`, contain < 6);

    console.log('[contain: tilted]');
    const tilted = await difference(photo => Object.assign(createImageElement(80, 200, photo.src, ''), { w: 360, h: 200, rotation: 8 }));
    assert(`PDF matches the screen (difference ${tilted.toFixed(1)})`, tilted < 6);

    console.log('[cover: full-page photo]');
    // A busy full-page photo differs by ~7-9 from resampling alone, so compare against the same photo
    // in a box of its own proportions (nothing to fit). Stretched, it scored 22 before the fix.
    const floor = await difference(photo => Object.assign(createBackgroundImageElement(photo.src, ''), { opacity: 1, w: 536, h: 804, y: 6 }));
    const cover = await difference(photo => Object.assign(createBackgroundImageElement(photo.src, ''), { opacity: 1 }));
    assert(`PDF matches the screen (difference ${cover.toFixed(1)}, resampling floor ${floor.toFixed(1)})`, cover < floor + 2);

    console.log('[the editor itself is left as it was]');
    assert('on-screen pictures still use object-fit after export', await page.evaluate(() =>
        getComputedStyle(document.querySelector('.zine-element img')).objectFit === 'cover' &&
        document.querySelector('.zine-element img').style.width === '100%'));

    await close();
    done();
})();
