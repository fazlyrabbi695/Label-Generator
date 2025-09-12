/* Core state and helpers */
const q = (s) => document.querySelector(s);
const qa = (s) => Array.from(document.querySelectorAll(s));

const STORAGE_KEYS = {
  products: 'lg_products',
  settings: 'lg_settings',
};

function mmFromValue(value){
  const [w,h] = value.split('x').map(Number);
  return { w, h };
}

function loadJSON(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback; }
}
function saveJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

/* Initial bindings */
document.addEventListener('DOMContentLoaded', () => {
  bindActions();
  restoreSettings();
  renderSavedProducts();
  renderPreview();
});

function bindActions(){
  q('#addProduct').addEventListener('click', onAddProduct);
  q('#saveProduct').addEventListener('click', onSaveCurrentProduct);
  q('#clearSaved').addEventListener('click', onClearSaved);
  q('#productSearch').addEventListener('input', renderSavedProducts);
  q('#previewBtn').addEventListener('click', renderPreview);
  q('#printBtn').addEventListener('click', onPrint);
  q('#toggleTheme').addEventListener('click', toggleTheme);
  q('#resetSettings').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEYS.settings); restoreSettings(true); renderPreview(); });
  q('#presetRongta3825').addEventListener('click', () => {
    q('#labelSize').value = '38x25';
    onFormChanged();
  });
  q('#presetRongta3825Sample').addEventListener('click', () => applyRongtaSample());
  q('#saveDisplaySettings').addEventListener('click', saveDisplaySettings);

  // live update preview on inputs
  qa('input,select').forEach(el => el.addEventListener('change', onFormChanged));
  q('#qtyUnit').addEventListener('change', () => {
    const isCustom = q('#qtyUnit').value === 'custom';
    q('#qtyUnitCustom').style.display = isCustom ? '' : 'none';
    onFormChanged();
  });
  q('#qtyUnitCustom').addEventListener('input', onFormChanged);
}

function currentFormData(){
  return {
    name: q('#productName').value.trim(),
    variation: q('#productVariation').value.trim(),
    qty: Math.max(1, parseInt(q('#productQty').value || '1', 10)),
    qtyUnit: q('#qtyUnit').value === 'custom' ? (q('#qtyUnitCustom').value.trim() || 'ইউনিট') : q('#qtyUnit').value,
    price: parseFloat(q('#productPrice').value || '0'),
    packDate: q('#packDate').value,
    expDate: q('#expDate').value,
    priceMode: q('#priceMode').value,
    labelCount: Math.max(1, parseInt(q('#labelCount').value || '1', 10)),
    show: {
      name: q('#showName').checked,
      variation: q('#showVariation').checked,
      qty: q('#showQty').checked,
      price: q('#showPrice').checked,
      biz: q('#showBiz').checked,
      pack: q('#showPack').checked,
      exp: q('#showExp').checked,
    },
    fonts: {
      name: parseInt(q('#fsName').value,10),
      variation: parseInt(q('#fsVariation').value,10),
      qty: parseInt(q('#fsQty').value,10),
      price: parseInt(q('#fsPrice').value,10),
      biz: parseInt(q('#fsBiz').value,10),
      pack: parseInt(q('#fsPack').value,10),
      exp: parseInt(q('#fsExp').value,10),
    },
    bizName: q('#bizName').value.trim(),
    labelSize: q('#labelSize').value,
    barcode: {
      type: q('#barcodeType').value,
      value: q('#barcodeValue').value.trim(),
      height: parseInt(q('#barcodeHeight').value,10),
    },
  };
}

function onFormChanged(){
  // persist settings except product-specific fields (name, variation, price, dates, barcode value)
  const data = currentFormData();
  // live persist minimal settings (non-destructive)
  const existing = loadJSON(STORAGE_KEYS.settings, {});
  const next = { ...existing,
    priceMode: data.priceMode,
    labelSize: data.labelSize,
    barcode: { ...(existing.barcode||{}), type: data.barcode.type, height: data.barcode.height }
  };
  saveJSON(STORAGE_KEYS.settings, next);
  renderPreview();
}

function saveDisplaySettings(){
  const data = currentFormData();
  const existing = loadJSON(STORAGE_KEYS.settings, {});
  const next = { ...existing,
    show: data.show,
    fonts: data.fonts,
    bizName: data.bizName,
  };
  saveJSON(STORAGE_KEYS.settings, next);
  alert('Display settings saved');
}

/* Products handling */
function onAddProduct(){
  renderPreview();
}

function onSaveCurrentProduct(){
  const data = currentFormData();
  const products = loadJSON(STORAGE_KEYS.products, []);
  const id = crypto.randomUUID();
  const product = { id, name: data.name, variation: data.variation, price: data.price, barcode: data.barcode.value };
  products.push(product);
  saveJSON(STORAGE_KEYS.products, products);
  renderSavedProducts();
}

function onClearSaved(){
  if(confirm('লোকাল স্টোরেজে সেভ করা সব প্রোডাক্ট মুছে ফেলবেন?')){
    localStorage.removeItem(STORAGE_KEYS.products);
    renderSavedProducts();
  }
}

