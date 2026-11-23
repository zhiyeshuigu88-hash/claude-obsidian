// ②登録・編集フォームロジック
const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER', 'APPEND'];
const RANKS = ['C', 'B', 'A', 'S'];

const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);
const editId = params.get('id');

let photoTouched = false;   // 写真を変更/削除したか
let removePhotoFlag = false; // 既存写真を外すか(編集時)
let flagsManuallyEdited = { fc: false, ap: false };

function fillSelect(sel, values) {
  sel.innerHTML = values.map((v) => `<option value="${v}">${v}</option>`).join('');
}

fillSelect($('#difficulty'), DIFFICULTIES);
fillSelect($('#rank'), RANKS);

function pad(n) { return String(n).padStart(2, '0'); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --- FC/AP 自動判定(サーバーと同じロジック) ---
function computeFlags() {
  const j = readJudgments();
  const ap = j.great === 0 && j.good === 0 && j.bad === 0 && j.miss === 0 && j.perfect > 0;
  const fc = j.miss === 0;
  return { fc, ap };
}
function readJudgments() {
  return {
    perfect: numVal('#perfect'), great: numVal('#great'), good: numVal('#good'),
    bad: numVal('#bad'), miss: numVal('#miss'),
  };
}
function numVal(sel) {
  const v = parseInt($(sel).value, 10);
  return Number.isFinite(v) ? v : 0;
}

function refreshAutoFlags() {
  const { fc, ap } = computeFlags();
  if (!flagsManuallyEdited.fc) $('#isFullCombo').checked = ap || fc;
  if (!flagsManuallyEdited.ap) $('#isAllPerfect').checked = ap;
  $('#autoFlagHint').textContent = ap ? '自動判定: AP' : fc ? '自動判定: FC' : '自動判定: なし';
}

['perfect', 'great', 'good', 'bad', 'miss'].forEach((id) => {
  $(`#${id}`).addEventListener('input', refreshAutoFlags);
});
$('#isFullCombo').addEventListener('change', () => { flagsManuallyEdited.fc = true; });
$('#isAllPerfect').addEventListener('change', () => { flagsManuallyEdited.ap = true; });

// --- 写真プレビュー ---
$('#photoDrop').addEventListener('click', () => $('#photo').click());
$('#photo').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  photoTouched = true;
  removePhotoFlag = false;
  const url = URL.createObjectURL(file);
  showPreview(url);
});
$('#removePhoto').addEventListener('click', () => {
  $('#photo').value = '';
  photoTouched = true;
  removePhotoFlag = true;
  showPreview(null);
});
function showPreview(url) {
  const img = $('#photoPreview');
  const rm = $('#removePhoto');
  if (url) {
    img.src = url; img.hidden = false; rm.hidden = false;
    $('#photoDrop').textContent = 'クリックして写真を変更';
  } else {
    img.hidden = true; rm.hidden = true;
    $('#photoDrop').textContent = 'クリックして写真を選択(この写真を見ながら下の数値を入力します)';
  }
}

// --- 曲名補完(既存レコードから) ---
async function loadSongList() {
  const res = await fetch('/api/records');
  const records = await res.json();
  const titles = [...new Set(records.map((r) => r.songTitle))].sort((a, b) => a.localeCompare(b, 'ja'));
  $('#songList').innerHTML = titles.map((t) => `<option value="${t.replace(/"/g, '&quot;')}"></option>`).join('');
  return records;
}

// --- 編集時: 既存データを読み込む ---
async function initForm() {
  const records = await loadSongList();
  $('#playedAt').value = today();

  if (editId) {
    const r = records.find((x) => x.id === editId);
    if (!r) { $('#errorMsg').textContent = '対象の記録が見つかりません'; return; }
    $('#formTitle').textContent = '🎵 記録の編集';
    $('#songTitle').value = r.songTitle;
    $('#difficulty').value = r.difficulty;
    $('#rank').value = r.rank;
    $('#score').value = r.score;
    $('#maxCombo').value = r.maxCombo;
    const j = r.judgments || {};
    $('#perfect').value = j.perfect; $('#great').value = j.great; $('#good').value = j.good;
    $('#bad').value = j.bad; $('#miss').value = j.miss;
    $('#playedAt').value = r.playedAt;
    $('#isFullCombo').checked = !!r.isFullCombo;
    $('#isAllPerfect').checked = !!r.isAllPerfect;
    flagsManuallyEdited = { fc: true, ap: true }; // 既存値を尊重
    if (r.photoPath) showPreview('/' + r.photoPath);
    $('#autoFlagHint').textContent = '';
  } else {
    // 新規: 判定数は0初期、自動判定を反映
    ['perfect', 'great', 'good', 'bad', 'miss'].forEach((id) => { $(`#${id}`).value = 0; });
    $('#score').value = ''; $('#maxCombo').value = '';
    refreshAutoFlags();
    flagsManuallyEdited = { fc: false, ap: false };
  }
}

// --- 送信 ---
$('#scoreForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#errorMsg').textContent = '';

  const songTitle = $('#songTitle').value.trim();
  if (!songTitle) return fail('曲名を入力してください');

  const nums = ['score', 'maxCombo', 'perfect', 'great', 'good', 'bad', 'miss'];
  for (const id of nums) {
    const raw = $(`#${id}`).value;
    if (raw === '' || parseInt(raw, 10) < 0 || !Number.isInteger(Number(raw))) {
      return fail(`「${id}」は0以上の整数で入力してください`);
    }
  }

  const fd = new FormData();
  fd.append('songTitle', songTitle);
  fd.append('difficulty', $('#difficulty').value);
  fd.append('rank', $('#rank').value);
  fd.append('score', $('#score').value);
  fd.append('maxCombo', $('#maxCombo').value);
  fd.append('perfect', $('#perfect').value);
  fd.append('great', $('#great').value);
  fd.append('good', $('#good').value);
  fd.append('bad', $('#bad').value);
  fd.append('miss', $('#miss').value);
  fd.append('playedAt', $('#playedAt').value);
  fd.append('isFullCombo', $('#isFullCombo').checked);
  fd.append('isAllPerfect', $('#isAllPerfect').checked);

  const file = $('#photo').files[0];
  if (file) fd.append('photo', file);
  if (removePhotoFlag && !file) fd.append('removePhoto', 'true');

  $('#submitBtn').disabled = true;
  try {
    const url = editId ? `/api/records/${editId}` : '/api/records';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return fail(err.error || '保存に失敗しました');
    }
    location.href = 'index.html';
  } catch (err) {
    fail('通信エラー: ' + err.message);
  } finally {
    $('#submitBtn').disabled = false;
  }
});

function fail(msg) {
  $('#errorMsg').textContent = msg;
  $('#submitBtn').disabled = false;
}

initForm();
