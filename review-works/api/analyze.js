const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';

function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.length || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function textFromResponse(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if ((c.type === 'output_text' || c.type === 'text') && c.text) parts.push(c.text);
    }
  }
  return parts.join('\n');
}

function parseJson(text) {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI response was not valid JSON');
  return JSON.parse(m[0]);
}

function clampString(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }

function buildReviewPrompt(payload) {
  const styleMap = {
    plain: '実用重視。本人の言葉を活かし、読みやすく自然に整理。',
    emotional: '感情を1〜2箇所だけ少し前に出す。誇張・創作・宣伝調は禁止。',
    story: '訪問→体験→印象→役立つ情報の順で短いストーリーにする。創作は禁止。',
    ask: 'Ask Maps/AIOを意識し、利用時間帯・人数・同行者・待ち時間・アクセス・設備・支払いなど、利用者の質問に答えられる具体情報を優先。ただしキーワード列記は禁止。'
  };
  return `あなたはGoogle Mapsの実体験レビュー編集者です。検索順位を操作する文章ではなく、他の利用者の判断に役立つ自然なレビューを作ってください。

重要ルール:
- ユーザーのメモ、選択した事実、写真から高い確信で確認できる内容だけを使う。
- 写真から見えるものは「写真で確認できた事実」として扱い、見えないことを推測しない。
- 人物の属性・感情・関係性を写真から推測しない。
- メニュー写真は、文字が明確に読める場合だけ料理名・価格を抽出。読めなければ不明とする。
- 車いす、子連れ、駐車場、予約、支払いなどは、ユーザーが明示した内容を最優先し、写真だけで断定しない。
- キーワードや意味語を列記しない。本文には自然な文脈として最大2〜3軸まで。
- 「最高」「絶対」「一番」など根拠のない最上級、宣伝調、来店を煽る締めは禁止。
- 店名・エリアが未入力なら無理に補わない。
- 目安200〜350文字。事実量が少なければ短くてよい。

文章スタイル: ${styleMap[payload.style] || styleMap.plain}

入力:
店名: ${clampString(payload.store, 100) || '未入力'}
エリア: ${clampString(payload.area, 100) || '未入力'}
体験メモ: ${clampString(payload.memo, 5000)}
選択した補足: ${JSON.stringify(payload.selections || [])}
Google Maps補足事実: ${JSON.stringify(payload.facts || {})}
写真種別タグ: ${JSON.stringify(payload.photoTags || [])}

必ず次のJSONだけを返してください。説明やMarkdownは禁止:
{
  "review": "完成レビュー本文",
  "photo_summary": "写真から確認できた内容の短い要約。写真なしなら空文字",
  "photo_facts": [{"text":"確認できた事実","confidence":"high|medium|low"}],
  "menu_items": [{"name":"料理・商品名","price":"読めた場合のみ。なければ空文字","confidence":"high|medium|low"}],
  "semantic_axes": ["本文で実際に役立てた意味軸"],
  "used_facts": ["レビューに採用した事実"],
  "warnings": ["確認が必要な点。なければ空配列"]
}`;
}

function buildReplyPrompt(payload) {
  return `あなたはGoogleビジネスプロフィールのレビュー返信支援者です。レビューを書いた人の心理を断定せず、文面から感情・期待・不満の背景・再来店障壁を仮説として整理し、誠実な返信を作ってください。

重要ルール:
- 人格、本心、病状などを断定しない。
- レビューの具体点を1〜2点だけ自然に受け止める。キーワード列記は禁止。
- 低評価は言い訳より受け止めを先にする。
- 店舗側で確認していない事実を作らない。
- クリニック・歯科では、治療効果の保証、比較優良、患者個人の症状・診断・処方・治療内容の公開返信、治療体験談の広告的再利用を避ける。
- 医療以外でも「絶対」「必ず」「No.1」「他店より優れる」など根拠のない表現を避ける。

店舗名: ${clampString(payload.store,100) || '当店'}
業態: ${clampString(payload.industry,40) || '未指定'}
星評価: ${clampString(payload.stars,10) || '未指定'}
レビュー本文: ${clampString(payload.review,6000)}
店舗側で確認できている事実: ${clampString(payload.confirmedFacts,2000) || 'なし'}

必ず次のJSONだけを返してください。説明やMarkdownは禁止:
{
  "psychology": {"emotion":"感情の仮説","expectation":"期待の仮説","barrier":"再来店障壁の仮説","confidence":0},
  "reply":"公開用の自然な返信本文",
  "semantic_axes":["自然に反映した意味軸"],
  "legal_warnings":["法令・プライバシー上の注意。なければ空配列"],
  "reasoning_evidence":["仮説の根拠になったレビュー内の短い要点。直接引用は最小限"]
}`;
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const mode = body.mode === 'reply' ? 'reply' : 'review';
    const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
    const safeImages = images.filter(x => typeof x === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(x) && x.length < 1400000);
    const prompt = mode === 'reply' ? buildReplyPrompt(body) : buildReviewPrompt(body);
    const content = [{ type: 'input_text', text: prompt }];
    if (mode === 'review') {
      for (const image of safeImages) content.push({ type: 'input_image', image_url: image, detail: 'high' });
    }

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: 'low' },
        max_output_tokens: 1800,
        input: [{ role: 'user', content }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('OpenAI error', data);
      return res.status(r.status).json({ error: 'AI request failed' });
    }
    const parsed = parseJson(textFromResponse(data));
    return res.status(200).json({ ok: true, model: MODEL, result: parsed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Analysis failed' });
  }
};