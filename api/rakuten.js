/**
 * Vercel サーバーレス関数 — 楽天商品検索APIプロキシ
 * CORSを回避しつつAPIキーをクライアントに公開しない
 */
export default async function handler(req, res) {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { jan } = req.query;
  if (!jan) {
    return res.status(400).json({ error: 'JANコードが必要です' });
  }

  const appId = process.env.RAKUTEN_APP_ID;
  if (!appId) {
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  try {
    const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?applicationId=${appId}&keyword=${encodeURIComponent(jan)}&hits=5&sort=+itemPrice`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.Items || data.Items.length === 0) {
      return res.status(404).json({ error: '商品が見つかりませんでした' });
    }

    // 塗料に関連しそうな商品を優先して返す
    const paintKeywords = ['カラー', '塗料', 'ラッカー', 'アクリル', 'エナメル', 'Mr.', 'タミヤ', 'ガイア', 'ホビー'];
    const items = data.Items.map(i => i.Item);

    const paintItem = items.find(item =>
      paintKeywords.some(kw => item.itemName.includes(kw))
    ) || items[0];

    return res.status(200).json({
      itemName: paintItem.itemName,
      itemUrl: paintItem.itemUrl,
      itemPrice: paintItem.itemPrice,
      imageUrl: paintItem.mediumImageUrls?.[0]?.imageUrl || null,
    });

  } catch (e) {
    return res.status(500).json({ error: `API呼び出しエラー: ${e.message}` });
  }
}
