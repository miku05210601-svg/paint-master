/**
 * app.js — アプリ本体ロジック
 * 画面遷移・イベントバインド・レンダリング
 */

// ========================================
// 定数
// ========================================
const TYPE_LABELS = {
  lacquer: 'ラッカー',
  acrylic: '水性',
  enamel: 'エナメル',
  other: 'その他',
};

const MAKERS = ['Mr.カラー', 'タミヤカラー', 'ガイアカラー', '水性ホビーカラー', 'ファレホ', 'その他'];

// ========================================
// 状態管理
// ========================================
let currentDetailId = null;
let currentSearchQuery = '';
let currentTypeFilter = 'all';
let lastScannedBarcode = null;
let pendingAddBarcode = null;

// ========================================
// ユーティリティ
// ========================================
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = ''; }, 2500);
}

function showModal(titleText, bodyText, actions) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = titleText;
  document.getElementById('modal-body').textContent = bodyText;
  const actionsEl = document.getElementById('modal-actions');
  actionsEl.innerHTML = '';
  actions.forEach(({ label, cls, onClick }) => {
    const btn = document.createElement('button');
    btn.className = cls || 'btn-secondary';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      hideModal();
      onClick?.();
    });
    actionsEl.appendChild(btn);
  });
  overlay.classList.add('active');
}

function hideModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  // タブのアクティブ状態を更新
  document.querySelectorAll('.tab-item').forEach(t => {
    t.classList.toggle('active', t.dataset.screen === screenId);
  });

  // スキャン画面を離れたらカメラ停止
  if (screenId !== 'screen-scan') {
    barcodeScanner.stop();
    document.getElementById('scan-result').classList.remove('visible');
  }
}

function getPaintPhotoEl(photo, size = 52) {
  if (photo) {
    return `<img src="${photo}" alt="塗料写真" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:${size > 52 ? 0 : 10}px;">`;
  }
  return '🎨';
}

