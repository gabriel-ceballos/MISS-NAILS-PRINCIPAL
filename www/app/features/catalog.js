const API_URL = 'https://miss-nails-api.ceballosgg2000.workers.dev/';
const INITIAL_BATCH = 40;
const BATCH_SIZE = 40;
const INVENTORY_REFRESH_MS = 5000;
const CATALOG_DB_NAME = 'miss-nails-catalog';
const CATALOG_DB_STORE = 'catalog';
const CATALOG_DB_KEY = 'latest';
const CATALOG_REQUEST_TIMEOUT_MS = 8000;

let state = {
  products: [],
  filtered: [],
  rendered: 0,
  category: '',
  query: '',
  observer: null,
  loadingMore: false,
  inventoryRefreshTimer: null,
  inventoryRefreshing: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '')
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(parsePrice(value));
}

function imageUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(raw)}&sz=w800`;
}

function openCatalogDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(CATALOG_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CATALOG_DB_STORE)) {
        db.createObjectStore(CATALOG_DB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB no disponible.'));
  });
}

async function readCatalogCache() {
  const db = await openCatalogDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CATALOG_DB_STORE, 'readonly');
    const store = transaction.objectStore(CATALOG_DB_STORE);
    const request = store.get(CATALOG_DB_KEY);

    request.onsuccess = () => {
      const value = request.result;
      resolve(Array.isArray(value?.products) ? value.products : null);
    };
    request.onerror = () => reject(request.error || new Error('No se pudo leer el catálogo local.'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

async function writeCatalogCache(products) {
  if (!Array.isArray(products)) return;

  const db = await openCatalogDb();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(CATALOG_DB_STORE, 'readwrite');
    transaction.objectStore(CATALOG_DB_STORE).put({
      products,
      savedAt: Date.now(),
    }, CATALOG_DB_KEY);

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar el catálogo local.'));
  }).finally(() => db.close());
}

function renderCatalogState() {
  renderCategories();
  renderBatch(true);
}

async function fetchProducts() {
  const body = new URLSearchParams();
  body.append('accion', 'productos');
  body.append('datos', '{}');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API productos: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      throw new TypeError('La API de productos no devolvió JSON.');
    }

    const result = await response.json();
    if (!result?.ok || !Array.isArray(result.datos)) {
      throw new Error(result?.mensaje || 'La API no devolvió productos válidos.');
    }

    return result.datos;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al consultar el catálogo.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function categoryLabel(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/(^|\s)\S/g, letter => letter.toUpperCase());
}

function buildCategories(products) {
  const seen = new Set();
  const categories = [];
  for (const product of products) {
    const value = String(product?.categoria ?? '').trim();
    if (!value) continue;
    const key = value.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    categories.push({ value, label: categoryLabel(value) });
  }
  return categories;
}

function matches(product) {
  const category = String(product?.categoria ?? '').trim().toUpperCase();
  if (state.category && category !== state.category) return false;

  if (!state.query) return true;
  const query = state.query.toLowerCase();
  return [product?.nombre, product?.sku, product?.codigo, product?.categoria]
    .some(value => String(value ?? '').toLowerCase().includes(query));
}

function createProduct(product) {
  const id = escapeHtml(product?.id ?? '');
  const name = escapeHtml(product?.nombre || 'Producto sin nombre');
  const category = escapeHtml(product?.categoria || '');
  const inventory = Number(product?.inventario) || 0;
  const image = imageUrl(product?.imagen);
  const price = formatPrice(product?.precio);
  const active = String(product?.estatus ?? '').trim().toUpperCase();
  const unavailable = inventory <= 0 || ['NO', 'INACTIVO', 'INACTIVA'].includes(active);

  return `<article class="mn-product" data-product-id="${id}">
    <div class="mn-product-image-wrap">
      ${image
        ? `<img class="mn-product-image mn-product-image-real" src="${escapeHtml(image)}" alt="${name}" loading="lazy" decoding="async">`
        : `<div class="mn-product-image mn-product-image-empty">Sin imagen</div>`}
      <button class="mn-product-cart" type="button" data-add-product="${id}" aria-label="Agregar ${name} al carrito" ${unavailable ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20 8H6"></path><circle cx="9" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle><path d="M17 3v4M14.5 5H19.5"></path></svg>
      </button>
    </div>
    <div class="mn-product-body">
      <p class="mn-product-name">${name}</p>
      <p class="mn-product-category">${category}</p>
      <p class="mn-product-price">${price}</p>
      <p class="mn-product-stock">${unavailable ? 'No disponible' : `Disponible: ${inventory}`}</p>
    </div>
  </article>`;
}

function renderCategories() {
  const container = document.getElementById('mn-category-strip');
  if (!container) return;

  const categories = buildCategories(state.products);
  container.innerHTML = [
    `<button class="mn-category-chip${state.category ? '' : ' active'}" type="button" data-category="">Todas</button>`,
    ...categories.map(category =>
      `<button class="mn-category-chip${state.category === category.value.toUpperCase() ? ' active' : ''}" type="button" data-category="${escapeHtml(category.value)}">${escapeHtml(category.label)}</button>`
    ),
  ].join('');
}

function renderBatch(reset = true) {
  const grid = document.querySelector('.mn-catalog-grid');
  if (!grid) return;

  if (reset) {
    state.filtered = state.products.filter(matches);
    state.rendered = 0;
    grid.innerHTML = '';
  }

  const end = Math.min(state.rendered + (state.rendered ? BATCH_SIZE : INITIAL_BATCH), state.filtered.length);
  const batch = state.filtered.slice(state.rendered, end);
  if (batch.length) grid.insertAdjacentHTML('beforeend', batch.map(createProduct).join(''));
  state.rendered = end;

  const status = document.getElementById('mn-search-status');
  if (status) {
    if (state.query || state.category) {
      status.textContent = `${state.filtered.length.toLocaleString('es-MX')} producto${state.filtered.length === 1 ? '' : 's'} encontrado${state.filtered.length === 1 ? '' : 's'}`;
    } else {
      status.textContent = `${state.products.length.toLocaleString('es-MX')} productos disponibles`;
    }
  }

  if (!state.filtered.length) {
    grid.innerHTML = '<div class="mn-empty mn-catalog-empty">No encontramos productos con esos criterios.</div>';
  }

  setupObserver();
}

function setupObserver() {
  const sentinel = document.getElementById('mn-catalog-sentinel');
  if (!sentinel) return;
  state.observer?.disconnect();
  state.observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    if (state.loadingMore || state.rendered >= state.filtered.length) return;
    state.loadingMore = true;
    requestAnimationFrame(() => {
      renderBatch(false);
      state.loadingMore = false;
    });
  }, { rootMargin: '600px 0px' });
  state.observer.observe(sentinel);
}

function updateCategory(category) {
  state.category = String(category ?? '').trim().toUpperCase();
  renderCategories();
  renderBatch(true);
}

function updateQuery(query) {
  state.query = String(query ?? '').trim().toLowerCase();
  renderBatch(true);
}

function getProductState(product) {
  return {
    name: String(product?.nombre || 'Producto sin nombre'),
    category: String(product?.categoria || ''),
    price: parsePrice(product?.precio),
    inventory: Number(product?.inventario) || 0,
    status: String(product?.estatus ?? '').trim().toUpperCase(),
    image: String(product?.imagen ?? '').trim(),
  };
}

function productUnavailable(product) {
  const inventory = Number(product?.inventario) || 0;
  const active = String(product?.estatus ?? '').trim().toUpperCase();
  return inventory <= 0 || ['NO', 'INACTIVO', 'INACTIVA'].includes(active);
}

function updateRenderedProduct(product, previousProduct = null) {
  const id = String(product?.id ?? '');
  if (!id) return;

  const article = document.querySelector(
    `.mn-product[data-product-id="${CSS.escape(id)}"]`
  );
  if (!article) return;

  const next = getProductState(product);
  const previous = previousProduct ? getProductState(previousProduct) : null;

  const nameChanged = !previous || next.name !== previous.name;
  const categoryChanged = !previous || next.category !== previous.category;
  const priceChanged = !previous || next.price !== previous.price;
  const inventoryChanged = !previous || next.inventory !== previous.inventory;
  const statusChanged = !previous || next.status !== previous.status;
  const imageChanged = !previous || next.image !== previous.image;

  if (nameChanged) {
    const name = article.querySelector('.mn-product-name');
    if (name) name.textContent = next.name;
  }

  if (categoryChanged) {
    const category = article.querySelector('.mn-product-category');
    if (category) category.textContent = next.category;
  }

  if (priceChanged) {
    const price = article.querySelector('.mn-product-price');
    if (price) price.textContent = formatPrice(next.price);
  }

  if (inventoryChanged || statusChanged) {
    const unavailable = productUnavailable(product);
    const stock = article.querySelector('.mn-product-stock');
    const button = article.querySelector('[data-add-product]');

    if (stock) {
      stock.textContent = unavailable
        ? 'No disponible'
        : `Disponible: ${next.inventory}`;
    }

    if (button) {
      button.disabled = unavailable;
      button.setAttribute(
        'aria-label',
        unavailable
          ? `Producto no disponible: ${next.name}`
          : `Agregar ${next.name} al carrito`
      );
    }
  }

  if (nameChanged && !(inventoryChanged || statusChanged)) {
    const button = article.querySelector('[data-add-product]');
    if (button) {
      const unavailable = productUnavailable(product);
      button.setAttribute(
        'aria-label',
        unavailable
          ? `Producto no disponible: ${next.name}`
          : `Agregar ${next.name} al carrito`
      );
    }
  }

  if (imageChanged) {
    const wrap = article.querySelector('.mn-product-image-wrap');
    if (wrap) {
      const currentImage = wrap.querySelector('.mn-product-image');
      const image = imageUrl(next.image);

      if (image) {
        if (currentImage?.tagName === 'IMG') {
          currentImage.src = image;
          currentImage.alt = next.name;
        } else {
          currentImage?.remove();
          const img = document.createElement('img');
          img.className = 'mn-product-image mn-product-image-real';
          img.src = image;
          img.alt = next.name;
          img.loading = 'lazy';
          img.decoding = 'async';
          wrap.prepend(img);
        }
      } else if (currentImage?.tagName === 'IMG') {
        currentImage.remove();
        const empty = document.createElement('div');
        empty.className = 'mn-product-image mn-product-image-empty';
        empty.textContent = 'Sin imagen';
        wrap.prepend(empty);
      }
    }
  }

  if (nameChanged || categoryChanged || priceChanged || inventoryChanged || statusChanged || imageChanged) {
    article.dataset.liveUpdated = String(Date.now());
  }
}

function applyCatalogRefresh(products) {
  const previousProducts = state.products;
  const previousById = new Map(
    previousProducts.map(product => [String(product?.id ?? ''), product])
  );
  const nextById = new Map(
    products.map(product => [String(product?.id ?? ''), product])
  );

  const changedIds = new Set();

  for (const product of products) {
    const id = String(product?.id ?? '');
    if (!id) continue;

    const previous = previousById.get(id);
    if (!previous) {
      changedIds.add(id);
      continue;
    }

    const before = getProductState(previous);
    const after = getProductState(product);

    if (
      before.name !== after.name ||
      before.category !== after.category ||
      before.price !== after.price ||
      before.inventory !== after.inventory ||
      before.status !== after.status ||
      before.image !== after.image
    ) {
      changedIds.add(id);
    }
  }

  state.products = products;
  state.filtered = state.products.filter(matches);

  for (const article of document.querySelectorAll('.mn-product[data-product-id]')) {
    const id = String(article.dataset.productId || '');
    const next = nextById.get(id);

    if (!next || !matches(next)) {
      article.remove();
      continue;
    }

    if (changedIds.has(id)) {
      updateRenderedProduct(next, previousById.get(id) || null);
    }
  }

  if (changedIds.size) {
    renderCategories();
    console.info(
      'MISS NAILS → catálogo actualizado:',
      changedIds.size,
      'producto(s)'
    );
  }

  void writeCatalogCache(products).catch(error => {
    console.warn('MISS NAILS → no se pudo guardar el catálogo local:', error);
  });
}

async function refreshInventory() {
  if (!state.products.length || state.inventoryRefreshing) return;

  state.inventoryRefreshing = true;
  try {
    const products = await fetchProducts();
    applyCatalogRefresh(products);
  } catch (error) {
    console.warn('MISS NAILS → no se pudo actualizar el catálogo:', error);
  } finally {
    state.inventoryRefreshing = false;
  }
}

function startInventoryRefresh() {
  if (state.inventoryRefreshTimer) {
    clearInterval(state.inventoryRefreshTimer);
  }

  state.inventoryRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    refreshInventory();
  }, INVENTORY_REFRESH_MS);
}

function bindEvents() {
  const form = document.getElementById('mn-search-form');
  const input = document.getElementById('mn-search-input');
  const categories = document.getElementById('mn-category-strip');
  const grid = document.querySelector('.mn-catalog-grid');

  form?.addEventListener('submit', event => {
    event.preventDefault();
    updateQuery(input?.value || '');
    if (location.hash !== '#catalogo') location.hash = '#catalogo';
  });

  input?.addEventListener('input', event => updateQuery(event.target.value));

  categories?.addEventListener('click', event => {
    const chip = event.target.closest('[data-category]');
    if (!chip) return;
    updateCategory(chip.dataset.category || '');
  });

  grid?.addEventListener('click', event => {
    const button = event.target.closest('[data-add-product]');
    if (!button || button.disabled) return;
    const product = state.products.find(item => String(item?.id) === String(button.dataset.addProduct));
    if (!product) return;
    window.dispatchEvent(new CustomEvent('missnails:add-to-cart', { detail: product }));
  });
}

export async function initCatalog() {
  bindEvents();
  const grid = document.querySelector('.mn-catalog-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="mn-empty mn-catalog-loading">Cargando catálogo…</div>';

  let catalogShownFromCache = false;

  try {
    const cachedProducts = await readCatalogCache();

    if (Array.isArray(cachedProducts) && cachedProducts.length) {
      state.products = cachedProducts;
      renderCatalogState();
      catalogShownFromCache = true;
      console.info('MISS NAILS → catálogo local inmediato:', cachedProducts.length, 'productos');
    }
  } catch (error) {
    console.warn('MISS NAILS → caché local no disponible:', error);
  }

  try {
    const products = await fetchProducts();

    if (catalogShownFromCache) {
      applyCatalogRefresh(products);
    } else {
      state.products = products;
      renderCatalogState();
      void writeCatalogCache(products).catch(error => {
        console.warn('MISS NAILS → no se pudo guardar el catálogo local:', error);
      });
    }

    startInventoryRefresh();
    console.info('MISS NAILS → catálogo real:', products.length, 'productos');
  } catch (error) {
    console.error('MISS NAILS → error cargando catálogo:', error);

    if (!catalogShownFromCache) {
      grid.innerHTML = '<div class="mn-empty mn-catalog-error">No fue posible cargar el catálogo. Intenta nuevamente.</div>';
      const status = document.getElementById('mn-search-status');
      if (status) status.textContent = 'No se pudo conectar con el catálogo.';
    } else {
      const status = document.getElementById('mn-search-status');
      if (status) status.textContent = `${state.products.length.toLocaleString('es-MX')} productos disponibles · actualización pendiente`;
      startInventoryRefresh();
    }
  }
}
