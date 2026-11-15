const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

const workInput = document.getElementById('work-minutes');
const breakInput = document.getElementById('break-minutes');
const savedMsg = document.getElementById('saved-msg');

function loadMinutes(key, fallback) {
  const stored = window.localStorage.getItem(key);
  const n = Number(stored);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

workInput.value = loadMinutes('taskapp.workMinutes', DEFAULT_WORK_MINUTES);
breakInput.value = loadMinutes('taskapp.breakMinutes', DEFAULT_BREAK_MINUTES);

document.getElementById('settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  window.localStorage.setItem('taskapp.workMinutes', String(Number(workInput.value)));
  window.localStorage.setItem('taskapp.breakMinutes', String(Number(breakInput.value)));
  savedMsg.style.display = '';
  setTimeout(() => {
    savedMsg.style.display = 'none';
  }, 2000);
});

// 表示テーマ（選んだ時点で保存・反映する）
const themeSeg = document.getElementById('theme-seg');
function renderThemeSeg() {
  const pref = getThemePref();
  themeSeg.querySelectorAll('.seg-opt').forEach((opt) => {
    const on = opt.dataset.themePref === pref;
    opt.classList.toggle('active', on);
    opt.setAttribute('aria-checked', String(on));
  });
}
themeSeg.querySelectorAll('.seg-opt').forEach((opt) => {
  opt.addEventListener('click', (e) => {
    e.preventDefault();
    setThemePref(opt.dataset.themePref);
    renderThemeSeg();
  });
});
renderThemeSeg();
document.addEventListener('taskapp:themechange', renderThemeSeg);
