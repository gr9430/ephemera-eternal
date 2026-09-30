// gallery.js — curated, permission-cleared image gallery panel.
// No participant upload in this panel; images come only from data/gallery.json.

function formatCredit(image) {
    if (!image.credit) return '';
    return image.caption ? image.credit + ' — ' + image.caption : image.credit;
}

const Gallery = {
    init: function () {
        fetch('data/gallery.json')
            .then(r => r.json())
            .then(data => {
                state.galleryImages = data;
                this.render();
            })
            .catch(() => {
                state.galleryImages = [];
                this.render();
            });
    },

    render: function () {
        const container = document.getElementById('curated-gallery');
        container.innerHTML = '';
        (state.galleryImages || []).forEach(image => {
            const item = document.createElement('div');
            item.className = 'gallery-item curated-gallery-item';
            item.title = formatCredit(image) || image.alt;

            const img = document.createElement('img');
            img.src = image.src;
            img.alt = image.alt;
            img.style.width = '72px';
            img.style.height = '96px';
            img.style.objectFit = 'cover';
            item.appendChild(img);

            const credit = document.createElement('span');
            credit.className = 'curated-gallery-credit';
            credit.textContent = formatCredit(image);
            item.appendChild(credit);

            item.addEventListener('click', () => {
                const element = createImageElement(100, 100, image.src, image.alt);
                addElement(element);
            });

            container.appendChild(item);
        });
    }
};
