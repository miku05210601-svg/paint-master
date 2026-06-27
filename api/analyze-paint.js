/**
 * Vercel サーバーレス関数 — Claude Vision で塗料ラベルを解析
 */
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { imageBase64 } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 がありません' });

  // base64のデータURL部分を除去してメディアタイプを取得
  const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!match) return res.status(400).json({ error: '無効な画像フォーマットです' });
  const mediaType = match[1];
  const base64Data = match[2];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `この画像はプラモデル用塗料のボトルやパッケージです。
以下の情報を読み取って、JSONのみ返してください（説明文不要）。

{
  "maker": "メーカー名（Mr.カラー / タミヤカラー / 水性ホビーカラー / ガイアカラー / ファレホ / その他）",
  "colorCode": "色番号（例: C-5, XF-2, H-3 など）",
  "colorName": "色名（例: スカイブルー, フラットホワイト など）",
  "type": "塗料種別（lacquer=ラッカー / acrylic=水性 / enamel=エナメル / other）"
}

読み取れない項目は空文字にしてください。JSONのみ出力してください。`,
            },
          ],
        },
      ],
    });

    const text = message.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(422).json({ error: '解析結果を取得できませんでした', raw: text });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
