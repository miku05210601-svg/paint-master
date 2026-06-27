/**
 * barcode.js — サーバー側バーコードデコード（全iOS対応）
 * 画像をbase64でVercel APIに送り、サーバー側でzbar-wasmがデコード
 */

class BarcodeScanner {
  async decodeFromImage(imgElement) {
    // Canvas で最大1280pxにリサイズしてbase64取得
    const canvas = document.createElement('canvas');
    const MAX = 1280;
    const w = imgElement.naturalWidth  || imgElement.width  || 1280;
    const h = imgElement.naturalHeight || imgElement.height || 960;
    const scale = Math.min(1, MAX / Math.max(w, h));
    canvas.width  = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(imgElement, 0, 0, canvas.width, canvas.height);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

    const res = await fetch('/api/decode-barcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'decode failed');
    return data.barcode;
  }

  stop() {}
}

const barcodeScanner = new BarcodeScanner();
