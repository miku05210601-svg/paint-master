/**
 * barcode.js — 写真からバーコードをデコード（iOS Safari対応）
 * Canvas経由でZXingに渡すことでiOSの読み取りハングを回避
 */

class BarcodeScanner {
  constructor() {
    this.reader = null;
  }

  async decodeFromImage(imgElement) {
    if (typeof ZXing === 'undefined') {
      throw new Error('ライブラリの読み込みに失敗しました');
    }
    if (!this.reader) {
      this.reader = new ZXing.BrowserMultiFormatReader();
    }

    // iOSではdecodeFromImageElementがハングするためCanvasを使う
    const canvas = document.createElement('canvas');
    const MAX = 1280;
    const scale = Math.min(1, MAX / Math.max(imgElement.naturalWidth, imgElement.naturalHeight));
    canvas.width  = Math.round(imgElement.naturalWidth  * scale);
    canvas.height = Math.round(imgElement.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

    const decode = this.reader.decodeFromCanvas(canvas);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 12000)
    );

    const result = await Promise.race([decode, timeout]);
    return result.getText();
  }

  stop() {}
}

const barcodeScanner = new BarcodeScanner();
