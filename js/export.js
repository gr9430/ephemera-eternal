const PAPER_COLOR = '#f8f8f0';
const SHEET_W = 11 * 72;   // letter landscape, in PDF points
const SHEET_H = 8.5 * 72;
const PT_PER_PX = 0.75;   // 72 pt per inch / 96 px per inch
const SHEET_PDF_NAMES = {
    'single-page': 'zine-single-page-folded', 'stapled': 'zine-single-page-stapled',
    'poster-letter': 'poster-letter', 'poster-legal': 'poster-legal'
};

function capture(el) {
    return html2canvas(el, { backgroundColor: PAPER_COLOR, scale: 2, useCORS: true, allowTaint: true });
}

// html2canvas ignores CSS object-fit and stretches every <img> to fill its box. Before a capture,
// give each fitted picture its real displayed size, centered in its box, with the box clipping it.
function freezeObjectFit(root) {
    root.querySelectorAll('img').forEach(img => {
        const fit = getComputedStyle(img).objectFit;
        if ((fit !== 'contain' && fit !== 'cover') || !img.naturalWidth) return;
        const boxW = img.offsetWidth, boxH = img.offsetHeight;   // layout size, before any rotation
        const scale = (fit === 'contain' ? Math.min : Math.max)(boxW / img.naturalWidth, boxH / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        img.parentElement.style.overflow = 'hidden';
        Object.assign(img.style, {
            position: 'absolute', left: (boxW - w) / 2 + 'px', top: (boxH - h) / 2 + 'px',
            width: w + 'px', height: h + 'px', objectFit: 'fill', maxWidth: 'none', maxHeight: 'none'
        });
    });
}

async function captureEditorPage(index) {
    state.currentPage = index;
    renderCanvas();
    await new Promise(resolve => setTimeout(resolve, 100));   // let images/fonts settle
    const container = document.querySelector('.canvas-container');
    freezeObjectFit(container);
    try {
        return await capture(container);
    } finally {
        renderCanvas();   // put the editor's own object-fit pictures back
    }
}

// Fixed pages (Glenn's info, the opening-night back cover) are built off-screen and captured
async function captureFixedPage(page) {
    page.style.position = 'absolute';
    page.style.left = '0';
    page.style.top = '0';
    page.style.zIndex = '-1';
    document.body.appendChild(page);
    try {
        return await capture(page);
    } finally {
        page.remove();
    }
}

// Asks how the booklet will be printed. Resolves 'duplex', 'two-pass', or null (cancelled).
function chooseBookletMode() {
    const modal = document.getElementById('booklet-export-modal');
    modal.classList.add('show');
    return new Promise(resolve => {
        const onClick = (e) => {
            const btn = e.target.closest('button[data-mode]');
            if (!btn && e.target !== modal) return;
            modal.classList.remove('show');
            modal.removeEventListener('click', onClick);
            resolve(btn && btn.dataset.mode ? btn.dataset.mode : null);
        };
        modal.addEventListener('click', onClick);
    });
}

// Half-letter: cover sheet + inside sheets, two pages per landscape side, in print order
async function buildBookletPdf(mode) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [SHEET_W, SHEET_H] });
    const sides = sidesInPrintOrder(bookletSheets(insideIndexes(state.pages).length), mode);
    const images = new Map();   // slot -> PNG data URL, so each page is captured once

    const imageFor = async (slot) => {
        if (slot === null) return null;
        if (!images.has(slot)) {
            const canvas = slot === 'glenn-info' ? await captureFixedPage(buildOrganizerPage(state.organizer))
                : slot === 'addendum' ? await captureFixedPage(buildAddendumPage())
                : OpeningNight.replaces(slot) ? await captureFixedPage(OpeningNight.buildPage())
                : await captureEditorPage(slotPageIndex(state.pages, slot));
            images.set(slot, canvas.toDataURL('image/png'));
        }
        return images.get(slot);
    };

    for (let i = 0; i < sides.length; i++) {
        if (i > 0) pdf.addPage([SHEET_W, SHEET_H], 'landscape');
        for (let half = 0; half < 2; half++) {
            const x = half * SHEET_W / 2;
            const image = await imageFor(sides[i].slots[half]);
            if (image) {
                pdf.addImage(image, 'PNG', x, 0, SHEET_W / 2, SHEET_H);
            } else {
                pdf.setFillColor(PAPER_COLOR);
                pdf.rect(x, 0, SHEET_W / 2, SHEET_H, 'F');
            }
        }
    }
    return pdf;
}