function renderSavedProducts(){
  const list = q('#savedProducts');
  const products = loadJSON(STORAGE_KEYS.products, []);
  const term = q('#productSearch').value?.toLowerCase() ?? '';
  list.innerHTML = '';
  products
    .filter(p => `${p.name} ${p.variation}`.toLowerCase().includes(term))
    .forEach(p => {
      const row = document.createElement('div');
      row.className = 'saved-item';
      row.innerHTML = `<div><div style="font-weight:600">${escapeHtml(p.name)}</div><div style="opacity:.8;font-size:12px">${escapeHtml(p.variation || '')}</div></div>`;

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '6px';
      const useBtn = document.createElement('button'); useBtn.className='btn btn-secondary'; useBtn.textContent='Use';
      useBtn.onclick = () => {
        q('#productName').value = p.name;
        q('#productVariation').value = p.variation || '';
        q('#productPrice').value = p.price ?? '';
        q('#barcodeValue').value = p.barcode || '';
        renderPreview();
      };
      const delBtn = document.createElement('button'); delBtn.className='btn btn-danger'; delBtn.textContent='Delete';
      delBtn.onclick = () => {
        const items = loadJSON(STORAGE_KEYS.products, []);
        saveJSON(STORAGE_KEYS.products, items.filter(i => i.id !== p.id));
        renderSavedProducts();
      };
      actions.appendChild(useBtn); actions.appendChild(delBtn);
      row.appendChild(actions);
      list.appendChild(row);
    });
}

/* Preview */
function renderPreview(){
  const data = currentFormData();
  const grid = q('#previewGrid');
  grid.innerHTML = '';

  const { w, h } = mmFromValue(data.labelSize);
  grid.style.setProperty('--print-col-width', `${w}mm`);

  const tpl = q('#labelTemplate');
  const count = data.labelCount;
  const baseVal = data.barcode.value;
  const baseNumeric = getNumeric(baseVal);
  const padLen = String(baseVal || '').length;
  for(let i=0;i<count;i++){
    const el = tpl.content.firstElementChild.cloneNode(true);
    const d = JSON.parse(JSON.stringify(data));
    if(baseNumeric !== null){
      d.barcode.value = padNumber(baseNumeric + i, padLen);
    } else if(!d.barcode.value){
      // auto-generate if empty (timestamp-based short code)
      const seed = Date.now().toString().slice(-8);
      d.barcode.value = padNumber(parseInt(seed,10) + i, 8);
    }
    applyDataToLabel(el, d);
    el.style.width = `${w}mm`;
    el.style.height = `${h}mm`;
    grid.appendChild(el);
  }
}

function applyDataToLabel(el, data){
  const name = el.querySelector('.l-name');
  const variation = el.querySelector('.l-variation');
  const qty = el.querySelector('.l-qty');
  const price = el.querySelector('.l-price');
  const dates = el.querySelector('.l-dates');
  const biz = el.querySelector('.l-biz');
  const svg = el.querySelector('svg.barcode');

  name.style.display = data.show.name ? '' : 'none';
  variation.style.display = data.show.variation ? '' : 'none';
  price.style.display = data.show.price ? '' : 'none';
  qty.style.display = data.show.qty ? '' : 'none';
  biz.style.display = data.show.biz ? '' : 'none';

  name.style.fontSize = `${data.fonts.name}px`;
  variation.style.fontSize = `${data.fonts.variation}px`;
  qty.style.fontSize = `${data.fonts.qty}px`;
  price.style.fontSize = `${data.fonts.price}px`;
  biz.style.fontSize = `${data.fonts.biz}px`;

  name.textContent = data.name || '';
  variation.textContent = data.variation || '';
  qty.textContent = data.qty ? `Qty: ${data.qty}` : '';
  if(data.qty){ qty.textContent = `Qty: ${data.qty} ${data.qtyUnit || ''}`; }
  price.textContent = data.price ? `Price: ${formatCurrency(data.price, data.priceMode)}` : '';

  const dateParts = [];
  dates.innerHTML = '';
  if(data.show.pack && data.packDate){
    const s = document.createElement('span');
    s.textContent = `Pckg: ${formatDate(data.packDate)}`;
    s.style.fontSize = `${data.fonts.pack}px`;
    dateParts.push(s);
  }
  // Always show expire if date is provided, regardless of checkbox state
  if(data.expDate){
    const s = document.createElement('span');
    s.textContent = `EXP: ${formatDate(data.expDate)}`;
    s.style.fontSize = `${data.fonts.exp}px`;
    dateParts.push(s);
  }
  if(dateParts.length){
    dateParts.forEach((n, idx) => {
      if(idx>0){
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '|';
        sep.style.padding = '0 4px';
        const f = Math.min(data.fonts.pack, data.fonts.exp);
        sep.style.fontSize = `${f}px`;
        sep.style.lineHeight = '1';
        dates.appendChild(sep);
      }
      dates.appendChild(n);
    });
    dates.style.display = '';
  } else {
    dates.style.display = 'none';
  }

  // ব্যবসার নাম সবসময় উপরে বোল্ড
  biz.textContent = data.bizName || '';
  biz.style.display = '';
  biz.style.fontWeight = '700';
  biz.style.fontSize = `${data.fonts.biz}px`;

  // barcode
  const opts = barcodeOptions(data);
  try { JsBarcode(svg, data.barcode.value || '000000000000', opts); }
  catch(e){ svg.replaceWith(document.createElement('div')); }
}

