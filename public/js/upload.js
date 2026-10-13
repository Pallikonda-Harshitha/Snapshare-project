document.addEventListener('DOMContentLoaded', async () => {
  await App.requireLogin();

  const MAX_SIZE = 10 * 1024 * 1024;
  const MAX_IMAGES = 10;
  const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('file');
  const dropzone = document.getElementById('dropzone');
  const hint = document.getElementById('drop-hint');
  const previews = document.getElementById('previews');
  const errorBox = document.getElementById('error');
  const submit = document.getElementById('submit');
  const submitLabel = document.getElementById('submit-label');

  let files = []; // the first one is the cover

  const showError = (msg) => {
    errorBox.textContent = msg;
    errorBox.classList.toggle('d-none', !msg);
  };

  const [{ categories }, { albums }] = await Promise.all([App.api('/api/meta'), App.api('/api/albums')]);
  document.getElementById('category').innerHTML = categories
    .map((c) => `<option ${c === 'Other' ? 'selected' : ''}>${App.esc(c)}</option>`)
    .join('');
  document.getElementById('albumId').insertAdjacentHTML(
    'beforeend',
    albums.map((a) => `<option value="${App.esc(a.id)}">${App.esc(a.name)}</option>`).join('')
  );
  const wanted = new URLSearchParams(location.search).get('album');
  if (wanted) document.getElementById('albumId').value = wanted;

  let urls = [];
  function renderPreviews() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = files.map((f) => URL.createObjectURL(f));

    hint.classList.toggle('d-none', files.length > 0);
    previews.classList.toggle('d-none', files.length === 0);
    submitLabel.textContent = files.length > 1 ? `Publish post (${files.length} photos)` : 'Publish post';

    previews.innerHTML =
      files
        .map(
          (f, i) => `
          <div class="preview-item">
            <img src="${urls[i]}" alt="Photo ${i + 1}: ${App.esc(f.name)}">
            ${i === 0 ? '<span class="cover-tag">Cover</span>' : ''}
            <button type="button" class="remove" data-remove="${i}" aria-label="Remove photo ${i + 1}"><i class="bi bi-x-lg"></i></button>
          </div>`
        )
        .join('') +
      (files.length < MAX_IMAGES
        ? `<button type="button" class="preview-add" id="add-more"><i class="bi bi-plus-lg"></i>Add more<span class="small fw-normal text-secondary">${files.length} of ${MAX_IMAGES}</span></button>`
        : '');
  }

  function addFiles(list) {
    showError('');
    const incoming = [...list];
    const skipped = [];
    for (const file of incoming) {
      if (files.length >= MAX_IMAGES) {
        skipped.push(`${file.name} (a post holds up to ${MAX_IMAGES} photos)`);
        continue;
      }
      if (!TYPES.includes(file.type)) {
        skipped.push(`${file.name} (not a JPEG, PNG, WebP or GIF)`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        skipped.push(`${file.name} (larger than 10 MB)`);
        continue;
      }
      files.push(file);
    }
    if (skipped.length) showError('Skipped: ' + skipped.join(', '));

    const title = document.getElementById('title');
    if (!title.value && files.length) title.value = files[0].name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    renderPreviews();
  }

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('[data-remove]') || e.target.closest('#choose')) return;
    fileInput.click();
  });
  document.getElementById('choose').addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  fileInput.addEventListener('click', (e) => e.stopPropagation());
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  previews.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      files.splice(Number(remove.dataset.remove), 1);
      renderPreviews();
    }
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag');
    })
  );
  dropzone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showError('');
    if (!files.length) return showError('Choose at least one photo first.');
    const title = document.getElementById('title').value.trim();
    if (!title) return showError('Add a title.');

    const data = new FormData();
    data.append('title', title);
    data.append('description', document.getElementById('description').value);
    data.append('tags', document.getElementById('tags').value);
    data.append('category', document.getElementById('category').value);
    data.append('albumId', document.getElementById('albumId').value);
    data.append('visibility', form.visibility.value);
    files.forEach((f) => data.append('images', f));

    const bar = document.getElementById('progress');
    document.getElementById('progress-wrap').classList.remove('d-none');
    submit.disabled = true;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/photos');
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) bar.style.width = Math.round((ev.loaded / ev.total) * 100) + '%';
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 201) {
        location.href = '/photo.html?id=' + encodeURIComponent(body.photo.id);
      } else {
        showError(body.error || 'Upload failed. Try again.');
        submit.disabled = false;
      }
    };
    xhr.onerror = () => {
      showError('Network error. Check your connection and try again.');
      submit.disabled = false;
    };
    xhr.send(data);
  });
});
