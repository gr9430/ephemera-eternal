        // Dynamic Font Loading System
        const fontSources = [
            // Core Fonts (slots)
            { family: 'Inter-Regular', files: ['slot1.woff2', 'slot1.ttf'], label: 'Inter Regular', category: 'Core', credit: 'Rasmus Andersson, SIL Open Font License' },
            { family: 'Inter-Bold', files: ['slot2.woff2', 'slot2.ttf'], label: 'Inter Bold', category: 'Core', credit: 'Rasmus Andersson, SIL Open Font License' },
            { family: 'Inter-Light', files: ['slot3.woff2', 'slot3.ttf'], label: 'Inter Light', category: 'Core', credit: 'Rasmus Andersson, SIL Open Font License' },
            { family: 'Inter-Medium', files: ['slot4.woff2', 'slot4.ttf'], label: 'Inter Medium', category: 'Core', credit: 'Rasmus Andersson, SIL Open Font License' },
            { family: 'Bebas-Neue', files: ['slot5.woff2', 'slot5.ttf'], label: 'Bebas Neue', category: 'Core', credit: 'Ryoichi Tsunekawa, SIL Open Font License' },
            { family: 'Terminal-Grotesque', files: ['slot6.woff2', 'slot6.ttf'], label: 'Terminal Grotesque', category: 'Core', credit: 'Raphaël Bastide, SIL Open Font License' },
            { family: 'Libre-Baskerville', files: ['slot7.woff2', 'slot7.ttf'], label: 'Libre Baskerville', category: 'Core', credit: 'Pablo Impallari, SIL Open Font License' },

            // Display & Decorative
            { family: 'Anthony', files: ['anthony/Anthony.woff2'], label: 'Anthony', category: 'Display', credit: 'Jérémy Landes, Velvetyne Type Foundry' },
            { family: 'Avara-Black', files: ['avara/Avara-Black.woff2'], label: 'Avara Black', category: 'Display', credit: 'Raphaël Bastide, Velvetyne Type Foundry' },
            { family: 'Basteleur-Bold', files: ['basteleur/Basteleur-Bold.woff2'], label: 'Basteleur Bold', category: 'Display', credit: 'Keussel/Hirschmann, Velvetyne Type Foundry' },
            { family: 'Basteleur-Moonlight', files: ['basteleur/Basteleur-Moonlight.woff2'], label: 'Basteleur Moonlight', category: 'Display', credit: 'Keussel/Hirschmann, Velvetyne Type Foundry' },
            { family: 'BebasNeue-Regular', files: ['bebas-neue/BebasNeue-Regular.ttf'], label: 'Bebas Neue', category: 'Display', credit: 'Ryoichi Tsunekawa, SIL Open Font License' },
            { family: 'BluuNext-Bold', files: ['bluunext/bluunext-bold-webfont.woff2'], label: 'Bluu Next Bold', category: 'Display', credit: 'Jean-Baptiste Morizot, Velvetyne Type Foundry' },
            { family: 'HyperScrypt', files: ['hyperscrypt/HyperScrypt-Stencil_web.woff2'], label: 'HyperScrypt', category: 'Display', credit: 'Ariel Martín Pérez, Velvetyne Type Foundry' },
            { family: 'Outward-Block', files: ['outward/outward-block-webfont.woff2'], label: 'Outward Block', category: 'Display', credit: 'Yann Bertrand, Velvetyne Type Foundry' },
            { family: 'Outward-Borders', files: ['outward/outward-borders-webfont.woff2'], label: 'Outward Borders', category: 'Display', credit: 'Yann Bertrand, Velvetyne Type Foundry' },

            // Text & Sans Serif
            { family: 'Archivo-Regular', files: ['archivo/Archivo-Regular.woff2'], label: 'Archivo', category: 'Sans Serif', credit: 'Omnibus-Type, SIL Open Font License' },
            { family: 'Archivo-Bold', files: ['archivo/Archivo-Bold.woff2'], label: 'Archivo Bold', category: 'Sans Serif', credit: 'Omnibus-Type, SIL Open Font License' },
            { family: 'Archivo-Medium', files: ['archivo/Archivo-Medium.woff2'], label: 'Archivo Medium', category: 'Sans Serif', credit: 'Omnibus-Type, SIL Open Font License' },
            { family: 'Terminal-Grotesque-Web', files: ['terminal-grotesque/terminal-grotesque-webfont.woff2'], label: 'Terminal Grotesque', category: 'Sans Serif', credit: 'Raphaël Bastide, SIL Open Font License' },
            { family: 'WorkSans-Black', files: ['worksans/WorkSans-Black.ttf'], label: 'Work Sans Black', category: 'Sans Serif', credit: 'Wei Huang, SIL Open Font License' },

            // Serif
            { family: 'LibreBaskerville-Variable', files: ['libre-baskerville/LibreBaskerville-VariableFont_wght.ttf'], label: 'Libre Baskerville', category: 'Serif', credit: 'Pablo Impallari, SIL Open Font License' },

            // Experimental & Tech
            { family: 'JGS5', files: ['jgs5/jgs5.woff2'], label: 'JGS5', category: 'Experimental', credit: 'Adel Faure, SIL Open Font License' },
            { family: 'JGS7', files: ['jgs5/jgs7.woff2'], label: 'JGS7', category: 'Experimental', credit: 'Adel Faure, SIL Open Font License' },
            { family: 'KaeruKaeru-Regular', files: ['kaerukaeru/kaerukaeru-Regular.woff2'], label: 'Kaeru Kaeru', category: 'Experimental', credit: 'Wei Huang, SIL Open Font License' },
            { family: 'Lithops-Regular', files: ['lithops/Lithops-Regular.woff2'], label: 'Lithops', category: 'Experimental', credit: 'Ariel Martín Pérez, Velvetyne Type Foundry' },
            { family: 'Mess-Light', files: ['mess/Mess-Light_web.woff2'], label: 'Mess Light', category: 'Experimental', credit: 'Ariel Martín Pérez, Velvetyne Type Foundry' },
            { family: 'Ouroboros-Regular', files: ['ouroboros/Ouroboros-Regular.woff2'], label: 'Ouroboros', category: 'Experimental', credit: 'Ray Larabie, SIL Open Font License' },
            { family: 'PicNic', files: ['picnic/PicNic.woff2'], label: 'PicNic', category: 'Experimental', credit: 'Mathieu Réguer, Velvetyne Type Foundry' },
            { family: 'Pilowlava-Regular', files: ['pillowlava/Pilowlava-Regular.woff2'], label: 'Pillow Lava', category: 'Experimental', credit: 'Jérémy Landes, Velvetyne Type Foundry' },
            { family: 'Pilowlava-Atome', files: ['pillowlava/Pilowlava-Atome.woff2'], label: 'Pillow Lava Atome', category: 'Experimental', credit: 'Jérémy Landes, Velvetyne Type Foundry' },

            // Decorative & Special
            { family: 'Facade-Est', files: ['facade/Facade-Est.woff'], label: 'Facade Est', category: 'Special', credit: 'Jérémy Landes, Velvetyne Type Foundry' },
            { family: 'Facade-Ouest', files: ['facade/Facade-Ouest.woff'], label: 'Facade Ouest', category: 'Special', credit: 'Jérémy Landes, Velvetyne Type Foundry' }
        ];

        function generateFontCSS() {
            let css = '';
            fontSources.forEach(font => {
                const srcDeclarations = font.files.map(file => {
                    if (file.endsWith('.woff2')) {
                        return `url('fonts/${file}') format('woff2')`;
                    } else if (file.endsWith('.woff')) {
                        return `url('fonts/${file}') format('woff')`;
                    } else if (file.endsWith('.ttf')) {
                        return `url('fonts/${file}') format('truetype')`;
                    }
                }).filter(Boolean);

                if (srcDeclarations.length > 0) {
                    css += `
@font-face {
    font-family: '${font.family}';
    src: ${srcDeclarations.join(',\n         ')};
    font-display: swap;
}
`;
                }
            });
            return css;
        }

        function loadFont(fontFamily, testText = 'ABCabc123gqpWMj') {
            return new Promise((resolve) => {
                // Use Font Loading API if available
                if ('fonts' in document) {
                    document.fonts.load(`12px "${fontFamily}"`, testText)
                        .then(() => {
                            // Check if font is actually available
                            const available = document.fonts.check(`12px "${fontFamily}"`);
                            resolve(available);
                        })
                        .catch(() => {
                            // Fallback to measurement method
                            resolve(measureFont(fontFamily, testText));
                        });
                } else {
                    // Fallback for older browsers
                    resolve(measureFont(fontFamily, testText));
                }
            });
        }

        function measureFont(fontFamily, testText) {
            const testElement = document.createElement('div');
            testElement.style.fontFamily = 'Liberation Mono, monospace';
            testElement.style.fontSize = '12px';
            testElement.style.position = 'absolute';
            testElement.style.visibility = 'hidden';
            testElement.style.whiteSpace = 'nowrap';
            testElement.style.left = '-9999px';
            testElement.textContent = testText;

            document.body.appendChild(testElement);
            const baselineWidth = testElement.offsetWidth;
            const baselineHeight = testElement.offsetHeight;

            // Test with our target font
            testElement.style.fontFamily = `"${fontFamily}", Liberation Mono, monospace`;
            const testWidth = testElement.offsetWidth;
            const testHeight = testElement.offsetHeight;

            document.body.removeChild(testElement);

            // Font is loaded if measurements differ significantly
            const fontLoaded = Math.abs(testWidth - baselineWidth) > 1 || Math.abs(testHeight - baselineHeight) > 1;
            return fontLoaded;
        }

        async function detectAvailableFonts() {
            const availableFonts = {
                'Liberation Mono': 'Liberation Mono'
            };

            console.log('🔤 Starting font detection...');

            // Inject font CSS first
            const fontCSS = generateFontCSS();
            const styleElement = document.createElement('style');
            styleElement.textContent = fontCSS;
            document.head.appendChild(styleElement);

            // Wait a bit for CSS to be parsed
            await new Promise(resolve => setTimeout(resolve, 200));

            // Test each font with better error handling
            for (const font of fontSources) {
                try {
                    console.log(`Testing font: ${font.family}`);
                    const isLoaded = await loadFont(font.family);
                    if (isLoaded) {
                        availableFonts[font.family] = font.label;
                        console.log(`✅ Font loaded: ${font.label}`);
                    } else {
                        console.log(`❌ Font failed to load: ${font.label}`);
                    }
                } catch (error) {
                    console.warn(`Font ${font.family} error:`, error);
                }
            }

            console.log(`🎯 Font detection complete. Loaded ${Object.keys(availableFonts).length} fonts.`);
            return availableFonts;
        }

        // Initialize fonts and update state
        async function initializeFonts() {
            try {
                // Show loading message
                const loadingMsg = document.createElement('div');
                loadingMsg.id = 'font-loading';
                loadingMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #333; color: white; padding: 10px; border-radius: 4px; font-size: 12px; z-index: 9999;';
                loadingMsg.textContent = '🔤 Loading fonts...';
                document.body.appendChild(loadingMsg);

                const availableFonts = await detectAvailableFonts();
                state.fonts = availableFonts;

                // Remove loading message
                document.body.removeChild(loadingMsg);

                console.log(`📚 Font library ready: ${Object.keys(availableFonts).length} fonts loaded`);
                console.log('Available fonts:', Object.values(availableFonts).sort());

                // Force UI re-render with loaded fonts
                setTimeout(() => {
                    render();
                }, 100);

            } catch (error) {
                console.error('Font initialization error:', error);
                // Remove loading message if there was an error
                const loadingMsg = document.getElementById('font-loading');
                if (loadingMsg) document.body.removeChild(loadingMsg);
            }
        }

        // Font preview CSS generation removed - live preview is sufficient

        function generateOrganizedFontOptions(selectedFont) {
            // First add Liberation Mono
            let options = `<option value="Liberation Mono" ${selectedFont === 'Liberation Mono' ? 'selected' : ''}>Liberation Mono</option>`;

            // Group fonts by category
            const categories = {
                'Core': [],
                'Sans Serif': [],
                'Serif': [],
                'Display': [],
                'Experimental': [],
                'Special': []
            };

            // Categorize available fonts
            Object.keys(state.fonts).forEach(fontKey => {
                if (fontKey === 'Liberation Mono') return; // Skip, already added

                const fontSource = fontSources.find(f => f.family === fontKey);
                const category = fontSource ? fontSource.category : 'Uncategorized';
                const label = state.fonts[fontKey];

                if (!categories[category]) categories[category] = [];
                categories[category].push({ key: fontKey, label: label });
            });

            // Generate optgroups
            Object.entries(categories).forEach(([category, fonts]) => {
                if (fonts.length === 0) return;

                options += `<optgroup label="${category}">`;
                fonts.forEach(font => {
                    options += `<option value="${font.key}" ${selectedFont === font.key ? 'selected' : ''}>${font.label}</option>`;
                });
                options += `</optgroup>`;
            });

            return options;
        }


        function updateCanvasFormat() {
            const container = document.querySelector('.canvas-container');
            const guides = document.querySelector('.canvas-guides');

            // Remove existing format classes
            container.classList.remove('half-letter', 'single-page', 'stapled');
            guides.classList.remove('half-letter', 'single-page', 'stapled');

            // Add current format class
            container.classList.add(state.pageFormat);
            guides.classList.add(state.pageFormat);

            // Update page format selector
            document.getElementById('page-format').value = state.pageFormat;

            // Handle guides based on format
            if (state.pageFormat === 'single-page' || state.pageFormat === 'stapled') {
                // Remove simple guides, add panel guides
                guides.style.border = 'none';
                renderPanelGuides();
            } else {
                // Remove panel guides, restore simple guides
                const panelGuides = document.querySelector('.panel-guides');
                if (panelGuides) {
                    panelGuides.remove();
                }
                guides.style.border = '1px dashed rgba(122, 6, 97, 0.4)';
            }
        }

        function renderPanelGuides() {
            // Remove existing panel guides
            const existing = document.querySelector('.panel-guides');
            if (existing) existing.remove();

            const container = document.querySelector('.canvas-container');
            const panelGuides = document.createElement('div');
            panelGuides.className = 'panel-guides';

            let panels;
            let panelWidth;
            let panelHeight;

            if (state.pageFormat === 'single-page') {
                // Landscape folded zine (11" × 8.5") - 8 panels: 4 wide × 2 tall
                panelWidth = (1056 - 48) / 4; // Container width minus margins divided by 4
                panelHeight = (816 - 48) / 2; // Container height minus margins divided by 2

                panels = [
                    { id: 5, x: 0, y: panelHeight, label: 'four' },
                    { id: 6, x: panelWidth, y: panelHeight, label: 'three' },
                    { id: 7, x: panelWidth * 2, y: panelHeight, label: 'two' },
                    { id: 8, x: panelWidth * 3, y: panelHeight, label: 'one' },
                    { id: 4, x: panelWidth * 3, y: 0, label: 'ɹǝʌoꓛ ʇuoɹꓞ' },
                    { id: 3, x: panelWidth * 2, y: 0, label: 'ɹǝʌoꓛ ʞɔɐꓭ' },
                    { id: 2, x: panelWidth, y: 0, label: 'xᴉs' },
                    { id: 1, x: 0, y: 0, label: 'ǝʌᴉɟ' }
                ];
            } else if (state.pageFormat === 'stapled') {
                // Landscape stapled zine (11" × 8.5") - 8 panels: 4 wide × 2 tall
                panelWidth = (1056 - 48) / 4; // Container width minus margins divided by 4
                panelHeight = (816 - 48) / 2; // Container height minus margins divided by 2

                // Current page determines which labels to show
                if (state.currentPage === 0) {
                    // Page 1 labels
                    panels = [
                    { id: 5, x: 0, y: panelHeight, label: 'three' },
                    { id: 6, x: panelWidth, y: panelHeight, label: 'twelve' },
                    { id: 7, x: panelWidth * 2, y: panelHeight, label: 'seven' },
                    { id: 8, x: panelWidth * 3, y: panelHeight, label: 'eight' },
                    { id: 4, x: panelWidth * 3, y: 0, label: 'ɹǝʌoꓛ ʇuoɹꓞ' },
                    { id: 3, x: panelWidth * 2, y: 0, label: 'ɹǝʌoꓛ ʞɔɐꓭ' },
                    { id: 2, x: panelWidth, y: 0, label: 'uǝʇ' },
                    { id: 1, x: 0, y: 0, label: 'ǝʌᴉɟ' }
                    ];
                } else {
                    // Page 2 labels
                    panels = [
                    { id: 5, x: 0, y: panelHeight, label: 'thirteen' },
                    { id: 6, x: panelWidth, y: panelHeight, label: 'two' },
                    { id: 7, x: panelWidth * 2, y: panelHeight, label: 'nine' },
                    { id: 8, x: panelWidth * 3, y: panelHeight, label: 'sixteen' },
                    { id: 4, x: panelWidth * 3, y: 0, label: 'ɹnoɟ' },
                    { id: 3, x: panelWidth * 2, y: 0, label: 'uǝʌǝlǝ' },
                    { id: 2, x: panelWidth, y: 0, label: 'uǝǝʇɹnoɟ' },
                    { id: 1, x: 0, y: 0, label: 'ǝuo' }
                    ];
                }
            }

            panels.forEach(panel => {
                const panelDiv = document.createElement('div');
                panelDiv.className = 'panel-guide';
                panelDiv.style.left = panel.x + 'px';
                panelDiv.style.top = panel.y + 'px';
                panelDiv.style.width = panelWidth + 'px';
                panelDiv.style.height = panelHeight + 'px';

                const label = document.createElement('div');
                label.className = 'panel-label';
                label.textContent = panel.label;
                panelDiv.appendChild(label);

                panelGuides.appendChild(panelDiv);
            });

            container.appendChild(panelGuides);
        }



        function render() {
            updateCanvasFormat();
            renderCanvas();
            renderProperties();
            renderAccessibility();
            renderPageTabs();
            updateToolStates();
        }

        function renderCanvas() {
            const canvas = document.getElementById('canvas-content');
            const page = getCurrentPage();

            // Clear canvas
            canvas.innerHTML = '';

            // Get all elements and sort by type for automatic layering
            const allElements = [];

            // Add elements from new layer system (for backward compatibility)
            if (page.layers) {
                Object.values(page.layers).forEach(layerElements => {
                    allElements.push(...layerElements);
                });
            }

            // Add elements from old system (for backward compatibility)
            if (page.elements && page.elements.length > 0) {
                allElements.push(...page.elements);
            }

            // Render all elements in array order: position in the array is the
            // stacking order for every element type (see reorderElement).
            allElements.forEach((element, index) => {
                const elementDiv = document.createElement('div');
                elementDiv.className = 'zine-element';
                elementDiv.dataset.elementId = element.id;
                elementDiv.dataset.elementType = element.type;

                if (element.id === state.selectedId) {
                    elementDiv.classList.add('selected');
                    // Add resize handles for selected elements (except when editing text)
                    if (element.id !== state.editingId) {
                        addResizeHandles(elementDiv, element);
                    }
                }

                if (element.id === state.editingId) {
                    elementDiv.classList.add('editing');
                }

                // Position and transform
                elementDiv.style.left = element.x + 'px';
                elementDiv.style.top = element.y + 'px';
                elementDiv.style.width = element.w + 'px';
                elementDiv.style.height = element.h + 'px';
                elementDiv.style.transform = `rotate(${element.rotation}deg)`;
                elementDiv.style.zIndex = index + 1;

                // Apply type-based styling
                if (element.type === 'texture') {
                    // Texture elements: overlay behavior
                    elementDiv.style.mixBlendMode = element.blendMode || 'multiply';
                    elementDiv.style.opacity = element.opacity || 0.3;
                } else if (element.type === 'background' || element.type === 'background-image') {
                    // Background elements: subtle, behind content
                    elementDiv.style.opacity = element.opacity || 0.8;
                    if (element.blendMode) {
                        elementDiv.style.mixBlendMode = element.blendMode;
                    }
                } else {
                    // Content elements: full opacity, normal blend
                    elementDiv.style.opacity = element.opacity || 1.0;
                    if (element.blendMode) {
                        elementDiv.style.mixBlendMode = element.blendMode;
                    }
                }

                // Render based on element type
                if (element.type === 'text') {
                    renderTextElement(element, elementDiv);
                } else if (element.type === 'image') {
                    renderImageElement(element, elementDiv);
                } else if (element.type === 'texture') {
                    renderTextureElement(element, elementDiv);
                } else if (element.type === 'background') {
                    renderBackgroundElement(element, elementDiv);
                } else if (element.type === 'background-image') {
                    renderBackgroundImageElement(element, elementDiv);
                }

                canvas.appendChild(elementDiv);
            });
        }

        function renderTextElement(element, container) {
            if (element.id === state.editingId) {
                // Show textarea for editing
                const textarea = document.createElement('textarea');
                textarea.className = 'text-editor';
                textarea.value = element.content;
                textarea.style.fontFamily = element.font + ', Liberation Mono, monospace';
                textarea.style.fontSize = element.fontSize + 'px';
                textarea.style.color = element.color;
                textarea.style.fontWeight = element.bold ? 'bold' : 'normal';
                textarea.style.fontStyle = element.italic ? 'italic' : 'normal';
                textarea.style.textAlign = element.align;
                textarea.style.width = '100%';
                textarea.style.height = '100%';

                // Save on blur or Enter
                textarea.addEventListener('blur', () => finishTextEdit(element.id, textarea.value));
                textarea.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        finishTextEdit(element.id, textarea.value);
                    } else if (e.key === 'Escape') {
                        finishTextEdit(element.id, null); // Cancel edit
                    }
                });

                container.appendChild(textarea);

                // Focus and select all
                setTimeout(() => {
                    textarea.focus();
                    textarea.select();
                }, 10);
            } else {
                // Show normal text div
                const textDiv = document.createElement('div');
                textDiv.className = 'zine-text';
                textDiv.textContent = element.content;
                textDiv.style.fontFamily = element.font + ', Liberation Mono, monospace';
                textDiv.style.fontSize = element.fontSize + 'px';
                textDiv.style.color = element.color;
                textDiv.style.fontWeight = element.bold ? 'bold' : 'normal';
                textDiv.style.fontStyle = element.italic ? 'italic' : 'normal';
                textDiv.style.textAlign = element.align;

                container.appendChild(textDiv);
            }
        }

        function renderImageElement(element, container) {
            const img = document.createElement('img');
            img.className = 'zine-image';
            img.src = element.src;
            img.alt = element.alt || '';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';

            if (element.filter && element.filter !== 'none') {
                img.style.filter = element.filter;
            }

            container.appendChild(img);
        }

        function renderTextureElement(element, container) {
            const img = document.createElement('img');
            img.className = 'zine-texture';
            img.src = element.src;
            img.alt = element.alt || '';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            container.appendChild(img);
        }

        function renderBackgroundElement(element, container) {
            const bg = document.createElement('div');
            bg.className = 'zine-background';
            bg.style.width = '100%';
            bg.style.height = '100%';
            bg.style.backgroundColor = element.color || '#f5f5f0';

            container.appendChild(bg);
        }

        function renderBackgroundImageElement(element, container) {
            const img = document.createElement('img');
            img.className = 'zine-background-image';
            img.src = element.src;
            img.alt = element.alt || '';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            container.appendChild(img);
        }

        // Element Creation Functions

        function createTextElement(x, y) {
            return {
                id: generateId(),
                type: 'text',
                x: x || 100,
                y: y || 100,
                w: 200,
                h: 50,
                rotation: randomRotation(),
                content: 'Click to edit',
                font: 'Liberation Mono',
                fontSize: 16,
                color: '#1a1a1a',
                bold: false,
                italic: false,
                align: 'left'
            };
        }

        function createImageElement(x, y, src, alt) {
            return {
                id: generateId(),
                type: 'image',
                x: x || 100,
                y: y || 100,
                w: 150,
                h: 150,
                rotation: randomRotation(),
                src: src,
                alt: alt || '',
                filter: 'none'
            };
        }

        function createTextureElement(x, y, src, alt, blendMode = 'multiply') {
            return {
                id: generateId(),
                type: 'texture',
                x: x || 0,
                y: y || 0,
                w: 528, // Default to full canvas size for textures
                h: 816,
                rotation: 0,
                src: src,
                alt: alt || '',
                blendMode: blendMode,
                opacity: 0.3
            };
        }

        function createBackgroundElement(color = '#f5f5f0') {
            return {
                id: generateId(),
                type: 'background',
                x: 0,
                y: 0,
                w: 528,
                h: 816,
                rotation: 0,
                color: color
            };
        }

        function createBackgroundImageElement(src, alt) {
            return {
                id: generateId(),
                type: 'background-image',
                x: 0,
                y: 0,
                w: 528,
                h: 816,
                rotation: 0,
                src: src,
                alt: alt || '',
                opacity: 1,
                blendMode: 'normal'
            };
        }

        // Element Management
        function addElement(element) {
            const page = getCurrentPage();
            // Use simple elements array
            if (!page.elements) page.elements = [];
            // New backgrounds start at the back; everything else lands on top.
            // After that, every type reorders the same way (see reorderElement).
            if (element.type === 'background' || element.type === 'background-image') {
                page.elements.unshift(element);
            } else {
                page.elements.push(element);
            }
            state.selectedId = element.id;
            render();
        }

        function deleteElement(id) {
            removeElementFromPage(id);

            if (state.selectedId === id) {
                state.selectedId = null;
            }
            if (state.editingId === id) {
                state.editingId = null;
            }

            render();
        }

        function updateElement(id, updates) {
            const element = getElementById(id);
            if (element) {
                Object.assign(element, updates);
                render();
            }
        }

        // Reorder an element among all elements on the page, regardless of type.
        function reorderElement(id, direction) {
            const page = getCurrentPage();
            const elements = page.elements;
            if (!elements) return;

            const idx = elements.findIndex(el => el.id === id);
            if (idx === -1) return;

            let target;
            if (direction === 'forward') target = idx + 1;
            else if (direction === 'backward') target = idx - 1;
            else if (direction === 'front') target = elements.length - 1;
            else if (direction === 'back') target = 0;
            if (target === undefined || target < 0 || target >= elements.length || target === idx) return;

            const [el] = elements.splice(idx, 1);
            elements.splice(target, 0, el);
            render();
        }

        // Text Editing
        function startTextEdit(id) {
            if (state.editingId !== id) {
                state.editingId = id;
                state.selectedId = id;
                render();
            }
        }

        function finishTextEdit(id, newContent) {
            if (newContent !== null) {
                updateElement(id, { content: newContent });
            }

            state.editingId = null;
            render();
        }

        // Font Preview Update Function

        function updateFontPreview() {
            const previewElement = document.querySelector('.preview-text');
            const selectedElement = getElementById(state.selectedId);

            if (previewElement && selectedElement && selectedElement.type === 'text') {
                previewElement.style.fontFamily = `${selectedElement.font}, 'Liberation Mono', monospace`;
                previewElement.style.fontSize = '14px';
                previewElement.style.color = selectedElement.color || '#000';
                previewElement.style.fontWeight = selectedElement.bold ? 'bold' : 'normal';
                previewElement.style.fontStyle = selectedElement.italic ? 'italic' : 'normal';
                previewElement.style.textAlign = selectedElement.align || 'left';
                previewElement.textContent = selectedElement.content || 'Click to edit';
            }
        }

        // Font Credits System
        function populateFontCredits() {
            const creditsContainer = document.getElementById('font-credits');
            if (!creditsContainer) return;

            // Group credits by foundry/source
            const groupedCredits = {};
            fontSources.forEach(font => {
                if (font.credit) {
                    // Extract foundry/source from credit
                    const foundry = font.credit.includes('Velvetyne') ? 'Velvetyne Type Foundry' :
                                  font.credit.includes('SIL Open Font License') ? 'Open Source Fonts' :
                                  font.credit.includes('Omnibus-Type') ? 'Omnibus-Type' : 'Other';

                    if (!groupedCredits[foundry]) {
                        groupedCredits[foundry] = [];
                    }
                    groupedCredits[foundry].push(font);
                }
            });

            let html = '';

            // Velvetyne fonts first
            if (groupedCredits['Velvetyne Type Foundry']) {
                html += '<div style="margin-bottom: 12px;">';
                html += '<div style="font-size: 10px; font-weight: bold; color: rgb(122, 6, 97); margin-bottom: 4px;">Velvetyne Type Foundry</div>';
                groupedCredits['Velvetyne Type Foundry'].forEach(font => {
                    const designer = font.credit.split(',')[0];
                    html += `<div style="font-size: 8px; color: #666; margin-bottom: 2px;">${font.label} — ${designer}</div>`;
                });
                html += '<div style="font-size: 7px; color: #888; font-style: italic;">velvetyne.fr • Libre fonts</div>';
                html += '</div>';
            }

            // Open source fonts
            if (groupedCredits['Open Source Fonts']) {
                html += '<div style="margin-bottom: 12px;">';
                html += '<div style="font-size: 10px; font-weight: bold; color: rgb(122, 6, 97); margin-bottom: 4px;">Open Source Fonts</div>';
                groupedCredits['Open Source Fonts'].forEach(font => {
                    const designer = font.credit.split(',')[0];
                    html += `<div style="font-size: 8px; color: #666; margin-bottom: 2px;">${font.label} — ${designer}</div>`;
                });
                html += '<div style="font-size: 7px; color: #888; font-style: italic;">SIL Open Font License</div>';
                html += '</div>';
            }

            // Omnibus-Type
            if (groupedCredits['Omnibus-Type']) {
                html += '<div style="margin-bottom: 12px;">';
                html += '<div style="font-size: 10px; font-weight: bold; color: rgb(122, 6, 97); margin-bottom: 4px;">Omnibus-Type</div>';
                groupedCredits['Omnibus-Type'].forEach(font => {
                    html += `<div style="font-size: 8px; color: #666; margin-bottom: 2px;">${font.label}</div>`;
                });
                html += '<div style="font-size: 7px; color: #888; font-style: italic;">SIL Open Font License</div>';
                html += '</div>';
            }

            creditsContainer.innerHTML = html;
        }

        function setupCreditsToggle() {
            const header = document.getElementById('credits-header');
            const toggle = document.getElementById('credits-toggle');
            const credits = document.getElementById('font-credits');

            if (header && toggle && credits) {
                header.addEventListener('click', () => {
                    const isVisible = credits.style.display !== 'none';
                    credits.style.display = isVisible ? 'none' : 'block';
                    toggle.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                });
            }
        }


        // Layer Control Updates

        // Enhanced Event Listeners

        function initializeEventListeners() {
            // Page format selector
            document.getElementById('page-format').addEventListener('change', (e) => {
                const newFormat = e.target.value;
                if (newFormat !== state.pageFormat) {
                    state.pageFormat = newFormat;

                    // Setup pages based on format
                    if (newFormat === 'stapled') {
                        // Stapled format needs 2 pages
                        state.pages = [
                            { id: 1, elements: [] },
                            { id: 2, elements: [] }
                        ];
                        state.currentPage = 0;
                    } else {
                        // Half-letter and single-page formats need 1 page
                        state.pages = [
                            { id: 1, elements: [] }
                        ];
                        state.currentPage = 0;
                    }

                    state.selectedId = null;
                    state.editingId = null;
                    render();
                }
            });

            // Add text button
            document.getElementById('add-text-btn').addEventListener('click', () => {
                const element = createTextElement(100, 100);
                addElement(element);
            });

            // Built-in grit overlay buttons
            ['grit-1', 'grit-2'].forEach(name => {
                document.getElementById(`${name}-btn`).addEventListener('click', () => {
                    const element = createTextureElement(0, 0, `overlays/${name}.png`, `${name} overlay`);
                    addElement(element);
                });
            });

            // Add background button
            document.getElementById('add-background-btn').addEventListener('click', () => {
                const element = createBackgroundElement('#f8f8f0');
                addElement(element);
            });

            // Delete button
            document.getElementById('delete-btn').addEventListener('click', () => {
                if (state.selectedId) {
                    deleteElement(state.selectedId);
                }
            });

            // Save as PDF button

            // Save as PDF button
            document.getElementById('print-btn').addEventListener('click', async () => {
                await generatePDF();
            });

            // Preview button
            document.getElementById('preview-btn').addEventListener('click', () => {
                openDigitalPreview();
            });

            // Toggle guides button
            document.getElementById('toggle-guides-btn').addEventListener('click', () => {
                state.guidesVisible = !state.guidesVisible;
                const canvas = document.querySelector('.canvas-container');
                const btn = document.getElementById('toggle-guides-btn');

                if (state.guidesVisible) {
                    canvas.classList.remove('hide-guides');
                    btn.textContent = 'Hide Guides';
                    btn.title = 'Hide guides for PDF generation';
                } else {
                    canvas.classList.add('hide-guides');
                    btn.textContent = 'Show Guides';
                    btn.title = 'Show guides for layout help';
                }
            });

            // Preview modal close
            document.getElementById('preview-close').addEventListener('click', () => {
                closeDigitalPreview();
            });

            // Close preview on background click
            document.getElementById('preview-modal').addEventListener('click', (e) => {
                if (e.target.id === 'preview-modal') {
                    closeDigitalPreview();
                }
            });

            // Close preview on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && document.getElementById('preview-modal').classList.contains('show')) {
                    closeDigitalPreview();
                }
            });

            // Page management
            document.getElementById('add-page-btn').addEventListener('click', () => {
                addPage();
            });

            document.getElementById('remove-page-btn').addEventListener('click', () => {
                removePage();
            });

            // Sidebar resize
            setupSidebarResize();

            // Element selection and interaction setup
            document.getElementById('canvas-content').addEventListener('mousedown', handleMouseDown);
            document.getElementById('canvas-content').addEventListener('touchstart', handleTouchStart, { passive: false });
            document.getElementById('canvas-content').addEventListener('click', (e) => {
                // Only handle click if we didn't drag
                if (state.dragState && state.dragState.didDrag) {
                    return;
                }

                const elementDiv = e.target.closest('.zine-element');
                if (elementDiv) {
                    const id = parseFloat(elementDiv.dataset.elementId);
                    if (state.selectedId === id && e.detail === 2) {
                        // Double click - start editing if text
                        const element = getElementById(id);
                        if (element && element.type === 'text') {
                            startTextEdit(id);
                        }
                    } else {
                        // Single click - select
                        state.selectedId = id;
                        render();
                    }
                } else {
                    // Clicked on canvas background
                    state.selectedId = null;
                    render();
                }
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (state.editingId) return;
                const tag = document.activeElement && document.activeElement.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

                if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    if (state.selectedId) {
                        deleteElement(state.selectedId);
                    }
                } else if (e.key === 'Escape') {
                    state.selectedId = null;
                    render();
                }
            });
        }

        // Page Management

        function addPage() {
            const newPageId = Date.now();
            state.pages.push({
                id: newPageId,
                elements: [] // Simple elements array
            });
            state.currentPage = state.pages.length - 1;
            state.selectedId = null;
            state.editingId = null;
            render();
        }

        function removePage() {
            if (state.pages.length > 1) {
                state.pages.splice(state.currentPage, 1);
                if (state.currentPage >= state.pages.length) {
                    state.currentPage = state.pages.length - 1;
                }
                state.selectedId = null;
                state.editingId = null;
                render();
            }
        }

        // Sidebar Resize

        const SIDEBAR_MIN_WIDTH = 200;
        const SIDEBAR_MAX_WIDTH = 500;

        function setupSidebarResize() {
            const handle = document.getElementById('sidebar-resize-handle');
            const app = document.querySelector('.zine-app');
            if (!handle || !app) return;

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = document.querySelector('.left-sidebar').getBoundingClientRect().width;
                handle.classList.add('resizing');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                function onMouseMove(moveEvent) {
                    const newWidth = Math.min(
                        SIDEBAR_MAX_WIDTH,
                        Math.max(SIDEBAR_MIN_WIDTH, startWidth + (moveEvent.clientX - startX))
                    );
                    app.style.setProperty('--sidebar-width', newWidth + 'px');
                }

                function onMouseUp() {
                    handle.classList.remove('resizing');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        // Drag/Drop System

        function handleMouseDown(e) {
            // Don't handle drag if we clicked on a resize handle
            if (e.target.classList.contains('resize-handle')) return;

            let elementDiv = e.target.closest('.zine-element');
            if (!elementDiv) return;

            const elementId = parseFloat(elementDiv.dataset.elementId);
            const element = getElementById(elementId);
            if (!element) return;

            // Don't drag if we're editing text or resizing
            if (state.editingId === elementId || state.resizeState) return;

            // Select element if not already selected. render() rebuilds the canvas DOM
            // (innerHTML = ''), which detaches elementDiv, so re-query it afterward —
            // otherwise getBoundingClientRect() on the detached node returns all zeros
            // and the drag offset math snaps the element to the top-left corner.
            if (state.selectedId !== elementId) {
                state.selectedId = elementId;
                render();
                elementDiv = document.querySelector(`.zine-element[data-element-id="${elementId}"]`);
                if (!elementDiv) return;
            }

            e.preventDefault();

            const rect = elementDiv.getBoundingClientRect();
            const canvasRect = document.getElementById('canvas-content').getBoundingClientRect();

            // Check if Alt key is held for rotation mode
            const isRotationMode = e.altKey;

            state.dragState = {
                elementId: elementId,
                offsetX: e.clientX - rect.left,
                offsetY: e.clientY - rect.top,
                canvasLeft: canvasRect.left,
                canvasTop: canvasRect.top,
                didDrag: false,
                startX: element.x,
                startY: element.y,
                startRotation: element.rotation || 0,
                elementCenterX: element.x + element.w / 2,
                elementCenterY: element.y + element.h / 2,
                isRotationMode: isRotationMode
            };

            // Add global mouse and touch event listeners
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd, { passive: false });

            // Add cursor style to body
            document.body.style.cursor = isRotationMode ? 'grabbing' : 'move';
        }

        function handleMouseMove(e) {
            if (!state.dragState) return;

            const { elementId, offsetX, offsetY, canvasLeft, canvasTop, startX, startY,
                    startRotation, elementCenterX, elementCenterY, isRotationMode } = state.dragState;
            const element = getElementById(elementId);
            if (!element) return;

            if (isRotationMode) {
                // Handle rotation mode (Alt + drag)
                const canvasX = e.clientX - canvasLeft;
                const canvasY = e.clientY - canvasTop;

                // Calculate angle from element center to current mouse position
                const dx = canvasX - elementCenterX;
                const dy = canvasY - elementCenterY;
                let angle = Math.atan2(dy, dx) * (180 / Math.PI);

                // Add 90 degrees to make "up" be 0 degrees
                angle += 90;

                // Normalize angle to 0-360 range
                if (angle < 0) angle += 360;
                if (angle >= 360) angle -= 360;

                // Apply shift key constraint for 15-degree increments
                if (e.shiftKey) {
                    angle = Math.round(angle / 15) * 15;
                }

                // Check if we've moved enough to consider this a drag
                const angleDiff = Math.abs(angle - startRotation);
                if (!state.dragState.didDrag && angleDiff > 2) {
                    state.dragState.didDrag = true;
                }

                // Update element rotation
                updateElement(elementId, { rotation: angle });
            } else {
                // Handle normal position dragging
                const newX = e.clientX - canvasLeft - offsetX;
                const newY = e.clientY - canvasTop - offsetY;

                // Check if we've moved enough to consider this a drag
                const dragThreshold = 3;
                if (!state.dragState.didDrag) {
                    const deltaX = Math.abs(newX - startX);
                    const deltaY = Math.abs(newY - startY);
                    if (deltaX > dragThreshold || deltaY > dragThreshold) {
                        state.dragState.didDrag = true;
                    }
                }

                // Update element position (allow off-canvas positioning)
                updateElement(elementId, { x: newX, y: newY });
            }
        }

        function handleMouseUp() {
            if (state.dragState) {
                // Clear drag state after a brief delay to allow click handler to check it
                setTimeout(() => {
                    state.dragState = null;
                }, 10);
            }

            // Remove global event listeners
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            // Restore cursor
            document.body.style.cursor = '';
        }

        // Resize Handle System
        function addResizeHandles(elementDiv, element) {
            const handlesDiv = document.createElement('div');
            handlesDiv.className = 'resize-handles';

            // Create 8 resize handles (4 corners + 4 edges) + 1 rotation handle
            const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rotate'];

            handles.forEach(position => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${position}`;
                handle.dataset.position = position;
                handle.dataset.elementId = element.id;

                // Add resize event listeners
                handle.addEventListener('mousedown', handleResizeStart);
                handle.addEventListener('touchstart', handleResizeStart, { passive: false });

                handlesDiv.appendChild(handle);
            });

            elementDiv.appendChild(handlesDiv);
        }

        function handleResizeStart(e) {
            e.preventDefault();
            e.stopPropagation();

            const handle = e.target;
            const elementId = parseFloat(handle.dataset.elementId);
            const position = handle.dataset.position;
            const element = getElementById(elementId);

            if (!element) return;

            const elementDiv = document.querySelector(`[data-element-id="${elementId}"]`);
            const canvasRect = document.getElementById('canvas-content').getBoundingClientRect();

            // Get initial mouse/touch position
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

            // Calculate element center for rotation
            const elementCenterX = element.x + element.w / 2;
            const elementCenterY = element.y + element.h / 2;

            state.resizeState = {
                elementId: elementId,
                position: position,
                startX: clientX,
                startY: clientY,
                startElementX: element.x,
                startElementY: element.y,
                startElementW: element.w,
                startElementH: element.h,
                startRotation: element.rotation || 0,
                elementCenterX: elementCenterX,
                elementCenterY: elementCenterY,
                canvasLeft: canvasRect.left,
                canvasTop: canvasRect.top,
                isRotating: position === 'rotate'
            };

            // Add global event listeners for resize
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            document.addEventListener('touchmove', handleResizeMove, { passive: false });
            document.addEventListener('touchend', handleResizeEnd);

            // Update cursor
            document.body.style.cursor = handle.style.cursor;
        }

        function handleResizeMove(e) {
            if (!state.resizeState) return;

            e.preventDefault();

            const { elementId, position, startX, startY, startElementX, startElementY,
                    startElementW, startElementH, startRotation, elementCenterX, elementCenterY,
                    canvasLeft, canvasTop, isRotating } = state.resizeState;

            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

            const element = getElementById(elementId);
            if (!element) return;

            if (isRotating) {
                // Handle rotation
                const canvasX = clientX - canvasLeft;
                const canvasY = clientY - canvasTop;

                // Calculate angle from element center to current mouse position
                const dx = canvasX - elementCenterX;
                const dy = canvasY - elementCenterY;
                let angle = Math.atan2(dy, dx) * (180 / Math.PI);

                // Add 90 degrees to make "up" be 0 degrees (like typical rotation)
                angle += 90;

                // Normalize angle to 0-360 range
                if (angle < 0) angle += 360;
                if (angle >= 360) angle -= 360;

                // Apply shift key constraint for 15-degree increments
                if (e.shiftKey) {
                    angle = Math.round(angle / 15) * 15;
                }

                // Update element rotation
                updateElement(elementId, { rotation: angle });
            } else {
                // Handle regular resize
                const deltaX = clientX - startX;
                const deltaY = clientY - startY;

                // Calculate new dimensions and position based on handle position
                let newX = startElementX;
                let newY = startElementY;
                let newW = startElementW;
                let newH = startElementH;

                // Handle resize based on position
                switch (position) {
                    case 'nw': // Northwest corner
                        newX = startElementX + deltaX;
                        newY = startElementY + deltaY;
                        newW = startElementW - deltaX;
                        newH = startElementH - deltaY;
                        break;
                    case 'n': // North edge
                        newY = startElementY + deltaY;
                        newH = startElementH - deltaY;
                        break;
                    case 'ne': // Northeast corner
                        newY = startElementY + deltaY;
                        newW = startElementW + deltaX;
                        newH = startElementH - deltaY;
                        break;
                    case 'e': // East edge
                        newW = startElementW + deltaX;
                        break;
                    case 'se': // Southeast corner
                        newW = startElementW + deltaX;
                        newH = startElementH + deltaY;
                        break;
                    case 's': // South edge
                        newH = startElementH + deltaY;
                        break;
                    case 'sw': // Southwest corner
                        newX = startElementX + deltaX;
                        newW = startElementW - deltaX;
                        newH = startElementH + deltaY;
                        break;
                    case 'w': // West edge
                        newX = startElementX + deltaX;
                        newW = startElementW - deltaX;
                        break;
                }

                // Apply minimum size constraints
                const minSize = 20;
                if (newW < minSize) {
                    if (position.includes('w')) newX = startElementX + startElementW - minSize;
                    newW = minSize;
                }
                if (newH < minSize) {
                    if (position.includes('n')) newY = startElementY + startElementH - minSize;
                    newH = minSize;
                }

                // Update element (allow off-canvas positioning)
                updateElement(elementId, { x: newX, y: newY, w: newW, h: newH });
            }
        }

        function handleResizeEnd() {
            if (state.resizeState) {
                state.resizeState = null;
            }

            // Remove global event listeners
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
            document.removeEventListener('touchmove', handleResizeMove);
            document.removeEventListener('touchend', handleResizeEnd);

            // Restore cursor
            document.body.style.cursor = '';
        }

        // Touch Support for Mobile
        function handleTouchStart(e) {
            if (e.touches.length !== 1) return;

            e.preventDefault();
            const touch = e.touches[0];

            // Create a synthetic mouse event
            const syntheticEvent = {
                target: e.target,
                clientX: touch.clientX,
                clientY: touch.clientY,
                altKey: e.touches.length === 2, // Two finger touch = rotation mode
                shiftKey: false,
                preventDefault: () => e.preventDefault()
            };

            handleMouseDown(syntheticEvent);
        }

        function handleTouchMove(e) {
            if (e.touches.length !== 1) return;

            e.preventDefault();
            const touch = e.touches[0];

            // Create a synthetic mouse event
            const syntheticEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                altKey: e.touches.length === 2,
                shiftKey: false
            };

            handleMouseMove(syntheticEvent);
        }

        function handleTouchEnd(e) {
            e.preventDefault();
            handleMouseUp();
        }


        // Properties Panel

        function renderProperties() {
            const panel = document.getElementById('properties-panel');
            if (!state.selectedId) {
                panel.classList.remove('show');
                return;
            }

            const element = getElementById(state.selectedId);
            if (!element) {
                panel.classList.remove('show');
                return;
            }

            panel.classList.add('show');

            const isText = element.type === 'text';
            const isImage = element.type === 'image';

            panel.innerHTML = `
                <h3>${isText ? 'Text' : 'Image'} Properties</h3>

                <div class="property-group">
                    <label>Position & Size</label>
                    <div class="property-row">
                        <input type="number" class="property-input" id="prop-x" value="${Math.round(element.x)}">
                        <input type="number" class="property-input" id="prop-y" value="${Math.round(element.y)}">
                    </div>
                    <div class="property-row">
                        <input type="number" class="property-input" id="prop-w" value="${Math.round(element.w)}" min="10">
                        <input type="number" class="property-input" id="prop-h" value="${Math.round(element.h)}" min="10">
                    </div>
                </div>

                <div class="property-group">
                    <label>Rotation</label>
                    <div class="slider-container">
                        <input type="range" class="property-slider" id="prop-rotation" value="${element.rotation.toFixed(1)}" min="-180" max="180" step="1">
                        <span class="slider-value">${element.rotation.toFixed(0)}°</span>
                    </div>
                </div>

                ${isText ? `
                    <div class="property-group">
                        <label>Font Family</label>
                        <div class="font-live-preview" id="font-live-preview" style="margin-bottom: 8px;">
                            <div class="preview-text" style="font-family: ${element.font}, 'Liberation Mono', monospace; font-size: 14px; color: ${element.color}; font-weight: ${element.bold ? 'bold' : 'normal'}; font-style: ${element.italic ? 'italic' : 'normal'}; text-align: ${element.align}; padding: 6px; background: #f9f9f9; border-radius: 3px; min-height: 20px;">
                                ${element.content || 'Click to edit'}
                            </div>
                        </div>
                        <select class="property-input font-preview-select" id="prop-font">
                            ${generateOrganizedFontOptions(element.font)}
                        </select>
                    </div>

                    <div class="property-group">
                        <label>Font Size</label>
                        <div class="slider-container">
                            <input type="range" class="property-slider" id="prop-fontsize" value="${element.fontSize}" min="8" max="144" step="1">
                            <span class="slider-value">${element.fontSize}px</span>
                        </div>
                    </div>

                    <div class="property-group">
                        <label>Text Color</label>
                        <input type="color" class="property-input" id="prop-color" value="${element.color}">
                    </div>

                    <div class="property-group">
                        <label>Text Style</label>
                        <div class="property-row">
                            <label style="display: flex; align-items: center; font-size: 11px; margin-bottom: 0;">
                                <input type="checkbox" id="prop-bold" ${element.bold ? 'checked' : ''} style="margin-right: 5px;">
                                Bold
                            </label>
                            <label style="display: flex; align-items: center; font-size: 11px; margin-bottom: 0;">
                                <input type="checkbox" id="prop-italic" ${element.italic ? 'checked' : ''} style="margin-right: 5px;">
                                Italic
                            </label>
                        </div>
                    </div>

                    <div class="property-group">
                        <label>Text Alignment</label>
                        <select class="property-input" id="prop-align">
                            <option value="left" ${element.align === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${element.align === 'center' ? 'selected' : ''}>Center</option>
                            <option value="right" ${element.align === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </div>
                ` : ''}

                ${isImage ? `
                    <div class="property-group">
                        <label>Alt Text (Accessibility)</label>
                        <input type="text" class="property-input" id="prop-alt" value="${element.alt || ''}" placeholder="Describe this image">
                    </div>

                    <div class="property-group">
                        <label>Filter</label>
                        <select class="property-input" id="prop-filter">
                            <option value="none" ${element.filter === 'none' ? 'selected' : ''}>None</option>
                            <option value="grayscale(1)" ${element.filter === 'grayscale(1)' ? 'selected' : ''}>Grayscale</option>
                            <option value="contrast(2) grayscale(1)" ${element.filter === 'contrast(2) grayscale(1)' ? 'selected' : ''}>High Contrast</option>
                        </select>
                    </div>
                ` : ''}

                ${element.type === 'texture' || element.type === 'background' || element.type === 'background-image' ? `
                    <div class="property-group">
                        <label>Opacity</label>
                        <input type="range" class="property-input" id="prop-opacity" min="0" max="1" step="0.1" value="${element.opacity || 1}">
                        <span style="font-size: 10px; color: #666;">${Math.round((element.opacity || 1) * 100)}%</span>
                    </div>

                    <div class="property-group">
                        <label>Blend Mode</label>
                        <select class="property-input" id="prop-blendmode">
                            <option value="normal" ${element.blendMode === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="multiply" ${element.blendMode === 'multiply' ? 'selected' : ''}>Multiply</option>
                            <option value="overlay" ${element.blendMode === 'overlay' ? 'selected' : ''}>Overlay</option>
                            <option value="screen" ${element.blendMode === 'screen' ? 'selected' : ''}>Screen</option>
                            <option value="soft-light" ${element.blendMode === 'soft-light' ? 'selected' : ''}>Soft Light</option>
                            <option value="hard-light" ${element.blendMode === 'hard-light' ? 'selected' : ''}>Hard Light</option>
                            <option value="color-burn" ${element.blendMode === 'color-burn' ? 'selected' : ''}>Color Burn</option>
                            <option value="color-dodge" ${element.blendMode === 'color-dodge' ? 'selected' : ''}>Color Dodge</option>
                        </select>
                    </div>
                ` : ''}

                ${element.type === 'background' ? `
                    <div class="property-group">
                        <label>Background Color</label>
                        <input type="color" class="property-input" id="prop-bgcolor" value="${element.color || '#f5f5f0'}">
                    </div>
                ` : ''}

                <div class="property-group">
                    <label>Layer Order</label>
                    <div class="property-row">
                        <button class="btn btn-tertiary" id="prop-bring-forward" style="flex: 1;">Forward</button>
                        <button class="btn btn-tertiary" id="prop-send-backward" style="flex: 1;">Backward</button>
                    </div>
                    <div class="property-row">
                        <button class="btn btn-tertiary" id="prop-bring-front" style="flex: 1;">To Front</button>
                        <button class="btn btn-tertiary" id="prop-send-back" style="flex: 1;">To Back</button>
                    </div>
                </div>

                <div class="property-group" style="margin-top: 20px;">
                    <button class="btn" id="delete-element-btn" style="width: 100%; background: #e74c3c; border-color: #e74c3c; color: white;">
                        Delete Element
                    </button>
                </div>
            `;

            // Add event listeners for property changes
            addPropertyEventListeners();
        }

        function addPropertyEventListeners() {
            const updateProperty = (property, value) => {
                if (state.selectedId) {
                    updateElement(state.selectedId, { [property]: value });
                }
            };

            // Position and size (allow off-canvas positioning)
            document.getElementById('prop-x')?.addEventListener('change', (e) =>
                updateProperty('x', parseInt(e.target.value) || 0));
            document.getElementById('prop-y')?.addEventListener('change', (e) =>
                updateProperty('y', parseInt(e.target.value) || 0));
            document.getElementById('prop-w')?.addEventListener('change', (e) =>
                updateProperty('w', Math.max(10, parseInt(e.target.value) || 10)));
            document.getElementById('prop-h')?.addEventListener('change', (e) =>
                updateProperty('h', Math.max(10, parseInt(e.target.value) || 10)));
            document.getElementById('prop-rotation')?.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value) || 0;
                // Update element directly without triggering full render
                const element = getElementById(state.selectedId);
                if (element) {
                    element.rotation = value;
                    // Only update the canvas, not the properties panel
                    renderCanvas();
                    renderAccessibility();
                }
                // Update display value
                const span = e.target.nextElementSibling;
                if (span) span.textContent = Math.round(value) + '°';
            });

            // Text properties
            document.getElementById('prop-font')?.addEventListener('change', (e) => {
                updateProperty('font', e.target.value);
                updateFontPreview();
            });
            document.getElementById('prop-fontsize')?.addEventListener('input', (e) => {
                const value = Math.max(8, Math.min(144, parseInt(e.target.value) || 16));
                // Update element directly without triggering full render
                const element = getElementById(state.selectedId);
                if (element) {
                    element.fontSize = value;
                    // Only update the canvas and font preview, not the properties panel
                    renderCanvas();
                    renderAccessibility();
                    updateFontPreview();
                }
                // Update display value
                const span = e.target.nextElementSibling;
                if (span) span.textContent = value + 'px';
            });
            document.getElementById('prop-color')?.addEventListener('change', (e) => {
                updateProperty('color', e.target.value);
                updateFontPreview();
            });
            document.getElementById('prop-bold')?.addEventListener('change', (e) => {
                updateProperty('bold', e.target.checked);
                updateFontPreview();
            });
            document.getElementById('prop-italic')?.addEventListener('change', (e) => {
                updateProperty('italic', e.target.checked);
                updateFontPreview();
            });
            document.getElementById('prop-align')?.addEventListener('change', (e) => {
                updateProperty('align', e.target.value);
                updateFontPreview();
            });

            // Image properties
            document.getElementById('prop-alt')?.addEventListener('change', (e) =>
                updateProperty('alt', e.target.value));
            document.getElementById('prop-filter')?.addEventListener('change', (e) =>
                updateProperty('filter', e.target.value));

            document.getElementById('prop-opacity')?.addEventListener('input', (e) => {
                updateProperty('opacity', parseFloat(e.target.value));
                // Update display text
                const span = e.target.nextElementSibling;
                if (span) span.textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
            });
            document.getElementById('prop-blendmode')?.addEventListener('change', (e) =>
                updateProperty('blendMode', e.target.value));
            document.getElementById('prop-bgcolor')?.addEventListener('change', (e) =>
                updateProperty('color', e.target.value));

            // Layer order buttons
            document.getElementById('prop-bring-forward')?.addEventListener('click', () => {
                if (state.selectedId) reorderElement(state.selectedId, 'forward');
            });
            document.getElementById('prop-send-backward')?.addEventListener('click', () => {
                if (state.selectedId) reorderElement(state.selectedId, 'backward');
            });
            document.getElementById('prop-bring-front')?.addEventListener('click', () => {
                if (state.selectedId) reorderElement(state.selectedId, 'front');
            });
            document.getElementById('prop-send-back')?.addEventListener('click', () => {
                if (state.selectedId) reorderElement(state.selectedId, 'back');
            });

            // Delete button
            document.getElementById('delete-element-btn')?.addEventListener('click', () => {
                if (state.selectedId) {
                    deleteElement(state.selectedId);
                }
            });
        }

        // Accessibility Checking System

        function renderAccessibility() {
            const page = getCurrentPage();
            const checks = runAccessibilityChecks(page);

            // Update summary
            const summary = document.getElementById('accessibility-summary');
            const errors = checks.filter(c => c.level === 'error').length;
            const warnings = checks.filter(c => c.level === 'warning').length;
            const passes = checks.filter(c => c.level === 'pass').length;

            summary.textContent = `${errors} error${errors !== 1 ? 's' : ''} · ${warnings} warning${warnings !== 1 ? 's' : ''} · ${passes} passed`;

            // Update checks list
            const checksContainer = document.getElementById('accessibility-checks');
            checksContainer.innerHTML = '';

            checks.forEach(check => {
                const item = document.createElement('div');
                item.className = 'check-item';

                item.innerHTML = `
                    <div class="check-status ${check.level}"></div>
                    <div class="check-message">${check.message}</div>
                    ${check.elementId ? `<button class="check-select" data-element-id="${check.elementId}">Select</button>` : ''}
                `;

                checksContainer.appendChild(item);
            });

            // Add event listeners for select buttons
            checksContainer.querySelectorAll('.check-select').forEach(btn => {
                btn.addEventListener('click', () => {
                    const elementId = parseFloat(btn.dataset.elementId);
                    state.selectedId = elementId;
                    render();
                });
            });
        }

        function runAccessibilityChecks(page) {
            const checks = [];
            const elements = getAllElements();

            elements.forEach(element => {
                // Check for empty/placeholder text
                if (element.type === 'text') {
                    if (!element.content || element.content.trim() === '' || element.content === 'Click to edit') {
                        checks.push({
                            level: 'warning',
                            elementId: element.id,
                            message: 'Placeholder text not replaced'
                        });
                    } else {
                        checks.push({
                            level: 'pass',
                            elementId: element.id,
                            message: 'Text content is present'
                        });
                    }

                    // Check font size
                    if (element.fontSize < 12) {
                        checks.push({
                            level: 'warning',
                            elementId: element.id,
                            message: `Font size ${element.fontSize}px may be too small at print scale`
                        });
                    } else {
                        checks.push({
                            level: 'pass',
                            elementId: element.id,
                            message: `Font size ${element.fontSize}px is adequate`
                        });
                    }

                    // Check contrast
                    const contrast = calculateContrastRatio(element.color, '#f8f8f0');
                    if (contrast < 4.5) {
                        checks.push({
                            level: 'error',
                            elementId: element.id,
                            message: `Contrast ratio ${contrast.toFixed(1)}:1 fails WCAG AA (need 4.5:1)`
                        });
                    } else if (contrast < 7) {
                        checks.push({
                            level: 'warning',
                            elementId: element.id,
                            message: `Contrast ratio ${contrast.toFixed(1)}:1 meets AA but not AAA standards`
                        });
                    } else {
                        checks.push({
                            level: 'pass',
                            elementId: element.id,
                            message: `Contrast ratio ${contrast.toFixed(1)}:1 meets WCAG AAA standards`
                        });
                    }
                }

                // Check for missing alt text on images
                if (element.type === 'image') {
                    if (!element.alt || element.alt.trim() === '') {
                        checks.push({
                            level: 'warning',
                            elementId: element.id,
                            message: 'No description provided for this image'
                        });
                    } else {
                        checks.push({
                            level: 'pass',
                            elementId: element.id,
                            message: 'Image has accessibility description'
                        });
                    }
                }

                // Check margins (content outside safe area)
                const marginCheck = checkMargins(element);
                if (!marginCheck.left || !marginCheck.right || !marginCheck.top || !marginCheck.bottom) {
                    const sides = [];
                    if (!marginCheck.left) sides.push('left');
                    if (!marginCheck.right) sides.push('right');
                    if (!marginCheck.top) sides.push('top');
                    if (!marginCheck.bottom) sides.push('bottom');

                    checks.push({
                        level: 'warning',
                        elementId: element.id,
                        message: `Content extends outside margin on ${sides.join(', ')} side${sides.length > 1 ? 's' : ''} - may be cut during printing`
                    });
                } else {
                    checks.push({
                        level: 'pass',
                        elementId: element.id,
                        message: 'Element within safe margins'
                    });
                }
            });

            // Check for overlapping text elements
            const textElements = elements.filter(el => el.type === 'text');
            for (let i = 0; i < textElements.length; i++) {
                for (let j = i + 1; j < textElements.length; j++) {
                    if (elementsOverlap(textElements[i], textElements[j])) {
                        checks.push({
                            level: 'warning',
                            elementId: textElements[i].id,
                            message: 'Text blocks overlap - may be unreadable'
                        });
                        break;
                    }
                }
            }

            return checks;
        }

        function calculateContrastRatio(color1, color2) {
            const l1 = getRelativeLuminance(color1);
            const l2 = getRelativeLuminance(color2);
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
        }

        function getRelativeLuminance(color) {
            // Convert hex to RGB
            const r = parseInt(color.slice(1, 3), 16) / 255;
            const g = parseInt(color.slice(3, 5), 16) / 255;
            const b = parseInt(color.slice(5, 7), 16) / 255;

            // Apply gamma correction
            const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
            const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
            const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

            // Calculate relative luminance
            return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        }

        function checkMargins(element) {
            const margin = 24; // Required margin in pixels

            // Get canvas dimensions based on current format
            let canvasWidth, canvasHeight;
            if (state.pageFormat === 'single-page' || state.pageFormat === 'stapled') {
                // Landscape single-page formats: 11" × 8.5" = 1056 × 816 pixels
                canvasWidth = 1056;
                canvasHeight = 816;
            } else {
                // Half-letter format: 5.5" × 8.5" = 528 × 816 pixels
                canvasWidth = 528;
                canvasHeight = 816;
            }

            return {
                left: element.x >= margin,
                right: element.x + element.w <= canvasWidth - margin,
                top: element.y >= margin,
                bottom: element.y + element.h <= canvasHeight - margin
            };
        }

        function elementsOverlap(el1, el2) {
            return !(el1.x + el1.w <= el2.x ||
                     el2.x + el2.w <= el1.x ||
                     el1.y + el1.h <= el2.y ||
                     el2.y + el2.h <= el1.y);
        }

        // Digital Preview System
        function openDigitalPreview() {
            const modal = document.getElementById('preview-modal');
            const container = document.getElementById('preview-pages');

            // Clear previous preview
            container.innerHTML = '';

            // Render all pages
            state.pages.forEach((page, index) => {
                const pageDiv = document.createElement('div');
                pageDiv.className = 'preview-page';

                // Get all elements for this page using new layer system
                const allElements = [];

                // Add elements from layers (new system)
                if (page.layers) {
                    const layerOrder = ['background', 'content', 'overlay'];
                    layerOrder.forEach(layerType => {
                        if (page.layers[layerType]) {
                            allElements.push(...page.layers[layerType]);
                        }
                    });
                }

                // Add elements from old system for backward compatibility
                if (page.elements && page.elements.length > 0) {
                    allElements.push(...page.elements);
                }

                // Create elements for this page
                allElements.forEach(element => {
                    const elementDiv = document.createElement('div');
                    elementDiv.style.position = 'absolute';
                    elementDiv.style.left = element.x + 'px';
                    elementDiv.style.top = element.y + 'px';
                    elementDiv.style.width = element.w + 'px';
                    elementDiv.style.height = element.h + 'px';
                    elementDiv.style.transform = `rotate(${element.rotation || 0}deg)`;

                    // Apply layer-specific styling
                    if (element.layer === 'overlay') {
                        elementDiv.style.mixBlendMode = element.blendMode || 'multiply';
                        elementDiv.style.opacity = element.opacity || 0.3;
                    } else if (element.layer === 'background') {
                        elementDiv.style.opacity = element.opacity || 0.8;
                        if (element.blendMode) {
                            elementDiv.style.mixBlendMode = element.blendMode;
                        }
                    }

                    // Render element content based on type
                    if (element.type === 'text') {
                        elementDiv.innerHTML = `<div style="
                            font-family: ${element.font}, Liberation Mono, monospace;
                            font-size: ${element.fontSize}px;
                            color: ${element.color};
                            font-weight: ${element.bold ? 'bold' : 'normal'};
                            font-style: ${element.italic ? 'italic' : 'normal'};
                            text-align: ${element.align};
                            line-height: 1.2;
                            padding: 4px;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                            width: 100%;
                            height: 100%;
                        ">${element.content}</div>`;
                    } else if (element.type === 'image') {
                        elementDiv.innerHTML = `<img src="${element.src}" alt="${element.alt || ''}" style="
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                            ${element.filter && element.filter !== 'none' ? `filter: ${element.filter};` : ''}
                        ">`;
                    } else if (element.type === 'texture') {
                        elementDiv.innerHTML = `<img src="${element.src}" alt="${element.alt || ''}" style="
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        ">`;
                    } else if (element.type === 'background') {
                        elementDiv.innerHTML = `<div style="
                            width: 100%;
                            height: 100%;
                            background-color: ${element.color || '#f5f5f0'};
                        "></div>`;
                    } else if (element.type === 'background-image') {
                        elementDiv.innerHTML = `<img src="${element.src}" alt="${element.alt || ''}" style="
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        ">`;
                    }

                    pageDiv.appendChild(elementDiv);
                });

                container.appendChild(pageDiv);

                // Add page number
                const pageNumber = document.createElement('div');
                pageNumber.className = 'preview-page-number';
                pageNumber.textContent = `Page ${index + 1}`;
                container.appendChild(pageNumber);
            });

            // Show modal
            modal.classList.add('show');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }

        function closeDigitalPreview() {
            const modal = document.getElementById('preview-modal');
            modal.classList.remove('show');
            document.body.style.overflow = ''; // Restore background scrolling
        }

        function renderPageTabs() {
            const container = document.getElementById('page-tabs');
            container.innerHTML = '';

            state.pages.forEach((page, index) => {
                const tab = document.createElement('button');
                tab.className = 'page-tab';
                tab.textContent = `Page ${index + 1}`;
                tab.dataset.page = index;

                if (index === state.currentPage) {
                    tab.classList.add('active');
                }

                tab.addEventListener('click', () => {
                    state.currentPage = index;
                    state.selectedId = null;
                    state.editingId = null;
                    render();
                });

                container.appendChild(tab);
            });
        }

        function updateToolStates() {
            const deleteBtn = document.getElementById('delete-btn');
            deleteBtn.disabled = !state.selectedId;

            // Disable add/remove page buttons for single-page formats
            const addPageBtn = document.getElementById('add-page-btn');
            const removePageBtn = document.getElementById('remove-page-btn');

            const isSinglePageFormat = state.pageFormat === 'single-page' || state.pageFormat === 'stapled';

            if (addPageBtn) addPageBtn.disabled = isSinglePageFormat;
            if (removePageBtn) removePageBtn.disabled = isSinglePageFormat || state.pages.length <= 1;
        }

document.addEventListener('DOMContentLoaded', async function () {
    await initializeFonts();
    render();
    populateFontCredits();
    setupCreditsToggle();
    initializeEventListeners();
    Export.init();
    Generator.init();   // added in Task 8
    Gallery.init();     // added in Task 9
    Clipart.init();
    Photos.init();
});
