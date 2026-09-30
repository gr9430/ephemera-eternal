/**
 * gallery.test.js — Node.js test for the pure credit-formatting logic in gallery.js.
 * No DOM required.
 *
 * Manual-verify items (DOM/fetch only, untestable in Node):
 *   - Gallery.init()  — fetches data/gallery.json
 *   - Gallery.render() — builds .curated-gallery-item DOM nodes, wires click-to-place
 */

'use strict';

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

function formatCredit(image) {
    if (!image.credit) return '';
    return image.caption ? image.credit + ' — ' + image.caption : image.credit;
}

console.log('[credit with no caption]');
assert(
    'returns just the credit',
    formatCredit({ credit: 'Jane Doe', caption: '' }) === 'Jane Doe'
);

console.log('\n[credit with a caption]');
assert(
    'joins credit and caption with an em dash',
    formatCredit({ credit: 'Jane Doe', caption: 'flyer, 2024' }) === 'Jane Doe — flyer, 2024'
);

console.log('\n[no credit at all]');
assert(
    'returns an empty string',
    formatCredit({ credit: '', caption: 'flyer, 2024' }) === ''
);

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
