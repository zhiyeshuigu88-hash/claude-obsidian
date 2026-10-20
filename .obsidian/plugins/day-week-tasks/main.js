'use strict';

const { Plugin, ItemView, Modal, Notice, PluginSettingTab, Setting, TFile, normalizePath } = require('obsidian');

const VIEW_TYPE = 'day-week-tasks-view';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const DEFAULT_SETTINGS = {
  dailyFolder: 'claude/diary',
  weeklyFolder: 'claude/weekly',
  recurringFile: 'claude/tasks/繰り返し.md',
  taskHeading: 'タスク',
};

// ---------------------------------------------------------------------------
// 日付ヘルパー（週は日曜始まり）
// ---------------------------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return formatDate(d) === s ? d : null;
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function startOfWeek(d) {
  return addDays(d, -d.getDay());
}

function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function shortLabel(d) {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

function sameDay(a, b) {
  return formatDate(a) === formatDate(b);
}

// ---------------------------------------------------------------------------
// Markdown ヘルパー
// ---------------------------------------------------------------------------

const TASK_RE = /^- \[(.)\] (.*)$/;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 見出しから次の同レベル以上の見出しまでを返す（end は区間の直後の行番号）
function findSection(lines, heading) {
  const re = new RegExp('^(#{1,6})\\s+' + escapeRe(heading) + '\\s*$');
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const h = /^(#{1,6})\s/.exec(lines[j]);
      if (h && h[1].length <= level) {
        end = j;
        break;
      }
    }
    return { start: i, end };
  }
  return null;
}

// 見出しがなければ null、あればその区間のトップレベルのタスクを返す
function parseTasks(content, heading) {
  const lines = content.split('\n');
  const sec = findSection(lines, heading);
  if (!sec) return null;
  const tasks = [];
  for (let i = sec.start + 1; i < sec.end; i++) {
    const m = TASK_RE.exec(lines[i]);
    if (m) tasks.push({ line: i, status: m[1], text: m[2].trim() });
  }
  return tasks;
}

function isDone(task) {
  return task.status === 'x' || task.status === 'X';
}

function isOpen(task) {
  return task.status === ' ';
}

// 見出しがなければ本文の先頭（frontmatter の後）に作る
function ensureSection(content, heading) {
  const lines = content.split('\n');
  if (findSection(lines, heading)) return content;
  let insertAt = 0;
  if (lines[0] === '---') {
    const close = lines.indexOf('---', 1);
    if (close > 0) insertAt = close + 1;
  }
  const block = content.trim() === '' ? [`## ${heading}`] : [`## ${heading}`, ''];
  lines.splice(insertAt, 0, ...block);
  return lines.join('\n');
}

// 区間内の最後のタスク（とその子要素）の直後に追加する。同じ内容のタスクがあれば追加しない
function addTasks(content, heading, texts) {
  content = ensureSection(content, heading);
  const lines = content.split('\n');
  const sec = findSection(lines, heading);
  const existing = new Set((parseTasks(content, heading) || []).map((t) => t.text));
  let at = sec.start + 1;
  let inTask = false;
  for (let i = sec.start + 1; i < sec.end; i++) {
    if (TASK_RE.test(lines[i])) {
      at = i + 1;
      inTask = true;
    } else if (inTask && /^\s+\S/.test(lines[i])) {
      at = i + 1;
    } else {
      inTask = false;
    }
  }
  const toAdd = [];
  for (const raw of texts) {
    const text = raw.trim();
    if (!text || existing.has(text)) continue;
    existing.add(text);
    toAdd.push(`- [ ] ${text}`);
  }
  lines.splice(at, 0, ...toAdd);
  return lines.join('\n');
}