function barcodeOptions(data){
  const formatMap = { code128: 'CODE128', ean13: 'EAN13', upc: 'UPC' };
  return {
    format: formatMap[data.barcode.type] || 'CODE128',
    height: data.barcode.height,
    width: 1.2,
    displayValue: true,
    fontSize: 10,
    margin: 0,
    lineColor: '#000',
    background: '#fff',
  };
}

/* Printing */
function onPrint(){
  // ensure preview is up to date and layout is flushed before print
  renderPreview();
  const data = currentFormData();
  const { w, h } = mmFromValue(data.labelSize);
  ensurePageStyle(`${w}mm`, `${h}mm`);
  // some browsers need a frame to apply @page; defer to next frame
  requestAnimationFrame(() => setTimeout(() => {
    window.print();
    // after print, set next sequential barcode value if numeric
    const baseVal = data.barcode.value;
    const baseNumeric = getNumeric(baseVal);
    if(baseNumeric !== null){
      const nextVal = padNumber(baseNumeric + data.labelCount, String(baseVal).length);
      q('#barcodeValue').value = nextVal;
      onFormChanged();
    } else if(!baseVal){
      // if we auto-generated from timestamp, continue the sequence
      const seed = Date.now().toString().slice(-8);
      const nextVal = padNumber(parseInt(seed,10) + data.labelCount, 8);
      q('#barcodeValue').value = nextVal;
      onFormChanged();
    }
  }, 0));
}

let pageStyleEl;
function ensurePageStyle(w, h){
  if(!pageStyleEl){ pageStyleEl = document.createElement('style'); document.head.appendChild(pageStyleEl); }
  pageStyleEl.textContent = `@page{ size: ${w} ${h}; margin:0 }`;
}

function applyRongtaSample(){
  // 38x25 mm with fonts matching provided sample
  q('#labelSize').value = '38x25';
  q('#fsBiz').value = 7;
  q('#fsName').value = 6;
  q('#fsVariation').value = 6;
  q('#fsQty').value = 10; // if shown
  q('#fsPrice').value = 8;
  q('#fsPack').value = 9;
  q('#fsExp').value = 10;
  q('#barcodeHeight').value = 23;
  // Save display settings so they persist
  saveDisplaySettings();
  onFormChanged();
}

/* Settings persistence */
function restoreSettings(reset=false){
  const s = reset ? {} : loadJSON(STORAGE_KEYS.settings, {});
  if(s.priceMode) q('#priceMode').value = s.priceMode;
  if(s.show){
    if('name' in s.show) q('#showName').checked = !!s.show.name;
    if('variation' in s.show) q('#showVariation').checked = !!s.show.variation;
    if('qty' in s.show) q('#showQty').checked = !!s.show.qty;
    if('price' in s.show) q('#showPrice').checked = !!s.show.price;
    if('biz' in s.show) q('#showBiz').checked = !!s.show.biz;
    if('pack' in s.show) q('#showPack').checked = !!s.show.pack;
    if('exp' in s.show) q('#showExp').checked = !!s.show.exp; // only set if defined
  }
  if(s.fonts){
    if('name' in s.fonts) q('#fsName').value = s.fonts.name;
    if('variation' in s.fonts) q('#fsVariation').value = s.fonts.variation;
    if('qty' in s.fonts) q('#fsQty').value = s.fonts.qty;
    if('price' in s.fonts) q('#fsPrice').value = s.fonts.price;
    if('biz' in s.fonts) q('#fsBiz').value = s.fonts.biz;
    if('pack' in s.fonts) q('#fsPack').value = s.fonts.pack;
    if('exp' in s.fonts) q('#fsExp').value = s.fonts.exp;
  }
  if(s.bizName) q('#bizName').value = s.bizName;
  q('#labelSize').value = s.labelSize || '38x25'; // default 38x25
  if(s.barcode){ q('#barcodeType').value = s.barcode.type; q('#barcodeHeight').value = s.barcode.height; }
  // restore qty unit if saved in fonts/show settings block not necessary
}

/* Theme */
function toggleTheme(){
  document.documentElement.classList.toggle('light');
}

/* Utils */
function escapeHtml(str){
  return String(str).replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}
function formatCurrency(amount, mode){
  const val = amount; // tax calc can be added
  return new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(val) + (mode==='inc'?' (Inc)':' (Exc)');
}
function formatDate(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString('bn-BD');
}

// Barcode helpers
function getNumeric(value){
  const s = String(value || '').trim();
  if(!s) return null;
  if(/^\d+$/.test(s)) return parseInt(s, 10);
  return null;
}
function padNumber(num, len){
  const s = String(num);
  if(s.length >= len) return s;
  return '0'.repeat(len - s.length) + s;
}


