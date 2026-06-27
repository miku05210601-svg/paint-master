/**
 * barcode.js — 写真からバーコードをデコード
 * BarcodeDetector API（iOS 17+ / Chrome Android）を使用
 * フォールバック: ZXing Canvas方式
 */

class BarcodeScanner {
  async decodeFromImage(imgElement) {
    // ネイティブBarcodeDetector（iOS 17+ Safari / Chrome Android）
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
      });
      const results = await detector.detect(imgElement);
      if (results.length > 0) return results[0].rawValue;
      throw new Error('no_barcode');
    }

    // フォールバック: ZXing（Canvas経由）
    if (typeof ZXing !== 'undefined') {
      const reader = new ZXing.BrowserMultiFormatReader();
      const canvas = document.createElement('canvas');
      const MAX = 1280;
      const scale = Math.min(1, MAX / Math.max(imgElement.naturalWidth || 1280, imgElement.naturalHeight || 1280));
      canvas.width  = Math.round((imgElement.naturalWidth  || 1280) * scale);
      canvas.height = Math.round((imgElement.naturalHeight || 960)  * scale);
      canvas.getContext('2d').drawImage(imgElement, 0, 0, canvas.width, canvas.height);

      const decode  = reader.decodeFromCanvas(canvas);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
      const result  = await Promise.race([decode, timeout]);
      return result.getText();
    }

    throw new Error('no_library');
  }

  stop() {}
}

const barcodeScanner = new BarcodeScanner();
