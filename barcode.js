/**
 * barcode.js — バーコードスキャン処理
 * html5-qrcode ライブラリを利用（iOS Safari 対応）
 */

class BarcodeScanner {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
  }

  async start(onResult, onError) {
    if (typeof Html5Qrcode === 'undefined') {
      onError?.('バーコードスキャンライブラリの読み込みに失敗しました。');
      return;
    }

    try {
      this.scanner = new Html5Qrcode('barcode-video-container');
      this.isScanning = true;

      await this.scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 240, height: 120 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        },
        (decodedText) => {
          onResult?.(decodedText);
        },
        () => { /* フレームごとの未検出は無視 */ }
      );
    } catch (e) {
      const msg = String(e);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        onError?.('カメラへのアクセスが拒否されました。ブラウザの設定からカメラ許可を有効にしてください。');
      } else if (msg.includes('NotFound')) {
        onError?.('カメラが見つかりません。');
      } else {
        onError?.(`カメラの起動に失敗しました: ${msg}`);
      }
    }
  }

  stop() {
    if (this.scanner && this.isScanning) {
      this.scanner.stop().catch(() => {});
      this.scanner = null;
    }
    this.isScanning = false;
  }
}

const barcodeScanner = new BarcodeScanner();
