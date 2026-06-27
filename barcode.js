/**
 * barcode.js — 写真からバーコードをデコード（iOS Safari対応）
 * ZXing の decodeFromImageElement を使用
 */

class BarcodeScanner {
  constructor() {
    this.reader = null;
  }

  async decodeFromImage(imgElement) {
    if (typeof ZXing === 'undefined') {
      throw new Error('バーコードスキャンライブラリの読み込みに失敗しました。');
    }
    if (!this.reader) {
      this.reader = new ZXing.BrowserMultiFormatReader();
    }
    const result = await this.reader.decodeFromImageElement(imgElement);
    return result.getText();
  }

  stop() {
    // 写真方式ではストップ処理不要
  }
}

const barcodeScanner = new BarcodeScanner();
