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
const DIARY_FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

// ============================================================
//  ルーティング
// ============================================================
function doPost(e) {
  try {
    const payload = JSON.parse(e.parameter.data);
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
    'あなたの役割：\n' +
    '1. ショウヘイが書いた思考メモに対して「掘り下げ質問」を1〜2個する（一問一答形式。長々と解説しない）\n' +
    '2. X（旧Twitter）投稿の切り口を1〜3個提案する\n\n' +
    '回答の形式：\n' +
    '---\n' +
    '[掘り下げ質問]\n' +
    '（1〜2文の自然な問いかけ）\n\n' +
    '[X投稿の切り口]\n' +
    '・切り口名：（ひとことで）\n' +
    '・切り口名：（ひとことで）\n' +
    '---\n\n' +
    '注意：\n' +
    '- 掘り下げ質問はコーチング的に。評価・解説はしない。\n' +
    '- X切り口は「観察・気づき型」「失敗・反省型」「構造化型」「問い型」「実験・試行型」などから選ぶ。\n' +
    '- 初回以外は、会話の流れを踏まえて質問する。';

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
    geminiKey;

  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: payload.history,
    generationConfig: { temperature: 0.8, maxOutputTokens: 600 }
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
