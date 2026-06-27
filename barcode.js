/**
 * barcode.js — バーコードスキャン処理
 * html5-qrcode ライブラリを利用（iOS Safari 対応）
 */

class BarcodeScanner {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
  }

  async start(videoElement, onResult, onError) {
    if (typeof Html5Qrcode === 'undefined') {
      onError?.('バーコードスキャンライブラリの読み込みに失敗しました。');
      return;
    }

    // html5-qrcode は要素IDで動作するため、video要素の親divのIDを使う
    const containerId = 'barcode-video-container';
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      videoElement.parentNode.replaceChild(container, videoElement);
    }

    try {
      this.scanner = new Html5Qrcode(containerId);
      this.isScanning = true;

      await this.scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
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
        () => {
          // フレームごとの未検出エラーは無視
        }
      );
    } catch (e) {
      if (e.toString().includes('Permission') || e.toString().includes('NotAllowed')) {
        onError?.('カメラへのアクセスが拒否されました。ブラウザの設定からカメラ許可を有効にしてください。');
      } else if (e.toString().includes('NotFound')) {
        onError?.('カメラが見つかりません。');
      } else {
        onError?.(`カメラの起動に失敗しました: ${e}`);
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
