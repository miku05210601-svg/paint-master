/**
 * Vercel サーバーレス関数 — サーバー側バーコードデコード
 * jimp で画像をRGBAピクセルに変換し、zbar-wasm でJANコードを読み取る
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  try {
    const [{ Jimp }, { scanImageData }] = await Promise.all([
      import('jimp'),
      import('@undecaf/zbar-wasm'),
    ]);

    // base64 → Buffer → Jimp で RGBA 取得
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const image = await Jimp.read(buffer);

    // 大きすぎると遅いので最大1280pxにリサイズ
    if (image.bitmap.width > 1280 || image.bitmap.height > 1280) {
      image.scaleToFit(1280, 1280);
    }

    const { data, width, height } = image.bitmap;
    const imageData = { data: new Uint8ClampedArray(data.buffer), width, height };

    const symbols = await scanImageData(imageData);

    if (!symbols || symbols.length === 0) {
      return res.status(404).json({ error: 'バーコードが見つかりませんでした' });
    }

    return res.status(200).json({ barcode: symbols[0].decode() });

  } catch (e) {
    return res.status(500).json({ error: `デコード失敗: ${e.message}` });
  }
}