// ========================================
// 塗料一覧画面
// ========================================
function renderPaintList() {
  const query = currentSearchQuery;
  let paints = query ? paintStore.search(query) : paintStore.getAll();

  if (currentTypeFilter !== 'all') {
    paints = paints.filter(p => p.type === currentTypeFilter);
  }

  const listEl = document.getElementById('paint-list');
  const emptyEl = document.getElementById('list-empty');

  if (paints.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  listEl.innerHTML = paints.map(paint => `
    <div class="paint-card" data-id="${paint.id}">
      <div class="paint-card-photo" style="width:52px;height:52px;">
        ${getPaintPhotoEl(paint.photo)}
      </div>
      <div class="paint-card-info">
        <div class="paint-card-code">${escapeHtml(paint.colorCode)}</div>
        <div class="paint-card-name">${escapeHtml(paint.colorName)}</div>
        <div class="paint-card-maker">${escapeHtml(paint.maker)}${paint.series ? ' / ' + escapeHtml(paint.series) : ''}</div>
        <div>
          <span class="paint-card-type-badge">${TYPE_LABELS[paint.type] || paint.type}</span>
          ${paintStore.isInShopping(paint.id) ? '<span class="badge-in-shopping" style="margin-left:4px;">買い物リスト</span>' : ''}
        </div>
      </div>
      <div class="paint-card-stock">
        <div class="stock-controls">
          <button class="btn-stock btn-dec" data-id="${paint.id}" aria-label="在庫を減らす">−</button>
          <span class="stock-count">${paint.stock}</span>
          <button class="btn-stock btn-inc" data-id="${paint.id}" aria-label="在庫を増やす">＋</button>
        </div>
        ${paint.stock === 0 ? '<span class="stock-zero badge-out-of-stock">在庫切れ</span>' : ''}
      </div>
    </div>
  `).join('');

  // 在庫ボタンイベント（バブリングで委譲）
  listEl.querySelectorAll('.btn-inc').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      paintStore.incrementStock(btn.dataset.id);
      renderPaintList();
    });
  });
  listEl.querySelectorAll('.btn-dec').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      paintStore.decrementStock(btn.dataset.id);
      renderPaintList();
    });
  });

  // カードタップで詳細へ
  listEl.querySelectorAll('.paint-card').forEach(card => {
    card.addEventListener('click', () => {
      openDetail(card.dataset.id);
    });
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ========================================
// 詳細画面
// ========================================
function openDetail(id) {
  currentDetailId = id;
  const paint = paintStore.getById(id);
  if (!paint) return;

  const photoEl = document.getElementById('detail-photo');
  photoEl.innerHTML = paint.photo
    ? `<img src="${paint.photo}" alt="塗料写真">`
    : '🎨';

  document.getElementById('detail-color-code').textContent = paint.colorCode;
  document.getElementById('detail-color-name').textContent = paint.colorName;
  document.getElementById('detail-maker').textContent = paint.maker + (paint.series ? ` / ${paint.series}` : '');
  document.getElementById('detail-type').textContent = TYPE_LABELS[paint.type] || paint.type;
  document.getElementById('detail-barcode').textContent = paint.barcode || '未登録';
  document.getElementById('detail-memo').textContent = paint.memo || 'なし';
  document.getElementById('detail-stock-count').textContent = paint.stock;
  document.getElementById('detail-stock-count').style.color =
    paint.stock === 0 ? 'var(--danger)' : 'var(--text)';

  const shoppingBtn = document.getElementById('btn-add-shopping');
  if (paintStore.isInShopping(id)) {
    shoppingBtn.textContent = '✓ 買い物リストに追加済み';
    shoppingBtn.className = 'btn-secondary';
  } else {
    shoppingBtn.textContent = '🛒 買い物リストに追加';
    shoppingBtn.className = 'btn-secondary';
  }

  navigateTo('screen-detail');
}

function renderDetailStock() {
  const paint = paintStore.getById(currentDetailId);
  if (!paint) return;
  document.getElementById('detail-stock-count').textContent = paint.stock;
  document.getElementById('detail-stock-count').style.color =
    paint.stock === 0 ? 'var(--danger)' : 'var(--text)';
}

// ========================================
// 新規登録フォーム
// ========================================
function openAddForm(prefill = {}) {
  document.getElementById('add-form').reset();
  document.getElementById('add-photo-preview').src = '';
  document.getElementById('add-photo-preview').style.display = 'none';
  document.getElementById('add-photo-placeholder').style.display = '';

  if (prefill.barcode) {
    document.getElementById('add-barcode').value = prefill.barcode;
    pendingAddBarcode = prefill.barcode;
  }
  if (prefill.colorCode) document.getElementById('add-colorCode').value = prefill.colorCode;

  navigateTo('screen-add');
}

// ========================================
// 買い物リスト画面
// ========================================
function renderShoppingList() {
  const items = paintStore.getShoppingList();
  const listEl = document.getElementById('shopping-list');
  const emptyEl = document.getElementById('shopping-empty');

  if (items.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  listEl.innerHTML = items.map(item => `
    <div class="shopping-item">
      <div class="shopping-item-info">
        <div class="shopping-item-code">${escapeHtml(item.paint.colorCode)}</div>
        <div class="shopping-item-name">${escapeHtml(item.paint.colorName)}</div>
        <div class="shopping-item-maker">${escapeHtml(item.paint.maker)}</div>
      </div>
      <button class="btn-purchased" data-id="${item.id}">購入した</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.btn-purchased').forEach(btn => {
    btn.addEventListener('click', () => {
      paintStore.markAsPurchased(btn.dataset.id);
      renderShoppingList();
      showToast('在庫に追加しました', 'success');
    });
  });
}

// ========================================
// バーコードスキャン画面
// ========================================
async function fetchRakutenInfo(janCode) {
  try {
    const res = await fetch(`/api/rakuten?jan=${encodeURIComponent(janCode)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parsePaintInfo(itemName) {
  // 商品名からメーカー・色番号・色名を推定する
  const result = { maker: '', colorCode: '', colorName: itemName };

  // Mr.カラー
  const mrMatch = itemName.match(/Mr\.カラー|Mr\.Color/i);
  if (mrMatch) result.maker = 'Mr.カラー';

  // タミヤ
  const tamiyaMatch = itemName.match(/タミヤ|TAMIYA/i);
  if (tamiyaMatch) result.maker = 'タミヤカラー';

  // ガイア
  const gaiaMatch = itemName.match(/ガイア|GAIA/i);
  if (gaiaMatch) result.maker = 'ガイアカラー';

  // 水性ホビーカラー
  const aqueousMatch = itemName.match(/水性ホビー/i);
  if (aqueousMatch) result.maker = '水性ホビーカラー';

  // 色番号（例: C-1, XF-2, H-3, GC-01 など）
  const codeMatch = itemName.match(/\b([A-Z]{1,3}-?\d{1,3}[A-Z]?)\b/);
  if (codeMatch) result.colorCode = codeMatch[1];

  // 色名（「No.」や番号の後ろのテキストを抽出）
  const nameMatch = itemName.match(/No\.\d+\s+(.+?)(?:\s*[\[（【]|$)/);
  if (nameMatch) result.colorName = nameMatch[1].trim();

  return result;
}

async function handleBarcodeResult(value) {
  const resultEl = document.getElementById('scan-result');
  const statusEl = document.getElementById('scan-result-status');
  const nameEl = document.getElementById('scan-result-name');
  const barcodeValEl = document.getElementById('scan-barcode-value');
  const actionEl = document.getElementById('scan-result-action');
  const rakutenEl = document.getElementById('scan-rakuten-info');

  lastScannedBarcode = value;
  resultEl.classList.add('visible');
  barcodeValEl.textContent = `バーコード: ${value}`;
  rakutenEl.innerHTML = '';

  const paint = paintStore.findByBarcode(value);

  if (paint) {
    statusEl.textContent = '✓ 既に所持しています';
    statusEl.className = 'scan-result-status found';
    nameEl.textContent = `${paint.maker} ${paint.colorCode} ${paint.colorName}（在庫: ${paint.stock}）`;
    actionEl.textContent = '詳細を見る';
    actionEl.style.display = '';
    actionEl.onclick = () => openDetail(paint.id);
  } else {
    statusEl.textContent = '✗ 未登録です — 商品情報を検索中…';
    statusEl.className = 'scan-result-status not-found';
    nameEl.textContent = '';
    actionEl.style.display = 'none';

    const rakutenData = await fetchRakutenInfo(value);

    if (rakutenData && !rakutenData.error) {
      const parsed = parsePaintInfo(rakutenData.itemName);
      nameEl.textContent = rakutenData.itemName;
      rakutenEl.innerHTML = `
        <div class="rakuten-result">
          ${rakutenData.imageUrl ? `<img src="${escapeHtml(rakutenData.imageUrl)}" alt="商品画像" class="rakuten-thumb">` : ''}
          <div class="rakuten-parsed">
            ${parsed.maker ? `<span class="rakuten-tag">メーカー: ${escapeHtml(parsed.maker)}</span>` : ''}
            ${parsed.colorCode ? `<span class="rakuten-tag">色番号: ${escapeHtml(parsed.colorCode)}</span>` : ''}
          </div>
        </div>`;
      actionEl.textContent = 'この情報で登録する';
      actionEl.style.display = '';
      actionEl.onclick = () => openAddForm({ barcode: value, maker: parsed.maker, colorCode: parsed.colorCode, colorName: parsed.colorName });
    } else {
      nameEl.textContent = '楽天での商品情報が見つかりませんでした';
      actionEl.textContent = '手動で登録する';
      actionEl.style.display = '';
      actionEl.onclick = () => openAddForm({ barcode: value });
    }

    statusEl.textContent = '✗ 未登録です';
  }
}

function startScan() {
  const resultEl = document.getElementById('scan-result');
  const loadingEl = document.getElementById('scan-loading');
  const previewImg = document.getElementById('scan-preview-img');
  const fileInput = document.getElementById('scan-photo-input');

  resultEl.classList.remove('visible');
  lastScannedBarcode = null;

  // 前回のリスナーを削除してから再登録
  const newInput = fileInput.cloneNode(true);
  fileInput.parentNode.replaceChild(newInput, fileInput);

  newInput.addEventListener('change', async () => {
    const file = newInput.files[0];
    if (!file) return;

    // プレビュー表示（画像の読み込み完了を待ってからデコード）
    const objectUrl = URL.createObjectURL(file);
    loadingEl.style.display = 'block';
    resultEl.classList.remove('visible');

    await new Promise((resolve, reject) => {
      previewImg.onload = resolve;
      previewImg.onerror = reject;
      previewImg.src = objectUrl;
      previewImg.style.display = 'block';
    });

    try {
      const value = await barcodeScanner.decodeFromImage(previewImg);
      loadingEl.style.display = 'none';
      await handleBarcodeResult(value);
    } catch (err) {
      loadingEl.style.display = 'none';
      resultEl.classList.add('visible');
      document.getElementById('scan-result-status').textContent = `エラー: ${err.message}`;
      document.getElementById('scan-result-status').className = 'scan-result-status not-found';
      document.getElementById('scan-result-name').textContent = '';
      document.getElementById('scan-barcode-value').textContent = '';
      document.getElementById('scan-result-action').style.display = 'none';
      document.getElementById('scan-rakuten-info').innerHTML = '';
    } finally {
      URL.revokeObjectURL(objectUrl);
      newInput.value = '';
    }
  });
}

// ========================================
// プリセット画面
// ========================================
const PRESETS = [
  { key: 'mr-color', data: () => PRESET_MR_COLOR },
  { key: 'tamiya',   data: () => PRESET_TAMIYA },
  { key: 'aqueous',  data: () => PRESET_AQUEOUS },
];

let currentPresetKey = 'mr-color';
let presetChecked = new Set();
let presetSearchQuery = '';

function initPresetScreen() {
  // メーカータブ生成
  const tabsEl = document.getElementById('preset-maker-tabs');
  tabsEl.innerHTML = PRESETS.map(p => {
    const label = p.data().maker;
    return `<button class="preset-maker-tab${p.key === currentPresetKey ? ' active' : ''}" data-preset="${p.key}">${label}</button>`;
  }).join('');
  tabsEl.querySelectorAll('.preset-maker-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentPresetKey = tab.dataset.preset;
      presetChecked.clear();
      presetSearchQuery = '';
      document.getElementById('preset-search').value = '';
      initPresetScreen();
    });
  });

  renderPresetColorList();
}

function renderPresetColorList() {
  const preset = PRESETS.find(p => p.key === currentPresetKey).data();
  const q = presetSearchQuery.toLowerCase();
  const colors = preset.colors.filter(c =>
    !q || c.colorCode.toLowerCase().includes(q) || c.colorName.toLowerCase().includes(q)
  );

  const listEl = document.getElementById('preset-color-list');
  listEl.innerHTML = colors.map(c => {
    const alreadyOwned = paintStore.findDuplicate(preset.maker, c.colorCode);
    const isChecked = presetChecked.has(c.colorCode);
    return `
      <div class="preset-color-item${isChecked ? ' checked' : ''}" data-code="${escapeHtml(c.colorCode)}">
        <div class="preset-checkbox">${isChecked ? '✓' : ''}</div>
        <div class="preset-color-info">
          <div class="preset-color-code">${escapeHtml(c.colorCode)}</div>
          <div class="preset-color-name">${escapeHtml(c.colorName)}</div>
        </div>
        ${alreadyOwned ? '<span class="preset-already-badge">所持済み</span>' : ''}
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.preset-color-item').forEach(item => {
    item.addEventListener('click', () => {
      const code = item.dataset.code;
      if (presetChecked.has(code)) {
        presetChecked.delete(code);
        item.classList.remove('checked');
        item.querySelector('.preset-checkbox').textContent = '';
      } else {
        presetChecked.add(code);
        item.classList.add('checked');
        item.querySelector('.preset-checkbox').textContent = '✓';
      }
      updatePresetBulkBar();
    });
  });

  updatePresetBulkBar();
}

function updatePresetBulkBar() {
  const count = presetChecked.size;
  document.getElementById('preset-checked-count').textContent = `${count}件選択中`;
  const footer = document.getElementById('preset-register-footer');
  const btn = document.getElementById('btn-preset-register');
  if (count > 0) {
    footer.style.display = '';
    btn.textContent = `選択した ${count} 色を登録する`;
  } else {
    footer.style.display = 'none';
  }
}

function registerPresetColors() {
  const preset = PRESETS.find(p => p.key === currentPresetKey).data();
  let added = 0;
  let skipped = 0;
  presetChecked.forEach(code => {
    const colorData = preset.colors.find(c => c.colorCode === code);
    if (!colorData) return;
    if (paintStore.findDuplicate(preset.maker, code)) {
      skipped++;
      return;
    }
    paintStore.add({
      maker: preset.maker,
      series: preset.series,
      colorCode: colorData.colorCode,
      colorName: colorData.colorName,
      type: preset.type,
      stock: 1,
    });
    added++;
  });

  presetChecked.clear();
  renderPresetColorList();
  navigateTo('screen-list');
  renderPaintList();

  if (skipped > 0) {
    showToast(`${added}色を登録しました（${skipped}色はスキップ）`, 'success');
  } else {
    showToast(`${added}色を登録しました`, 'success');
  }
}

// ========================================
// 初期化・イベントバインド
// ========================================
document.addEventListener('DOMContentLoaded', () => {

  // ---- ボトムタブ ----
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.screen;
      navigateTo(target);
      if (target === 'screen-list') renderPaintList();
      if (target === 'screen-shopping') renderShoppingList();
      if (target === 'screen-scan') startScan();
      if (target === 'screen-preset') initPresetScreen();
    });
  });

  // ---- 検索 ----
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value;
    renderPaintList();
  });

  // ---- タイプフィルター ----
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentTypeFilter = chip.dataset.type;
      renderPaintList();
    });
  });

  // ---- 詳細画面 ----
  document.getElementById('btn-back-from-detail').addEventListener('click', () => {
    navigateTo('screen-list');
    renderPaintList();
  });

  document.getElementById('btn-detail-inc').addEventListener('click', () => {
    paintStore.incrementStock(currentDetailId);
    renderDetailStock();
  });

  document.getElementById('btn-detail-dec').addEventListener('click', () => {
    paintStore.decrementStock(currentDetailId);
    renderDetailStock();
  });

  document.getElementById('btn-add-shopping').addEventListener('click', () => {
    if (paintStore.isInShopping(currentDetailId)) {
      showToast('すでに買い物リストに追加されています');
    } else {
      paintStore.addToShopping(currentDetailId);
      document.getElementById('btn-add-shopping').textContent = '✓ 買い物リストに追加済み';
      showToast('買い物リストに追加しました', 'success');
    }
  });

  document.getElementById('btn-detail-edit').addEventListener('click', () => {
    const paint = paintStore.getById(currentDetailId);
    if (!paint) return;
    prefillEditForm(paint);
    navigateTo('screen-edit');
  });

  document.getElementById('btn-detail-delete').addEventListener('click', () => {
    showModal(
      '塗料を削除しますか？',
      'この操作は元に戻せません。',
      [
        { label: '削除する', cls: 'btn-danger', onClick: () => {
          paintStore.remove(currentDetailId);
          navigateTo('screen-list');
          renderPaintList();
          showToast('削除しました');
        }},
        { label: 'キャンセル', cls: 'btn-secondary' },
      ]
    );
  });

  // ---- 新規登録フォーム ----
  document.getElementById('btn-open-add').addEventListener('click', () => openAddForm());

  document.getElementById('btn-back-from-add').addEventListener('click', () => {
    navigateTo('screen-list');
  });

  // 写真選択
  document.getElementById('add-photo-area').addEventListener('click', () => {
    document.getElementById('add-photo-input').click();
  });
  document.getElementById('add-photo-input').addEventListener('change', e => {
    handlePhotoSelect(e.target.files[0], 'add-photo-preview', 'add-photo-placeholder');
  });

  // フォーム送信
  document.getElementById('add-form').addEventListener('submit', e => {
    e.preventDefault();
    const data = getFormData('add');
    const dup = paintStore.findDuplicate(data.maker, data.colorCode);
    if (dup) {
      showModal(
        'この塗料は既に登録されています',
        `${dup.maker} ${dup.colorCode} ${dup.colorName}\n在庫: ${dup.stock}`,
        [
          { label: '既存の塗料を見る', cls: 'btn-primary', onClick: () => openDetail(dup.id) },
          { label: 'それでも登録する', cls: 'btn-secondary', onClick: () => {
            paintStore.add(data);
            navigateTo('screen-list');
            renderPaintList();
            showToast('登録しました', 'success');
          }},
          { label: 'キャンセル', cls: 'btn-secondary' },
        ]
      );
      return;
    }
    paintStore.add(data);
    navigateTo('screen-list');
    renderPaintList();
    showToast('登録しました', 'success');
    pendingAddBarcode = null;
  });

  // ---- 編集フォーム ----
  document.getElementById('btn-back-from-edit').addEventListener('click', () => {
    navigateTo('screen-detail');
  });

  document.getElementById('edit-photo-area').addEventListener('click', () => {
    document.getElementById('edit-photo-input').click();
  });
  document.getElementById('edit-photo-input').addEventListener('change', e => {
    handlePhotoSelect(e.target.files[0], 'edit-photo-preview', 'edit-photo-placeholder');
  });

  document.getElementById('edit-form').addEventListener('submit', e => {
    e.preventDefault();
    const data = getFormData('edit');
    paintStore.update(currentDetailId, data);
    navigateTo('screen-detail');
    openDetail(currentDetailId);
    showToast('更新しました', 'success');
  });

  // ---- スキャン画面 ----
  document.getElementById('btn-back-from-scan').addEventListener('click', () => {
    barcodeScanner.stop();
    navigateTo('screen-list');
  });

  // ---- プリセット画面 ----
  document.getElementById('preset-search').addEventListener('input', e => {
    presetSearchQuery = e.target.value;
    renderPresetColorList();
  });

  document.getElementById('preset-select-all').addEventListener('click', () => {
    const preset = PRESETS.find(p => p.key === currentPresetKey).data();
    const q = presetSearchQuery.toLowerCase();
    preset.colors
      .filter(c => !q || c.colorCode.toLowerCase().includes(q) || c.colorName.toLowerCase().includes(q))
      .forEach(c => presetChecked.add(c.colorCode));
    renderPresetColorList();
  });

  document.getElementById('preset-deselect-all').addEventListener('click', () => {
    presetChecked.clear();
    renderPresetColorList();
  });

  document.getElementById('btn-preset-register').addEventListener('click', registerPresetColors);

  // ---- モーダル背景クリックで閉じる ----
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) hideModal();
  });

  // 初回レンダリング
  renderPaintList();
  navigateTo('screen-list');
});

// ========================================
// フォームユーティリティ
// ========================================
function getFormData(prefix) {
  const get = id => document.getElementById(`${prefix}-${id}`)?.value || '';
  const photoPreview = document.getElementById(`${prefix}-photo-preview`);
  const photo = photoPreview?.src && photoPreview.src !== window.location.href ? photoPreview.src : null;

  return {
    maker: get('maker'),
    series: get('series'),
    colorCode: get('colorCode'),
    colorName: get('colorName'),
    type: get('type'),
    stock: parseInt(get('stock')) || 0,
    memo: get('memo'),
    barcode: get('barcode') || null,
    photo: photo,
  };
}

function handlePhotoSelect(file, previewId, placeholderId) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);
    preview.src = e.target.result;
    preview.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function prefillEditForm(paint) {
  const set = (id, val) => {
    const el = document.getElementById(`edit-${id}`);
    if (el) el.value = val || '';
  };
  set('maker', paint.maker);
  set('series', paint.series);
  set('colorCode', paint.colorCode);
  set('colorName', paint.colorName);
  set('type', paint.type);
  set('stock', paint.stock);
  set('memo', paint.memo);
  set('barcode', paint.barcode);

  const preview = document.getElementById('edit-photo-preview');
  const placeholder = document.getElementById('edit-photo-placeholder');
  if (paint.photo) {
    preview.src = paint.photo;
    preview.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
  }
}
