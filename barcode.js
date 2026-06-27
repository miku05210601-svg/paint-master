/**
 * barcode.js — バーコードスキャン処理
 * ZXing-js ライブラリを利用してカメラからバーコードを読み取る
 * ※ カメラAPIはHTTPS または localhost環境でのみ動作します
 */

class BarcodeScanner {
  constructor() {
    this.reader = null;
    this.isScanning = false;
    this.onResult = null;
    this.onError = null;
  }

  async start(videoElement, onResult, onError) {
    this.onResult = onResult;
    this.onError = onError;

    // ZXingがロードされているか確認
    if (typeof ZXing === 'undefined') {
      onError?.('バーコードスキャンライブラリの読み込みに失敗しました。');
      return;
    }

    try {
      const hints = new Map();
      const formats = [
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E,
      ];
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);

      this.reader = new ZXing.BrowserMultiFormatReader(hints);
      this.isScanning = true;

      await this.reader.decodeFromVideoDevice(null, videoElement, (result, err) => {
        if (result) {
          onResult?.(result.getText());
        }
        // err はフレームごとに発生する通常エラーなので無視
      });
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        onError?.('カメラへのアクセスが拒否されました。ブラウザの設定からカメラ許可を有効にしてください。');
      } else if (e.name === 'NotFoundError') {
        onError?.('カメラが見つかりません。');
      } else {
        onError?.(`カメラの起動に失敗しました: ${e.message}`);
      }
    }
  }

  stop() {
    if (this.reader) {
      this.reader.reset();
      this.reader = null;
    }
    this.isScanning = false;
  }
}

const barcodeScanner = new BarcodeScanner();
