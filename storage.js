/**
 * storage.js — データ永続化レイヤー
 * 現在はLocalStorageを使用。将来的にFirebase/Supabaseへ差し替え可能な設計。
 * インターフェース: getAll, add, update, remove, findByBarcode, findDuplicate, getCollectionRate
 */

const STORAGE_KEY_PAINTS = 'paintmaster_paints';
const STORAGE_KEY_SHOPPING = 'paintmaster_shopping';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * PaintStore — 塗料データの永続化管理クラス
 * 将来のDB移行時はこのクラスを差し替える
 */
class PaintStore {
  // ---- 塗料CRUD ----

  getAll() {
    const raw = localStorage.getItem(STORAGE_KEY_PAINTS);
    return raw ? JSON.parse(raw) : [];
  }

  _save(paints) {
    localStorage.setItem(STORAGE_KEY_PAINTS, JSON.stringify(paints));
  }

  add(paintData) {
    const paints = this.getAll();
    const now = new Date().toISOString();
    const paint = {
      id: generateId(),
      maker: paintData.maker || '',
      series: paintData.series || '',
      colorCode: paintData.colorCode || '',
      colorName: paintData.colorName || '',
      type: paintData.type || 'other',
      stock: Number(paintData.stock) || 1,
      memo: paintData.memo || '',
      photo: paintData.photo || null,
      barcode: paintData.barcode || null,
      createdAt: now,
      updatedAt: now,
    };
    paints.push(paint);
    this._save(paints);
    return paint;
  }

  update(id, changes) {
    const paints = this.getAll();
    const idx = paints.findIndex(p => p.id === id);
    if (idx === -1) return null;
    paints[idx] = { ...paints[idx], ...changes, updatedAt: new Date().toISOString() };
    this._save(paints);
    return paints[idx];
  }

  remove(id) {
    const paints = this.getAll().filter(p => p.id !== id);
    this._save(paints);
    // 買い物リストからも削除
    this.removeShoppingByPaintId(id);
  }

  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  }

  // ---- 検索 ----

  search(query) {
    if (!query || !query.trim()) return this.getAll();
    const q = query.trim().toLowerCase();
    return this.getAll().filter(p =>
      p.maker.toLowerCase().includes(q) ||
      p.colorCode.toLowerCase().includes(q) ||
      p.colorName.toLowerCase().includes(q)
    );
  }

  findDuplicate(maker, colorCode) {
    const m = maker.trim().toLowerCase();
    const c = colorCode.trim().toLowerCase();
    return this.getAll().find(
      p => p.maker.toLowerCase() === m && p.colorCode.toLowerCase() === c
    ) || null;
  }

  findByBarcode(barcode) {
    return this.getAll().find(p => p.barcode === barcode) || null;
  }

  // ---- 在庫操作 ----

  incrementStock(id) {
    const paint = this.getById(id);
    if (!paint) return null;
    return this.update(id, { stock: paint.stock + 1 });
  }

  decrementStock(id) {
    const paint = this.getById(id);
    if (!paint || paint.stock <= 0) return null;
    return this.update(id, { stock: Math.max(0, paint.stock - 1) });
  }

  // ---- 買い物リスト ----

  getShoppingList() {
    const raw = localStorage.getItem(STORAGE_KEY_SHOPPING);
    const items = raw ? JSON.parse(raw) : [];
    // 塗料データと結合
    return items.map(item => ({
      ...item,
      paint: this.getById(item.paintId),
    })).filter(item => item.paint !== null);
  }

  addToShopping(paintId) {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY_SHOPPING) || '[]');
    if (items.find(i => i.paintId === paintId)) return; // 重複防止
    items.push({ id: generateId(), paintId });
    localStorage.setItem(STORAGE_KEY_SHOPPING, JSON.stringify(items));
  }

  removeFromShopping(id) {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY_SHOPPING) || '[]')
      .filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY_SHOPPING, JSON.stringify(items));
  }

  removeShoppingByPaintId(paintId) {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY_SHOPPING) || '[]')
      .filter(i => i.paintId !== paintId);
    localStorage.setItem(STORAGE_KEY_SHOPPING, JSON.stringify(items));
  }

  isInShopping(paintId) {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY_SHOPPING) || '[]');
    return items.some(i => i.paintId === paintId);
  }

  // 購入済み処理: 在庫++ してリストから削除
  markAsPurchased(shoppingItemId) {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY_SHOPPING) || '[]');
    const item = items.find(i => i.id === shoppingItemId);
    if (!item) return;
    this.incrementStock(item.paintId);
    this.removeFromShopping(shoppingItemId);
  }

  // ---- 将来拡張用スタブ ----

  /**
   * コレクション率を計算する（将来: メーカー別プリセットデータと照合）
   * @param {string} maker - メーカー名
   * @param {number} totalCount - そのメーカーの全色数（プリセットから渡す）
   * @returns {{ owned: number, total: number, rate: number }}
   */
  getCollectionRate(maker, totalCount) {
    const owned = this.getAll().filter(p => p.maker === maker).length;
    const total = totalCount || owned;
    return { owned, total, rate: total > 0 ? Math.round((owned / total) * 100) : 0 };
  }

  /**
   * プリセットから一括登録する（将来実装）
   * presets/mr-color.js 等から呼び出す想定
   * @param {Array} presetPaints - プリセット塗料配列
   */
  addFromPreset(presetPaints) {
    // TODO: プリセット実装時にここを実装する
    console.warn('addFromPreset: 将来実装予定');
  }
}

const paintStore = new PaintStore();