// 内容が一致するタスクの状態を変える。shouldChange で対象を絞れる
function setTaskStatus(content, heading, text, status, shouldChange = () => true) {
  const tasks = parseTasks(content, heading);
  if (!tasks) return content;
  const target = tasks.find((t) => t.text === text && t.status !== status && shouldChange(t));
  if (!target) return content;
  const lines = content.split('\n');
  lines[target.line] = `- [${status}] ${target.text}`;
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 繰り返しタスク
//   - 毎日: 〇〇
//   - 平日: 〇〇 / - 土日: 〇〇
//   - 毎週 月曜: 〇〇（複数なら 毎週 月・木曜）→ 日のノートへ
//   - 毎週: 〇〇 → 週のノートへ
// ---------------------------------------------------------------------------

function parseWeekdays(spec) {
  const days = [];
  for (const token of spec.split(/[、,・\s]+/)) {
    const idx = WEEKDAYS.indexOf(token.charAt(0));
    if (idx === -1 || !/^.(曜日?)?$/.test(token)) return null;
    if (!days.includes(idx)) days.push(idx);
  }
  return days.length ? days : null;
}

function parseRecurring(content) {
  const rules = [];
  let inFence = false;
  for (const raw of content.split('\n')) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^\s*[-*]\s+(.+?)\s*[:：]\s*(.+)$/.exec(raw);
    if (!m) continue;
    const spec = m[1].replace(/\s+/g, ' ').trim();
    const text = m[2].trim();
    if (spec === '毎日') {
      rules.push({ target: 'daily', days: [0, 1, 2, 3, 4, 5, 6], text });
    } else if (spec === '平日') {
      rules.push({ target: 'daily', days: [1, 2, 3, 4, 5], text });
    } else if (spec === '土日' || spec === '週末') {
      rules.push({ target: 'daily', days: [0, 6], text });
    } else if (spec === '毎週') {
      rules.push({ target: 'weekly', text });
    } else {
      const w = /^毎週\s*(.+)$/.exec(spec);
      const days = w && parseWeekdays(w[1]);
      if (days) rules.push({ target: 'daily', days, text });
    }
  }
  return rules;
}

function dailyRecurringFor(rules, date) {
  return rules.filter((r) => r.target === 'daily' && r.days.includes(date.getDay())).map((r) => r.text);
}

function weeklyRecurring(rules) {
  return rules.filter((r) => r.target === 'weekly').map((r) => r.text);
}

// ---------------------------------------------------------------------------
// プラグイン本体
// ---------------------------------------------------------------------------

class DayWeekTasksPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.registerView(VIEW_TYPE, (leaf) => new TasksView(leaf, this));
    this.addRibbonIcon('calendar-check', '今日・今週のタスク', () => this.activateView());
    this.addCommand({
      id: 'open-view',
      name: '今日・今週のタスクを開く',
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: 'start-today',
      name: '今日を始める（繰り越し・繰り返しタスクを追加）',
      callback: () => this.startPeriod('day', today()),
    });
    this.addSettingTab(new DayWeekTasksSettingTab(this.app, this));

    const onChange = (file) => this.onFileChange(file);
    this.registerEvent(this.app.vault.on('modify', onChange));
    this.registerEvent(this.app.vault.on('create', onChange));
    this.registerEvent(this.app.vault.on('delete', onChange));
    this.registerEvent(this.app.vault.on('rename', onChange));
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshViews();
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) || workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof TasksView) leaf.view.scheduleRender();
    }
  }

  // ---- パス

  folder(kind) {
    return normalizePath(kind === 'day' ? this.settings.dailyFolder : this.settings.weeklyFolder);
  }

  // kind が 'week' のときは、その週の日曜日の日付をファイル名にする
  notePath(kind, date) {
    const key = kind === 'day' ? date : startOfWeek(date);
    return normalizePath(`${this.folder(kind)}/${formatDate(key)}.md`);
  }

  getFile(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }

  async readNote(kind, date) {
    const file = this.getFile(this.notePath(kind, date));
    return file ? this.app.vault.read(file) : null;
  }

  async ensureFolder(path) {
    const parts = normalizePath(path).split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  // ノートがなければテンプレートから作り、内容を書き換える
  async updateNote(kind, date, fn) {
    const path = this.notePath(kind, date);
    const file = this.getFile(path);
    if (file) {
      await this.app.vault.process(file, fn);
      return;
    }
    await this.ensureFolder(this.folder(kind));
    await this.app.vault.create(path, fn(this.template(kind, date)));
  }

  template(kind, date) {
    const h = this.settings.taskHeading;
    if (kind === 'day') return `## ${h}\n\n## 日記\n`;
    const sun = startOfWeek(date);
    return `# ${shortLabel(sun)} 〜 ${shortLabel(addDays(sun, 6))}\n\n## ${h}\n\n## 振り返り\n`;
  }

  // 指定日より前で一番新しいノート（週なら前の週以前）
  findPreviousNote(kind, date) {
    const folder = this.folder(kind);
    const limit = formatDate(kind === 'day' ? date : startOfWeek(date));
    let best = null;
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (f.parent?.path !== folder || !parseDate(f.basename)) continue;
      if (f.basename < limit && (!best || f.basename > best.basename)) best = f;
    }
    return best;
  }

  async loadRecurringRules() {
    const file = this.getFile(normalizePath(this.settings.recurringFile));
    return file ? parseRecurring(await this.app.vault.read(file)) : [];
  }

  // 「今日を始める」「今週を始める」で追加されるタスクの下見
  async previewStart(kind, date) {
    const prev = this.findPreviousNote(kind, date);
    const carried = prev
      ? (parseTasks(await this.app.vault.read(prev), this.settings.taskHeading) || []).filter(isOpen).map((t) => t.text)
      : [];
    const rules = await this.loadRecurringRules();
    const recurring = kind === 'day' ? dailyRecurringFor(rules, date) : weeklyRecurring(rules);
    return { prev, carried, recurring };
  }

  // 前のノートの未完了タスクを [>] にして持ってきて、繰り返しタスクも追加する
  async startPeriod(kind, date) {
    const h = this.settings.taskHeading;
    const { prev, carried, recurring } = await this.previewStart(kind, date);
    await this.updateNote(kind, date, (c) => addTasks(c, h, [...carried, ...recurring]));
    if (prev && carried.length) {
      await this.app.vault.process(prev, (c) => {
        for (const text of carried) c = setTaskStatus(c, h, text, '>', isOpen);
        return c;
      });
    }
    const label = kind === 'day' ? '今日' : '今週';
    new Notice(`${label}を始めました（繰り越し ${carried.length} 件・繰り返し ${recurring.length} 件）`);
  }

  async addTasks(kind, date, texts) {
    await this.updateNote(kind, date, (c) => addTasks(c, this.settings.taskHeading, texts));
  }

  async setStatus(kind, date, text, status) {
    const h = this.settings.taskHeading;
    await this.updateNote(kind, date, (c) => setTaskStatus(c, h, text, status));
    // 日のタスクのチェックを外したら、週の同じタスクも未完了に戻す
    if (kind === 'day' && status === ' ') {
      const week = this.getFile(this.notePath('week', date));
      if (week) await this.app.vault.process(week, (c) => setTaskStatus(c, h, text, ' ', isDone));
    }
  }

  // 日のノートで完了したタスクを、週のノートにも反映する
  async syncDayToWeek(dayFile) {
    const date = parseDate(dayFile.basename);
    const week = this.getFile(this.notePath('week', date));
    if (!week) return;
    const h = this.settings.taskHeading;
    const done = (parseTasks(await this.app.vault.read(dayFile), h) || []).filter(isDone).map((t) => t.text);
    if (!done.length) return;
    const weekTasks = parseTasks(await this.app.vault.read(week), h) || [];
    const toComplete = weekTasks.filter((t) => isOpen(t) && done.includes(t.text)).map((t) => t.text);
    if (!toComplete.length) return;
    await this.app.vault.process(week, (c) => {
      for (const text of toComplete) c = setTaskStatus(c, h, text, 'x', isOpen);
      return c;
    });
  }

  onFileChange(file) {
    const path = file.path;
    const inFolder = (folder) => path.startsWith(folder + '/');
    if (inFolder(this.folder('day')) || inFolder(this.folder('week')) || path === normalizePath(this.settings.recurringFile)) {
      this.refreshViews();
    }
    if (file instanceof TFile && file.parent?.path === this.folder('day') && parseDate(file.basename) && this.app.vault.getAbstractFileByPath(path)) {
      this.syncDayToWeek(file).catch((e) => console.error('[day-week-tasks]', e));
    }
  }
}

