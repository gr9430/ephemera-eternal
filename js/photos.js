// photos.js — curated, permission-cleared photo panel (Adam Goldman's photos).
// No participant upload in this panel; images come only from data/photos.json.
// Places whole photos on the canvas (not cut into pieces, unlike clipart.js).

function photoTitle(photo) {
    return photo.credit || photo.alt;
}

const Photos = {
    init: function () {
        fetch('data/photos.json')
            .then(r => r.json())
            .then(data => {
                state.photoImages = data;
                this.render();
            })
            .catch(() => {
                state.photoImages = [];
                this.render();
            });
    },

    render: function () {
        const container = document.getElementById('photos-gallery');
        container.innerHTML = '';
        (state.photoImages || []).forEach(photo => {
            const item = document.createElement('div');
            item.className = 'clipart-item';
            item.title = photoTitle(photo);

            const img = document.createElement('img');
            img.className = 'photo-thumb';
            img.src = photo.src;
            img.alt = photo.alt;
            item.appendChild(img);

            const credit = document.createElement('span');
            credit.className = 'curated-gallery-credit';
            credit.textContent = photo.credit;
            item.appendChild(credit);

            item.addEventListener('click', () => this.place(photo));
            container.appendChild(item);
        });
    },

    place: function (photo) {
        const put = (size) => {
            const element = createImageElement(100, 100, photo.src, photo.alt);
            if (size) { element.w = size.w; element.h = size.h; }
            addElement(element);
        };
        const probe = new Image();
        probe.onload = () => put(fitWithin(probe.naturalWidth, probe.naturalHeight, CLIPART_START_MAX));
        probe.onerror = () => put(null);
        probe.src = photo.src;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { photoTitle };
}
