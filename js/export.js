async function generatePDF() {
    // Temporarily hide guides and deselect elements for PDF generation
    const canvas = document.querySelector('.canvas-container');
    const guidesWereVisible = state.guidesVisible;
    const previousSelection = state.selectedId;

    canvas.classList.add('hide-guides');
    state.selectedId = null; // Deselect to avoid selection boxes in PDF
    renderCanvas(); // Re-render without selection

    try {
        // Show loading state
        const btn = document.getElementById('print-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Generating PDF...';
        btn.disabled = true;

        const { jsPDF } = window.jspdf;

        // Determine PDF dimensions based on format
        let pdf;
        let pageWidth, pageHeight;

        if (state.pageFormat === 'single-page' || state.pageFormat === 'stapled') {
            // Landscape orientation for single-page formats (11" × 8.5")
            pageWidth = 11 * 72; // Convert inches to points (72 points per inch)
            pageHeight = 8.5 * 72;
            pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'pt',
                format: [pageWidth, pageHeight]
            });
        } else {
            // Portrait orientation for half-letter (5.5" × 8.5")
            pageWidth = 5.5 * 72;
            pageHeight = 8.5 * 72;
            pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: [pageWidth, pageHeight]
            });
        }

        // Generate filename based on format
        const formatName = state.pageFormat === 'half-letter' ? 'half-letter' :
                         state.pageFormat === 'single-page' ? 'single-page-folded' : 'single-page-stapled';
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `zine-${formatName}-${timestamp}.pdf`;

        if (state.pageFormat === 'stapled' && state.pages.length > 1) {
            // Handle multi-page stapled format
            for (let i = 0; i < state.pages.length; i++) {
                if (i > 0) {
                    pdf.addPage([pageWidth, pageHeight], 'landscape');
                }

                // Switch to the page
                const originalPage = state.currentPage;
                state.currentPage = i;
                renderCanvas();

                // Wait for rendering to complete
                await new Promise(resolve => setTimeout(resolve, 100));

                // Capture the canvas
                const canvas = await html2canvas(document.querySelector('.canvas-container'), {
                    backgroundColor: '#f8f8f0',
                    scale: 2,
                    useCORS: true,
                    allowTaint: true
                });

                // Add to PDF
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);

                // Restore original page
                state.currentPage = originalPage;
            }
            renderCanvas(); // Restore original page view
        } else {
            // Single page capture
            const canvas = await html2canvas(document.querySelector('.canvas-container'), {
                backgroundColor: '#f8f8f0',
                scale: 2,
                useCORS: true,
                allowTaint: true
            });

            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
        }

        // Save the PDF
        pdf.save(filename);

        // Restore guides state and selection
        if (guidesWereVisible) {
            canvas.classList.remove('hide-guides');
        }
        state.selectedId = previousSelection;
        renderCanvas(); // Re-render with restored selection

        // Restore button state
        btn.textContent = originalText;
        btn.disabled = false;

    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Please try again.');

        // Restore guides state and selection
        if (guidesWereVisible) {
            canvas.classList.remove('hide-guides');
        }
        state.selectedId = previousSelection;
        renderCanvas(); // Re-render with restored selection

        // Restore button state
        const btn = document.getElementById('print-btn');
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
                    Generator.renderSymbolOptions();
                    Generator.renderWordBank();
                    Gallery.render();
                    Clipart.init();
                    Photos.init();
                });
            });
        }
    }
};