// ---------------------------------------------------------------------------
// サイドバーの画面
// ---------------------------------------------------------------------------

class TasksView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = 'day';
    this.date = today();
    this.lastToday = today();
    this.drafts = { day: '', week: '' };
    this.renderId = 0;
    this.renderTimer = null;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return '今日・今週のタスク';
  }

  getIcon() {
    return 'calendar-check';
  }

  async onOpen() {
    this.contentEl.addClass('dwt-view');
    // 日付が変わったら「今日」を進める
    this.registerInterval(
      window.setInterval(() => {
        const t = today();
        if (sameDay(t, this.lastToday)) return;
        if (sameDay(this.date, this.lastToday)) this.date = t;
        this.lastToday = t;
        this.render();
      }, 60 * 1000)
    );
    await this.render();
  }

  scheduleRender() {
    window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.render(), 200);
  }

  async run(action) {
    try {
      await action();
    } catch (e) {
      console.error('[day-week-tasks]', e);
      new Notice('エラーが発生しました: ' + e.message);
    }
    this.scheduleRender();
  }

  async render() {
    const id = ++this.renderId;
    const p = this.plugin;
    const h = p.settings.taskHeading;
    const data = {};
    if (this.tab === 'day') {
      const content = await p.readNote('day', this.date);
      data.tasks = content === null ? null : parseTasks(content, h);
      const weekContent = await p.readNote('week', this.date);
      const weekTasks = weekContent === null ? [] : parseTasks(weekContent, h) || [];
      const inDay = new Set((data.tasks || []).map((t) => t.text));
      data.assignable = weekTasks.filter((t) => isOpen(t) && !inDay.has(t.text)).map((t) => t.text);
      if (data.tasks === null && sameDay(this.date, today())) data.preview = await p.previewStart('day', this.date);
    } else {
      const content = await p.readNote('week', this.date);
      data.tasks = content === null ? null : parseTasks(content, h);
      if (data.tasks === null && sameDay(startOfWeek(this.date), startOfWeek(today()))) {
        data.preview = await p.previewStart('week', this.date);
      }
      data.days = [];
      const sun = startOfWeek(this.date);
      for (let i = 0; i < 7; i++) {
        const d = addDays(sun, i);
        const c = await p.readNote('day', d);
        const tasks = c === null ? [] : parseTasks(c, h) || [];
        const counted = tasks.filter((t) => isOpen(t) || isDone(t));
        data.days.push({ date: d, total: counted.length, done: counted.filter(isDone).length });
      }
    }
    if (id !== this.renderId) return;

    const root = this.contentEl;
    root.empty();
    this.renderTabs(root);
    if (this.tab === 'day') this.renderDay(root, data);
    else this.renderWeek(root, data);
  }

  renderTabs(root) {
    const tabs = root.createDiv({ cls: 'dwt-tabs' });
    for (const [key, label] of [['day', '今日'], ['week', '今週']]) {
      const btn = tabs.createEl('button', { text: label, cls: 'dwt-tab' });
      if (this.tab === key) btn.addClass('is-active');
      btn.onclick = () => {
        this.tab = key;
        this.render();
      };
    }
  }

  renderNav(root, label, onPrev, onNext, onToday, path) {
    const nav = root.createDiv({ cls: 'dwt-nav' });
    nav.createEl('button', { text: '◀', cls: 'dwt-nav-btn' }).onclick = onPrev;
    const title = nav.createEl('span', { text: label, cls: 'dwt-nav-title' });
    title.onclick = () => {
      if (this.plugin.getFile(path)) this.app.workspace.openLinkText(path, '', false);
    };
    title.setAttr('title', 'ノートを開く');
    nav.createEl('button', { text: '▶', cls: 'dwt-nav-btn' }).onclick = onNext;
    if (onToday) nav.createEl('button', { text: onToday.label, cls: 'dwt-nav-today' }).onclick = onToday.fn;
  }

  renderDay(root, data) {
    const p = this.plugin;
    const isToday = sameDay(this.date, today());
    this.renderNav(
      root,
      shortLabel(this.date) + (isToday ? ' 今日' : ''),
      () => {
        this.date = addDays(this.date, -1);
        this.render();
      },
      () => {
        this.date = addDays(this.date, 1);
        this.render();
      },
      isToday ? null : { label: '今日へ', fn: () => { this.date = today(); this.render(); } },
      p.notePath('day', this.date)
    );

    if (data.preview) {
      this.renderStart(root, '今日を始める', data.preview, () => p.startPeriod('day', this.date));
    } else if (data.tasks === null) {
      root.createDiv({ cls: 'dwt-empty', text: 'この日のノートはまだありません' });
    }

    this.renderTaskList(root, data.tasks || [], 'day');
    this.renderAddForm(root, 'day');

    if (data.assignable.length) {
      const btn = root.createEl('button', { text: `今週のタスクから選ぶ（${data.assignable.length}）`, cls: 'dwt-wide-btn' });
      btn.onclick = () => {
        new AssignModal(this.app, data.assignable, (texts) => this.run(() => p.addTasks('day', this.date, texts))).open();
      };
    }
  }

  renderWeek(root, data) {
    const p = this.plugin;
    const sun = startOfWeek(this.date);
    const isThisWeek = sameDay(sun, startOfWeek(today()));
    this.renderNav(
      root,
      `${shortLabel(sun)} 〜 ${shortLabel(addDays(sun, 6))}`,
      () => {
        this.date = addDays(this.date, -7);
        this.render();
      },
      () => {
        this.date = addDays(this.date, 7);
        this.render();
      },
      isThisWeek ? null : { label: '今週へ', fn: () => { this.date = today(); this.render(); } },
      p.notePath('week', this.date)
    );

    if (data.preview) {
      this.renderStart(root, '今週を始める', data.preview, () => p.startPeriod('week', this.date));
    } else if (data.tasks === null) {
      root.createDiv({ cls: 'dwt-empty', text: 'この週のノートはまだありません' });
    }

    this.renderTaskList(root, data.tasks || [], 'week');
    this.renderAddForm(root, 'week');

    root.createEl('h4', { text: '日ごとの進み具合', cls: 'dwt-subheading' });
    const list = root.createDiv({ cls: 'dwt-days' });
    for (const day of data.days) {
      const row = list.createDiv({ cls: 'dwt-day-row' });
      if (sameDay(day.date, today())) row.addClass('is-today');
      row.createSpan({ text: shortLabel(day.date), cls: 'dwt-day-label' });
      const bar = row.createDiv({ cls: 'dwt-bar' });
      const fill = bar.createDiv({ cls: 'dwt-bar-fill' });
      fill.style.width = day.total ? `${(day.done / day.total) * 100}%` : '0%';
      row.createSpan({ text: day.total ? `${day.done}/${day.total}` : '–', cls: 'dwt-day-count' });
      row.onclick = () => {
        this.tab = 'day';
        this.date = day.date;
        this.render();
      };
    }
  }

  renderStart(root, label, preview, action) {
    const box = root.createDiv({ cls: 'dwt-start' });
    const btn = box.createEl('button', { text: label, cls: 'mod-cta dwt-wide-btn' });
    const parts = [];
    if (preview.carried.length) parts.push(`繰り越し ${preview.carried.length} 件`);
    if (preview.recurring.length) parts.push(`繰り返し ${preview.recurring.length} 件`);
    box.createDiv({ cls: 'dwt-hint', text: parts.length ? `${parts.join('・')}を追加します` : 'ノートを作成します' });
    btn.onclick = () => {
      btn.disabled = true;
      this.run(action);
    };
  }

  renderTaskList(root, tasks, kind) {
    if (!tasks.length) return;
    const counted = tasks.filter((t) => isOpen(t) || isDone(t));
    root.createDiv({ cls: 'dwt-progress', text: `${counted.filter(isDone).length} / ${counted.length} 完了` });
    const list = root.createEl('ul', { cls: 'dwt-list' });
    for (const task of tasks) {
      const li = list.createEl('li', { cls: 'dwt-item' });
      if (task.status === '>') {
        li.addClass('is-forwarded');
        li.createSpan({ text: '→', cls: 'dwt-mark' });
        li.createSpan({ text: task.text, cls: 'dwt-text' });
        continue;
      }
      if (!isOpen(task) && !isDone(task)) {
        li.addClass('is-other');
        li.createSpan({ text: `[${task.status}]`, cls: 'dwt-mark' });
        li.createSpan({ text: task.text, cls: 'dwt-text' });
        continue;
      }
      const label = li.createEl('label', { cls: 'dwt-label' });
      const cb = label.createEl('input', { type: 'checkbox', cls: 'task-list-item-checkbox' });
      cb.checked = isDone(task);
      if (cb.checked) li.addClass('is-done');
      label.createSpan({ text: task.text, cls: 'dwt-text' });
      cb.onchange = () => this.run(() => this.plugin.setStatus(kind, this.date, task.text, cb.checked ? 'x' : ' '));
    }
  }

  renderAddForm(root, kind) {
    const form = root.createEl('form', { cls: 'dwt-add' });
    const input = form.createEl('input', {
      type: 'text',
      cls: 'dwt-input',
      placeholder: kind === 'day' ? '今日のタスクを追加' : '今週のタスクを追加',
    });
    input.value = this.drafts[kind];
    input.oninput = () => {
      this.drafts[kind] = input.value;
    };
    form.createEl('button', { text: '追加', type: 'submit' });
    form.onsubmit = (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      this.drafts[kind] = '';
      input.value = '';
      this.run(() => this.plugin.addTasks(kind, this.date, [text]));
    };
  }
}