// Single-page, stapled and posters: each sheet as drawn (stapled has one editor page per side)
async function buildSheetPdf() {
    const { jsPDF } = window.jspdf;
    const { w, h } = sheetSize();
    const pw = w * PT_PER_PX, ph = h * PT_PER_PX;
    const orientation = pw > ph ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'pt', format: [pw, ph] });
    const indexes = state.pageFormat === 'stapled' ? state.pages.map((_, i) => i) : [state.currentPage];
    for (let i = 0; i < indexes.length; i++) {
        if (i > 0) pdf.addPage([pw, ph], orientation);
        const canvas = await captureEditorPage(indexes[i]);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pw, ph);
    }
    return pdf;
}

async function generatePDF() {
    const isBooklet = state.pageFormat === 'half-letter';
    const mode = isBooklet ? await chooseBookletMode() : null;
    if (isBooklet && !mode) return;

    const container = document.querySelector('.canvas-container');
    const btn = document.getElementById('print-btn');
    const saved = { guides: state.guidesVisible, selectedId: state.selectedId, currentPage: state.currentPage, rotation: state.viewRotation, zoom: state.viewZoom };

    // Hide guides and selection boxes while capturing
    container.classList.add('hide-guides');
    setViewRotation(0);
    setViewZoom(1);
    state.selectedId = null;
    renderCanvas();
    btn.textContent = 'Generating PDF...';
    btn.disabled = true;

    try {
        const date = new Date().toISOString().slice(0, 10);
        if (isBooklet) {
            (await buildBookletPdf(mode)).save(`zine-booklet-${mode}-${date}.pdf`);
        } else {
            (await buildSheetPdf()).save(`${SHEET_PDF_NAMES[state.pageFormat]}-${date}.pdf`);
        }
    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        if (saved.guides) container.classList.remove('hide-guides');
        state.currentPage = saved.currentPage;
        state.selectedId = saved.selectedId;
        setViewRotation(saved.rotation);
        setViewZoom(saved.zoom);
        renderCanvas();
        btn.textContent = 'Save as PDF';
        btn.disabled = false;
    }
}

const Export = {
    init: function () {
        const saveBtn = document.getElementById('save-json-btn');
        const loadBtn = document.getElementById('load-json-btn');
        const loadInput = document.getElementById('load-json-input');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => exportProjectJSON());
        }
        if (loadBtn && loadInput) {
            loadBtn.addEventListener('click', () => loadInput.click());
            loadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                loadInput.value = '';
                if (!file) return;
                importProjectJSON(file, () => {
                    updateCanvasFormat();
                    render();
                    fitViewZoom();
                    Generator.renderSymbolOptions();
                    Gallery.render();
                    Clipart.init();
                    Photos.init();
                });
            });
        }

        const importBtn = document.getElementById('import-pages-btn');
        const importInput = document.getElementById('import-pages-input');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                importInput.value = '';
                if (!files.length) return;

                const projects = [];
                const unreadable = [];
                for (const file of files) {
                    try {
                        projects.push({ name: file.name, data: JSON.parse(await file.text()) });
                    } catch (error) {
                        unreadable.push(file.name);
                    }
                }
                const result = importInsidePages(state.pages, projects, generateId);
                state.pages = result.pages;
                state.selectedId = null;
                state.editingId = null;
                render();
                Autosave.showNotice(importSummary(result, unreadable));
            });
        }
    }
};
