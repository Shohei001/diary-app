// ============================================================
//  思考メモ API（バックエンド）
//  Google Apps Script にこのコードをそのまま貼り付けてください
//
//  【セットアップ後にやること】
//  1. DIARY_FOLDER_ID を書き換える
//  2. GASエディタ上部「プロジェクトの設定（歯車アイコン）」
//     →「スクリプトのプロパティ」→「プロパティを追加」
//     　 プロパティ名: GEMINI_API_KEY
//     　 値: AIzaSy... （Gemini APIキー）
// ============================================================

// ▼ ここだけ変更：03_my_diary フォルダの Google Drive ID
const DIARY_FOLDER_ID = '1ffftUW5wqYoAt36kHSijGNzMpocrF1Sk';

// ============================================================
//  ルーティング
// ============================================================
function doPost(e) {
  try {
    // JSON body（e.postData.contents）を優先、URLSearchParams（e.parameter.data）にフォールバック
    let rawData = '{}';
    if (e.postData && e.postData.contents) {
      rawData = e.postData.contents;
    } else if (e.parameter && e.parameter.data) {
      rawData = e.parameter.data;
    }
    const payload = JSON.parse(rawData);
    const action = payload.action || 'save';

    if (action === 'chat') {
      return handleChat(payload);
    } else {
      return handleSave(payload);
    }
  } catch (err) {
    return respond({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  return respond({ status: 'diary-api-ok' });
}

// ============================================================
//  チャット処理：Gemini API を呼び出して返す
// ============================================================
function handleChat(payload) {
  const geminiKey = PropertiesService.getScriptProperties()
                      .getProperty('GEMINI_API_KEY');

  if (!geminiKey) {
    return respond({
      success: false,
      error: 'GEMINI_API_KEY がスクリプトプロパティに設定されていません'
    });
  }

  const systemPrompt =
    'あなたはショウヘイの思考整理パートナーです。\n' +
    'ショウヘイのプロフィール：30代・DXコンサルタント・MBA・子育て中・AI活用・副業・サイドFIREを目指している。\n\n' +

    '## 会話の進め方（3フェーズ制）\n\n' +
    '会話ターン数（userの発言回数）を見てフェーズを自動判定する。\n\n' +

    '---\n\n' +
    '### Phase 1：具体化（1〜2ターン目）\n\n' +
    'メモが抽象的・ふんわりしているうちはこのフェーズを続ける。\n' +
    '抽象の基準：場面・固有名詞・数字がほぼない文章。\n\n' +
    '応答の型：\n' +
    '・場面を引き出す問いを1〜2個（「それはどんな場面で？」「いつ・誰と・何が起きた？」）\n' +
    '・仮説がある場合のみ「たとえば〜ということ？」と1つ添える\n' +
    '・X切り口はまだ出さない\n\n' +

    '---\n\n' +
    '### Phase 2：深掘り（3〜4ターン目、または具体が出た時点で即移行）\n\n' +
    '具体的な場面・感情・出来事が1つ以上出たらこのフェーズへ移行する。\n\n' +
    '応答の型：\n' +
    '・原因・構造・感情・パターンを問う問いを1〜2個（「なぜそうなった？」「それはいつも起きる？」）\n' +
    '・X切り口候補を1〜2個「✦ 切り口候補（まだ磨ける）」として先出しする\n\n' +

    '---\n\n' +
    '### Phase 3：構造化整理（5ターン目以降、または「整理して」と言われた時点で即移行）\n\n' +
    '会話全体を整理し、思考の枠組みを提案するフェーズ。\n' +
    '応答の型：必ず以下の「思考整理カード」を出力した後、X切り口を2〜3個提案する。\n\n' +
    '【思考整理カード】\n' +
    '📌 状況：（何があったか・1〜2行）\n' +
    '💡 気づき：（あなたが感じた・気づいたこと）\n' +
    '🔍 なぜ：（背景にある原因・構造・パターン）\n' +
    '🎯 意味：（自分にとってどんな意味・示唆があるか）\n' +
    '⚡ 次の一手：（考えること・試すこと・決めること）\n\n' +
    '✦ X投稿の切り口（磨けば即投稿できるレベル）\n' +
    '・切り口名：（ひとことで）\n' +
    '・切り口名：（ひとことで）\n\n' +

    '---\n\n' +
    '## 全フェーズ共通ルール\n' +
    '- 問いはコーチング的に。評価・解説・アドバイスはしない。\n' +
    '- 1ターンで質問は最大2個まで。多いと答えにくい。\n' +
    '- 深掘りの答えが出たら次ターンで即 Phase 3 に移行してOK。\n' +
    '- 「どうしたいですか」「何が言いたいですか」は聞かない。\n' +
    '- 会話履歴を必ず参照し、同じ問いを繰り返さない。\n' +
    '- X切り口は「観察・気づき型」「失敗・反省型」「構造化型」「問い型」「実験・試行型」から選ぶ。\n' +
    '- 返答は200字以内を目安に簡潔に。';

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
    geminiKey;

  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: payload.history,
    generationConfig: { temperature: 0.8, maxOutputTokens: 2000 }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode !== 200) {
    return respond({ success: false, error: 'Gemini APIエラー: ' + responseText });
  }

  const data = JSON.parse(responseText);
  const aiText = data.candidates &&
                 data.candidates[0] &&
                 data.candidates[0].content &&
                 data.candidates[0].content.parts &&
                 data.candidates[0].content.parts[0]
                 ? data.candidates[0].content.parts[0].text
                 : '（応答なし）';

  return respond({ success: true, text: aiText });
}

// ============================================================
//  保存処理：Google Drive に YYYYMMDD.json を作成／追記
// ============================================================
function handleSave(payload) {
  const { date, entry } = payload;

  const folder = DriveApp.getFolderById(DIARY_FOLDER_ID);
  const fileName = date.replace(/-/g, '') + '.json'; // 例: 20260409.json

  let dayData = { date: date, entries: [] };
  let existingFile = null;

  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    existingFile = files.next();
    dayData = JSON.parse(existingFile.getBlob().getDataAsString());
  }

  dayData.entries.push(entry);

  const jsonStr = JSON.stringify(dayData, null, 2);

  if (existingFile) {
    existingFile.setContent(jsonStr);
  } else {
    folder.createFile(fileName, jsonStr, MimeType.PLAIN_TEXT);
  }

  return respond({ success: true, id: entry.id, date: date });
}

// ============================================================
//  共通レスポンスヘルパー
// ============================================================
function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
