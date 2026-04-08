// ============================================================
//  思考メモ → Google Drive 保存 API
//  Google Apps Script にこのコードをそのまま貼り付けてください
// ============================================================

// ▼ ここだけ変更：03_my_diary フォルダの Google Drive ID
const DIARY_FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

// ============================================================
//  POST: 日記エントリを保存
// ============================================================
function doPost(e) {
  try {
    // URLSearchParams 形式で受信（CORS プリフライト回避のため text/plain 送信）
    const payload = JSON.parse(e.parameter.data);
    const { date, entry } = payload;

    const folder = DriveApp.getFolderById(DIARY_FOLDER_ID);
    const fileName = date.replace(/-/g, '') + '.json'; // 例: 20260408.json

    // 既存ファイルを検索
    const files = folder.getFilesByName(fileName);
    let dayData = { date: date, entries: [] };
    let existingFile = null;

    if (files.hasNext()) {
      existingFile = files.next();
      dayData = JSON.parse(existingFile.getBlob().getDataAsString());
    }

    // エントリを追記
    dayData.entries.push(entry);

    const jsonStr = JSON.stringify(dayData, null, 2);

    if (existingFile) {
      existingFile.setContent(jsonStr);
    } else {
      folder.createFile(fileName, jsonStr, MimeType.PLAIN_TEXT);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, id: entry.id, date: date }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
//  GET: 動作確認用
// ============================================================
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'diary-api-ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