class AssignModal extends Modal {
  constructor(app, texts, onSubmit) {
    super(app);
    this.texts = texts;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('dwt-modal');
    contentEl.createEl('h3', { text: '今日やるタスクを選ぶ' });
    const checks = [];
    for (const text of this.texts) {
      const label = contentEl.createEl('label', { cls: 'dwt-label dwt-modal-item' });
      const cb = label.createEl('input', { type: 'checkbox' });
      label.createSpan({ text });
      checks.push([cb, text]);
    }
    const btn = contentEl.createEl('button', { text: '今日に追加', cls: 'mod-cta dwt-wide-btn' });
    btn.onclick = () => {
      const selected = checks.filter(([cb]) => cb.checked).map(([, text]) => text);
      if (selected.length) this.onSubmit(selected);
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

class DayWeekTasksSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const fields = [
      ['dailyFolder', '日のノートのフォルダ', 'YYYY-MM-DD.md の日記ノートを置く場所'],
      ['weeklyFolder', '週のノートのフォルダ', '週の日曜日の日付（YYYY-MM-DD.md）で作られます'],
      ['recurringFile', '繰り返しタスクのノート', '「- 毎日: 〇〇」のように書いたノート'],
      ['taskHeading', 'タスクの見出し', 'この見出しの下のチェックリストをタスクとして扱います'],
    ];
    for (const [key, name, desc] of fields) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((t) =>
          t
            .setPlaceholder(DEFAULT_SETTINGS[key])
            .setValue(this.plugin.settings[key])
            .onChange(async (v) => {
              this.plugin.settings[key] = v.trim() || DEFAULT_SETTINGS[key];
              await this.plugin.saveSettings();
            })
        );
    }
  }
}

module.exports = DayWeekTasksPlugin;
module.exports.helpers = {
  formatDate,
  parseDate,
  startOfWeek,
  parseTasks,
  addTasks,
  setTaskStatus,
  ensureSection,
  parseRecurring,
  dailyRecurringFor,
  weeklyRecurring,
};
