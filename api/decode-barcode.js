/**
 * Vercel サーバーレス関数 — サーバー側バーコードデコード
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { imageBase64 } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 がありません' });
  }

  try {
    // jimp: default export を取得
    const jimpMod = await import('jimp');
    const Jimp = jimpMod.default ?? jimpMod.Jimp;

    const { scanImageData } = await import('@undecaf/zbar-wasm');

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const image = await Jimp.read(buffer);
    if (image.bitmap.width > 1024 || image.bitmap.height > 1024) {
      image.scaleToFit(1024, 1024);
    }

    const { data, width, height } = image.bitmap;
    const symbols = await scanImageData({ data: new Uint8ClampedArray(data.buffer), width, height });

    if (!symbols || symbols.length === 0) {
      return res.status(404).json({ error: 'バーコードが見つかりませんでした' });
    }

    return res.status(200).json({ barcode: symbols[0].decode() });

  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
