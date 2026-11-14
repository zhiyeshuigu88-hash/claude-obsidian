// ポモドーロタイマー（PC の Home とスマホの Home で共通）。
// ページ側に data-el の time-display / mode-label / start-btn / pause-btn / skip-btn / reset-btn / task-select が必要。
// 作業完了時にページ側の onPomodoroComplete() があれば呼ぶ。

const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

function loadMinutes(key, fallback) {
  const stored = window.localStorage.getItem(key);
  const n = Number(stored);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const workMinutes = loadMinutes('taskapp.workMinutes', DEFAULT_WORK_MINUTES);
const breakMinutes = loadMinutes('taskapp.breakMinutes', DEFAULT_BREAK_MINUTES);

let timerMode = 'work';
let secondsLeft = workMinutes * 60;
let timerIntervalId = null;
let timerStartedAt = null;
// 紐付け先。値は 'task:<id>' または 'habit:<id>'（未選択は ''）。
let selectedTarget = '';

function durationForMode(m) {
  return (m === 'work' ? workMinutes : breakMinutes) * 60;
}

// タイマー動作中は画面のスリープを防ぐ（Screen Wake Lock API。非対応・非セキュア環境では何もしない）。
let wakeLock = null;
let wakeLockRequesting = false;

function renderWakeNote() {
  scoped(document, 'wake-note').forEach((el) => (el.hidden = !wakeLock));
}

async function syncWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (!timerIntervalId) {
    if (wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      renderWakeNote();
      lock.release().catch(() => {});
    }
    return;
  }
  if (wakeLock || wakeLockRequesting || document.visibilityState !== 'visible') return;
  wakeLockRequesting = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    // 取得中にタイマーが止まっていたらすぐ解放する
    if (!timerIntervalId) {
      lock.release().catch(() => {});
    } else {
      wakeLock = lock;
      lock.addEventListener('release', () => {
        if (wakeLock === lock) wakeLock = null;
        renderWakeNote();
      });
    }
  } catch {
    // 省電力モードなどで拒否された場合は黙って諦める
  } finally {
    wakeLockRequesting = false;
    renderWakeNote();
  }
}

// タブが隠れるとロックは自動で外れるので、戻ってきたときに取り直す。
document.addEventListener('visibilitychange', syncWakeLock);

function renderTimer() {
  scoped(document, 'time-display').forEach((el) => (el.textContent = formatTime(secondsLeft)));
  // 円形リング（任意）。経過した割合を 0〜1 で渡す
  const elapsed = Math.min(1, Math.max(0, 1 - secondsLeft / durationForMode(timerMode)));
  scoped(document, 'timer-ring').forEach((el) => el.style.setProperty('--p', String(elapsed)));
  scoped(document, 'mode-label').forEach((el) => (el.textContent = timerMode === 'work' ? '作業中' : '休憩中'));
  scoped(document, 'start-btn').forEach((el) => (el.style.display = timerIntervalId ? 'none' : ''));
  scoped(document, 'pause-btn').forEach((el) => (el.style.display = timerIntervalId ? '' : 'none'));
  scoped(document, 'task-select').forEach((el) => (el.disabled = Boolean(timerIntervalId)));
  syncWakeLock();
}

function linkedId(kind) {
  if (timerMode !== 'work' || !selectedTarget.startsWith(kind + ':')) return null;
  return selectedTarget.slice(kind.length + 1);
}

async function handleTimerComplete() {
  clearInterval(timerIntervalId);
  timerIntervalId = null;

  const endTime = new Date();
  const startTime = timerStartedAt || endTime;
  const duration = Math.round((endTime - startTime) / 1000);

  try {
    await apiSend('POST', '/api/pomodoro/sessions', {
      taskId: linkedId('task'),
      habitId: linkedId('habit'),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      type: timerMode,
    });
  } catch (e) {
    console.error(e);
  }

  timerMode = timerMode === 'work' ? 'break' : 'work';
  secondsLeft = durationForMode(timerMode);
  timerStartedAt = null;
  renderTimer();
  if (typeof onPomodoroComplete === 'function') onPomodoroComplete();
}

function tick() {
  secondsLeft -= 1;
  if (secondsLeft <= 0) {
    secondsLeft = 0;
    renderTimer();
    handleTimerComplete();
    return;
  }
  renderTimer();
}

function handleTimerStart() {
  if (!timerIntervalId) {
    timerStartedAt = new Date(Date.now() - (durationForMode(timerMode) - secondsLeft) * 1000);
    timerIntervalId = setInterval(tick, 1000);
  }
  renderTimer();
}

function handleTimerPause() {
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  renderTimer();
}

function handleTimerSkip() {
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  timerMode = timerMode === 'work' ? 'break' : 'work';
  secondsLeft = durationForMode(timerMode);
  timerStartedAt = null;
  renderTimer();
}

function handleTimerReset() {
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  secondsLeft = durationForMode(timerMode);
  timerStartedAt = null;
  renderTimer();
}

scoped(document, 'start-btn').forEach((el) => el.addEventListener('click', handleTimerStart));
scoped(document, 'pause-btn').forEach((el) => el.addEventListener('click', handleTimerPause));
scoped(document, 'skip-btn').forEach((el) => el.addEventListener('click', handleTimerSkip));
scoped(document, 'reset-btn').forEach((el) => el.addEventListener('click', handleTimerReset));
scoped(document, 'task-select').forEach((el) => {
  el.addEventListener('change', () => {
    selectedTarget = el.value;
  });
});

async function loadTimerTaskOptions() {
  const [tasks, habits] = await Promise.all([apiGet('/api/tasks?status=todo'), apiGet('/api/habits')]);
  const option = (kind, item) => `<option value="${kind}:${item.id}">${escapeHtml(item.title)}</option>`;
  const group = (label, kind, items) =>
    items.length ? `<optgroup label="${label}">${items.map((i) => option(kind, i)).join('')}</optgroup>` : '';
  const optionsHtml = '<option value="">（選択なし）</option>' + group('タスク', 'task', tasks) + group('習慣', 'habit', habits);
  scoped(document, 'task-select').forEach((el) => {
    el.innerHTML = optionsHtml;
    el.value = selectedTarget;
    selectedTarget = el.value; // 消えた項目を指していたら未選択に戻す
  });
}

loadTimerTaskOptions();
renderTimer();
