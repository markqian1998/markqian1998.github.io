const NOTES_INDEX_URL = '/content/market-notes/notes.json';

const getSlugFromPath = () => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('market-notes');
  if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  return null;
};

const normalizeTag = (tag) => tag.trim();

const renderFilters = (container, tags, onSelect) => {
  container.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.textContent = 'All';
  allBtn.dataset.tag = 'all';
  container.appendChild(allBtn);

  tags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = tag;
    btn.dataset.tag = tag;
    container.appendChild(btn);
  });

  container.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    container.querySelectorAll('button').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');
    onSelect(btn.dataset.tag);
  });
};

const renderNotesList = (notes, container) => {
  container.innerHTML = '';
  if (!notes.length) {
    const empty = document.createElement('p');
    empty.className = 'notes-empty';
    empty.textContent = 'No notes yet.';
    container.appendChild(empty);
    return;
  }

  notes.forEach((note) => {
    const item = document.createElement('article');
    item.className = 'notes-item';
    item.dataset.tags = note.tags.join(',');

    const date = document.createElement('div');
    date.className = 'notes-date';
    date.textContent = note.date;

    const title = document.createElement('a');
    title.className = 'notes-title';
    title.href = `/market-notes/${note.slug}/`;
    title.textContent = note.title;

    const excerpt = document.createElement('p');
    excerpt.className = 'notes-excerpt';
    excerpt.textContent = note.excerpt;

    const tags = document.createElement('div');
    tags.className = 'notes-tags';
    note.tags.forEach((tag) => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.textContent = tag;
      tags.appendChild(pill);
    });

    item.appendChild(date);
    item.appendChild(title);
    item.appendChild(excerpt);
    item.appendChild(tags);
    container.appendChild(item);
  });
};

const loadNotesIndex = async () => {
  const response = await fetch(NOTES_INDEX_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error('Failed to load notes index');
  const data = await response.json();
  return (data.notes || []).sort((a, b) => b.date.localeCompare(a.date));
};

const setupIndexPage = async () => {
  const listEl = document.getElementById('notes-list');
  const filtersEl = document.getElementById('notes-filters');
  if (!listEl || !filtersEl) return;

  try {
    const notes = await loadNotesIndex();
    const tags = Array.from(new Set(notes.flatMap((note) => note.tags.map(normalizeTag))));
    renderNotesList(notes, listEl);
    renderFilters(filtersEl, tags, (tag) => {
      const filtered = tag === 'all'
        ? notes
        : notes.filter((note) => note.tags.map(normalizeTag).includes(tag));
      renderNotesList(filtered, listEl);
    });
  } catch (err) {
    listEl.innerHTML = '<p class="notes-empty">Notes unavailable.</p>';
  }
};

const renderNoteMeta = (note) => {
  const titleEl = document.getElementById('note-title');
  const dateEl = document.getElementById('note-date');
  const tagsEl = document.getElementById('note-tags');
  if (!titleEl || !dateEl || !tagsEl) return;

  titleEl.textContent = note.title || 'Market Note';
  dateEl.textContent = note.date || '';
  tagsEl.innerHTML = '';
  (note.tags || []).forEach((tag) => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.textContent = tag;
    tagsEl.appendChild(pill);
  });
};

const renderNoteNav = (notes, slug) => {
  const navEl = document.getElementById('note-nav');
  if (!navEl) return;
  navEl.innerHTML = '';

  const idx = notes.findIndex((note) => note.slug === slug);
  if (idx === -1) return;

  const prev = notes[idx + 1];
  const next = notes[idx - 1];

  if (prev) {
    const prevLink = document.createElement('a');
    prevLink.className = 'note-nav-link';
    prevLink.href = `/market-notes/${prev.slug}/`;
    prevLink.innerHTML = `<span class="note-nav-label">Previous</span><span>${prev.title}</span>`;
    navEl.appendChild(prevLink);
  }

  if (next) {
    const nextLink = document.createElement('a');
    nextLink.className = 'note-nav-link';
    nextLink.href = `/market-notes/${next.slug}/`;
    nextLink.innerHTML = `<span class="note-nav-label">Next</span><span>${next.title}</span>`;
    navEl.appendChild(nextLink);
  }
};

const enhanceNoteContent = (container, slug) => {
  container.querySelectorAll('p').forEach((p) => {
    const text = p.textContent.trim().toLowerCase();
    if (text.startsWith('my read:')) {
      p.classList.add('note-callout');
    }
  });

  container.querySelectorAll('img').forEach((img) => {
    const caption = img.getAttribute('title') || img.getAttribute('alt');
    const isWrapped = img.parentElement && img.parentElement.tagName.toLowerCase() === 'figure';
    if (isWrapped) return;

    const figure = document.createElement('figure');
    figure.className = 'note-figure';
    img.replaceWith(figure);
    figure.appendChild(img);

    if (caption) {
      const figcaption = document.createElement('figcaption');
      figcaption.textContent = caption;
      figure.appendChild(figcaption);
    }
  });
};

const setupNotePage = async () => {
  const contentEl = document.getElementById('note-content');
  if (!contentEl) return;

  const slug = getSlugFromPath();
  if (!slug) return;

  try {
    const notes = await loadNotesIndex();
    const note = notes.find((item) => item.slug === slug) || { slug };
    renderNoteMeta(note);
    renderNoteNav(notes, slug);

    const mdUrl = `/content/market-notes/${slug}/index.md`;
    const response = await fetch(mdUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Failed to load note');
    const markdown = await response.text();

    if (typeof marked === 'undefined') {
      throw new Error('marked.js failed to load');
    }

    const renderer = {
      image(token) {
        const href = token.href || '';
        const isExternal = /^https?:\/\//i.test(href) || href.startsWith('/');
        const src = isExternal ? href : `/content/market-notes/${slug}/${href}`;
        const alt = token.text || '';
        const caption = token.title || token.text || '';
        const captionHtml = caption ? `<figcaption>${caption}</figcaption>` : '';
        return `<figure class="note-figure"><img src="${src}" alt="${alt}" loading="lazy" />${captionHtml}</figure>`;
      }
    };

    marked.use({ renderer });
    contentEl.innerHTML = marked.parse(markdown);
    enhanceNoteContent(contentEl, slug);
  } catch (err) {
    console.error('Market note load failed:', err);
    const message = err && err.message ? err.message : 'Unknown error';
    contentEl.innerHTML = `<p class="notes-empty">Note unavailable. ${message}</p>`;
  }
};

setupIndexPage();
setupNotePage();
