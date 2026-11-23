const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  Events,
  GatewayIntentBits,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');

// ---- Obsidian メモ連携（Folio と同じ読み書きロジックを使い回す）----
const MEMO_DIR = path.join(__dirname, '..', '..', '1_Projects', 'memo-app');
const store = require(path.join(MEMO_DIR, 'lib', 'markdownStore.js'));
const diaryStore = require(path.join(MEMO_DIR, 'lib', 'diaryStore.js'));
// データの置き場所は MEMO_DATA_DIR で切り替え可能（テスト用。通常は未設定でよい）
const DATA_DIR = process.env.MEMO_DATA_DIR || MEMO_DIR;
const MEMO_TARGETS = {
  idea: { label: 'アイディアメモ', file: path.join(DATA_DIR, 'アイディアメモ.md') },
  board: { label: '掲示板', file: path.join(DATA_DIR, '掲示板.md') },
};
const DIARY_FILE = path.join(DATA_DIR, 'Diary.md');

// ---- タスク管理アプリ（Focus Task）連携：アプリの lib をそのまま使い回す ----
// TASK_APP_DIR で場所を切り替え可能（テスト用。通常は未設定でよい）
const TASK_DIR = process.env.TASK_APP_DIR || path.join(__dirname, '..', '..', '1_Projects', 'task-app');
const taskStore = require(path.join(TASK_DIR, 'lib', 'taskStore.js'));
const habitStore = require(path.join(TASK_DIR, 'lib', 'habitStore.js'));
const PRIORITY_ICON = { high: '🔴', medium: '🟡', low: '🟢' };

// 期限の入力: 「2026-11-20」「2026-11-20 18:30」「今日」「明日 9:00」。
// 時刻を省略したらその日の 23:59（アプリの日付割り当てと同じ扱い）
function parseDue(input) {
  const m = input.trim().match(/^(今日|明日|(\d{4})-(\d{1,2})-(\d{1,2}))(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  let y, mo, d;
  if (m[1] === '今日' || m[1] === '明日') {
    const base = new Date();
    if (m[1] === '明日') base.setDate(base.getDate() + 1);
    [y, mo, d] = [base.getFullYear(), base.getMonth() + 1, base.getDate()];
  } else {
    [y, mo, d] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  const hh = m[5] != null ? Number(m[5]) : 23;
  const mm = m[6] != null ? Number(m[6]) : 59;
  const date = new Date(y, mo - 1, d, hh, mm);
  const valid = hh <= 23 && mm <= 59 && date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
  return valid ? date : null;
}
function formatDue(iso) {
  if (!iso) return '期限なし';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  const day = `${d.getMonth() + 1}/${d.getDate()}`;
  return d.getHours() === 23 && d.getMinutes() === 59 ? day : `${day} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function taskLine(t) {
  const overdue = t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date();
  const mark = t.status === 'done' ? '✅' : '⬜';
  return `${mark} ${PRIORITY_ICON[t.priority] ?? '🟡'} ${clip(t.title, 80)} — ${formatDue(t.dueDate)}${overdue ? ' ⚠️期限切れ' : ''}`;
}

// メモは個人の内容なので、bot の持ち主（OWNER_ID）だけが使えるようにする
const OWNER_ID = process.env.OWNER_ID;
async function requireOwner(interaction) {
  if (!OWNER_ID) {
    await interaction.reply({ content: 'OWNER_ID が .env に設定されていません。', flags: MessageFlags.Ephemeral });
    return false;
  }
  if (interaction.user.id !== OWNER_ID) {
    await interaction.reply({ content: 'このコマンドは bot の持ち主だけが使えます。', flags: MessageFlags.Ephemeral });
    return false;
  }
  return true;
}
// メモ本文にメンション（@everyone など）が含まれても通知が飛ばないようにする
const NO_PING = { parse: [] };
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ---- 朝の通知（毎朝、持ち主に DM で今日のタスクと習慣を送る）----
// NOTIFY_TIME=HH:MM（既定 07:30）。'off' で無効。送信済みの日付は notify-state.json に記録して二重送信を防ぐ。
const NOTIFY_TIME = (process.env.NOTIFY_TIME || '07:30').trim();
const NOTIFY_STATE_FILE = process.env.NOTIFY_STATE_FILE || path.join(__dirname, 'notify-state.json');
const NOTIFY_WINDOW_MIN = 240; // 指定時刻に bot が止まっていても、この分数以内に起動すれば遅れて送る
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = '日月火水木金土';

function buildMorningMessage(now = new Date()) {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const open = taskStore.listTasks({ status: 'todo' });
  const dueToday = taskStore.listTasksDueToday().filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < dayStart);
  const noDue = open.filter((t) => !t.dueDate).length;
  // 今日やる習慣: 今日が対象日で、未実施。週N回の習慣は今週の目標に達していれば出さない
  const habits = habitStore
    .listWithStatus(habitStore.todayKey())
    .filter((h) => h.scheduled && !h.done && !(h.repeat.type === 'weekly' && h.week.target > 0 && h.week.done >= h.week.target));

  const habitLine = (h) => {
    const time = h.startTime ? `${h.startTime} ` : '';
    let tail = '';
    if (h.repeat.type === 'weekly') tail = ` — 今週 ${h.week.done}/${h.week.target}`;
    else if (h.streak.count > 0) tail = ` — 🔥${h.streak.count}日連続`;
    return `⬜ ${time}${clip(h.title, 60)}${tail}`;
  };

  const parts = [`☀️ **おはようございます**（${now.getMonth() + 1}/${now.getDate()} ${WEEKDAYS[now.getDay()]}）`];
  const add = (title, items, fmt) => {
    if (!items.length) return;
    const shown = items.slice(0, 10).map(fmt).join('\n');
    parts.push(`${title}（${items.length}件）\n${shown}${items.length > 10 ? `\n…ほか ${items.length - 10}件` : ''}`);
  };
  add('📋 **今日のタスク**', dueToday, taskLine);
  add('⚠️ **期限切れ**', overdue, (t) => taskLine(t).replace(' ⚠️期限切れ', ''));
  add('🔁 **今日の習慣**', habits, habitLine);
  if (parts.length === 1) parts.push('今日は予定されたタスクも習慣もありません 🎉');
  if (noDue > 0) parts.push(`📝 期限なしの未完了タスク: ${noDue}件`);
  return clip(parts.join('\n\n'), 1900);
}

function readNotifyState() {
  try {
    return JSON.parse(fs.readFileSync(NOTIFY_STATE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}
function writeNotifyState(state) {
  fs.writeFileSync(NOTIFY_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

let morningSending = false;
let morningFailures = { date: '', count: 0 };

async function maybeSendMorning(now = new Date()) {
  const [h, m] = NOTIFY_TIME.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const target = h * 60 + m;
  if (nowMin < target || nowMin >= target + NOTIFY_WINDOW_MIN) return;

  const today = todayStr();
  if (readNotifyState().lastSentDate === today) return; // 今日はもう送った
  if (morningFailures.date === today && morningFailures.count >= 3) return; // DM が拒否されている等。今日は諦める
  if (morningSending) return;

  morningSending = true;
  const previous = readNotifyState();
  try {
    // 先に「送った」と記録する（記録に失敗して二重送信になるより、送れず再試行のほうが安全）
    writeNotifyState({ lastSentDate: today, sentAt: now.toISOString() });
    const user = await client.users.fetch(OWNER_ID);
    await user.send({ content: buildMorningMessage(now), allowedMentions: NO_PING });
    console.log(`朝の通知を送りました: ${today}`);
  } catch (err) {
    writeNotifyState(previous); // 送れなかったので記録を戻し、次の1分後に再試行する
    morningFailures = { date: today, count: morningFailures.date === today ? morningFailures.count + 1 : 1 };
    console.error(`朝の通知に失敗しました（${morningFailures.count}回目）:`, err.message);
  } finally {
    morningSending = false;
  }
}

function startMorningNotifier() {
  if (NOTIFY_TIME.toLowerCase() === 'off') {
    console.log('朝の通知: 無効（NOTIFY_TIME=off）');
    return;
  }
  if (!OWNER_ID || !TIME_RE.test(NOTIFY_TIME)) {
    console.error(`朝の通知: OWNER_ID が未設定、または NOTIFY_TIME（${NOTIFY_TIME}）が HH:MM 形式ではないため無効です`);
    return;
  }
  console.log(`朝の通知: 毎日 ${NOTIFY_TIME} に DM で送ります`);
  const tick = () => maybeSendMorning().catch((err) => console.error('朝の通知でエラー:', err));
  tick(); // 起動直後にも確認する（指定時刻を過ぎてから起動した場合の取りこぼし対策）
  setInterval(tick, 60_000);
}

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN が設定されていません。.env にトークンを貼ってください。');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Developer Portal で ON にしたもの
  ],
});

// ---- スラッシュコマンド定義 ----
// 新しいコマンドは { data, execute } を commands に足すだけ
const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('応答速度を表示します'),
    async execute(interaction) {
      const sent = await interaction.reply({ content: '計測中…', fetchReply: true });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply(`pong! 応答まで ${latency}ms（WebSocket: ${client.ws.ping}ms）`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('dice')
      .setDescription('サイコロを振ります')
      .addIntegerOption((o) =>
        o.setName('sides').setDescription('面の数（既定 6）').setMinValue(2).setMaxValue(1000),
      )
      .addIntegerOption((o) =>
        o.setName('count').setDescription('振る個数（既定 1）').setMinValue(1).setMaxValue(20),
      ),
    async execute(interaction) {
      const sides = interaction.options.getInteger('sides') ?? 6;
      const count = interaction.options.getInteger('count') ?? 1;
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0);
      const detail = count > 1 ? `（${rolls.join(' + ')} = ${total}）` : '';
      await interaction.reply(`🎲 ${count}d${sides}: **${total}** ${detail}`.trim());
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('choose')
      .setDescription('選択肢からランダムに1つ選びます')
      .addStringOption((o) =>
        o
          .setName('options')
          .setDescription('選択肢をスペースか読点区切りで（例: カレー ラーメン 寿司）')
          .setRequired(true),
      ),
    async execute(interaction) {
      const items = interaction.options
        .getString('options')
        .split(/[\s,、，]+/)
        .filter(Boolean);
      if (items.length < 2) {
        await interaction.reply({ content: '選択肢は2つ以上入れてください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const pick = items[Math.floor(Math.random() * items.length)];
      await interaction.reply(`🎯 **${pick}** に決定！（候補: ${items.join(' / ')}）`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('time')
      .setDescription('現在の日本時間を表示します'),
    async execute(interaction) {
      const now = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(new Date());
      await interaction.reply(`🕒 ${now}`);
    },
  },
  // ---- Obsidian メモ連携（持ち主のみ・返信は本人にだけ見える）----
  {
    data: new SlashCommandBuilder()
      .setName('memo')
      .setDescription('Obsidian のメモを追加・確認します')
      .addSubcommand((s) =>
        s
          .setName('add')
          .setDescription('メモを追加します')
          .addStringOption((o) =>
            o
              .setName('target')
              .setDescription('追加先')
              .setRequired(true)
              .addChoices(
                { name: '💡 アイディアメモ', value: 'idea' },
                { name: '📌 掲示板', value: 'board' },
              ),
          )
          .addStringOption((o) =>
            o.setName('text').setDescription('メモの内容').setRequired(true).setMaxLength(500),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName('recent')
          .setDescription('最近のメモを表示します')
          .addStringOption((o) =>
            o
              .setName('target')
              .setDescription('表示するメモ')
              .setRequired(true)
              .addChoices(
                { name: '💡 アイディアメモ', value: 'idea' },
                { name: '📌 掲示板', value: 'board' },
              ),
          )
          .addIntegerOption((o) =>
            o.setName('count').setDescription('件数（既定 5）').setMinValue(1).setMaxValue(10),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName('delete')
          .setDescription('メモを削除します（確認ボタンあり）')
          .addStringOption((o) =>
            o
              .setName('target')
              .setDescription('削除するメモの場所')
              .setRequired(true)
              .addChoices(
                { name: '💡 アイディアメモ', value: 'idea' },
                { name: '📌 掲示板', value: 'board' },
              ),
          )
          .addStringOption((o) =>
            o
              .setName('entry')
              .setDescription('削除するメモ（入力して絞り込めます）')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      ),
    // 削除候補の表示（新しい順・最大25件）。持ち主以外には何も見せない
    async autocomplete(interaction) {
      if (interaction.user.id !== OWNER_ID) return interaction.respond([]);
      const target = MEMO_TARGETS[interaction.options.getString('target')];
      if (!target) return interaction.respond([]);
      const q = interaction.options.getFocused().toLowerCase();
      const choices = store
        .listEntries(target.file)
        .reverse()
        .filter((e) => e.content.toLowerCase().includes(q))
        .slice(0, 25)
        .map((e) => ({ name: clip(`${e.date.slice(5)} ${e.time} ${e.content}`, 100), value: e.id }));
      return interaction.respond(choices);
    },
    async execute(interaction) {
      if (!(await requireOwner(interaction))) return;
      const target = MEMO_TARGETS[interaction.options.getString('target')];
      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const text = interaction.options.getString('text').trim();
        if (!text) {
          await interaction.reply({ content: 'メモの内容が空です。', flags: MessageFlags.Ephemeral });
          return;
        }
        const entry = store.addEntry(target.file, text);
        await interaction.reply({
          content: `📝 ${target.label}に追加しました（${entry.date} ${entry.time}）\n> ${clip(entry.content, 300)}`,
          flags: MessageFlags.Ephemeral,
          allowedMentions: NO_PING,
        });
        return;
      }

      if (sub === 'delete') {
        const id = interaction.options.getString('entry');
        const entry = store.listEntries(target.file).find((e) => e.id === id);
        if (!entry) {
          await interaction.reply({
            content: 'そのメモが見つかりません（すでに削除された可能性があります）。候補から選び直してください。',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const preview = `> ${entry.date} ${entry.time} ${clip(entry.content, 300)}`;
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('memo-del-yes').setLabel('削除する').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('memo-del-no').setLabel('キャンセル').setStyle(ButtonStyle.Secondary),
        );
        const msg = await interaction.reply({
          content: `🗑 ${target.label}から、このメモを削除しますか？（元に戻せません）\n${preview}`,
          components: [row],
          flags: MessageFlags.Ephemeral,
          allowedMentions: NO_PING,
          fetchReply: true,
        });
        try {
          const click = await msg.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: 30_000,
          });
          if (click.customId === 'memo-del-yes') {
            store.deleteEntry(target.file, id);
            await click.update({ content: `🗑 削除しました\n${preview}`, components: [], allowedMentions: NO_PING });
          } else {
            await click.update({ content: 'キャンセルしました。', components: [] });
          }
        } catch {
          // 30秒操作がなかった場合
          await interaction.editReply({ content: '時間切れのためキャンセルしました。', components: [] });
        }
        return;
      }

      const count = interaction.options.getInteger('count') ?? 5;
      const entries = store.listEntries(target.file).slice(-count).reverse();
      const body = entries.length
        ? entries.map((e) => `- ${e.date.slice(5)} ${e.time} ${clip(e.content, 150)}`).join('\n')
        : '（まだメモがありません）';
      await interaction.reply({
        content: clip(`**${target.label}（新しい順）**\n${body}`, 1900),
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_PING,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('diary')
      .setDescription('日記を表示します（読み取り専用）')
      .addStringOption((o) =>
        o.setName('date').setDescription('日付 YYYY-MM-DD（省略で今日）'),
      ),
    async execute(interaction) {
      if (!(await requireOwner(interaction))) return;
      const date = interaction.options.getString('date') ?? todayStr();
      if (!diaryStore.isValidDate(date)) {
        await interaction.reply({ content: '日付は YYYY-MM-DD の形式で指定してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const content = diaryStore.readDiary(DIARY_FILE, date).trim();
      const body = content ? clip(content, 1800) : '（この日の日記はありません）';
      await interaction.reply({
        content: `📔 **${date}**\n${body}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_PING,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('search')
      .setDescription('メモ・掲示板・日記からキーワードを検索します')
      .addStringOption((o) =>
        o.setName('keyword').setDescription('検索語').setRequired(true).setMaxLength(100),
      ),
    async execute(interaction) {
      if (!(await requireOwner(interaction))) return;
      const kw = interaction.options.getString('keyword').trim().toLowerCase();
      if (!kw) {
        await interaction.reply({ content: '検索語が空です。', flags: MessageFlags.Ephemeral });
        return;
      }
      const hits = [];
      for (const t of Object.values(MEMO_TARGETS)) {
        for (const e of store.listEntries(t.file)) {
          if (e.content.toLowerCase().includes(kw)) {
            hits.push({ key: `${e.date} ${e.time}`, line: `[${t.label}] ${e.date} ${e.time} ${clip(e.content, 120)}` });
          }
        }
      }
      for (const { date } of diaryStore.listDiaryEntries(DIARY_FILE)) {
        const text = diaryStore.readDiary(DIARY_FILE, date);
        const hitLine = text.split('\n').find((l) => l.toLowerCase().includes(kw));
        if (hitLine) hits.push({ key: `${date} 99:99`, line: `[日記] ${date} ${clip(hitLine.trim(), 120)}` });
      }
      hits.sort((a, b) => (a.key < b.key ? 1 : -1)); // 新しい順
      const shown = hits.slice(0, 10);
      const body = shown.length
        ? `${shown.map((h) => `- ${h.line}`).join('\n')}${hits.length > 10 ? `\n…ほか ${hits.length - 10} 件` : ''}`
        : '見つかりませんでした。';
      await interaction.reply({
        content: clip(`🔍 「${kw}」の検索結果（${hits.length}件）\n${body}`, 1900),
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_PING,
      });
    },
  },
  // ---- タスク管理アプリ（Focus Task）連携（持ち主のみ）----
  {
    data: new SlashCommandBuilder()
      .setName('todo')
      .setDescription('タスク管理アプリのタスクを確認・追加・完了します')
      .addSubcommand((s) =>
        s
          .setName('list')
          .setDescription('タスク一覧を表示します')
          .addStringOption((o) =>
            o
              .setName('filter')
              .setDescription('表示する範囲（既定: 未完了）')
              .addChoices(
                { name: '未完了', value: 'todo' },
                { name: '今日が期限', value: 'today' },
                { name: '完了済み', value: 'done' },
                { name: 'すべて', value: 'all' },
              ),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName('add')
          .setDescription('タスクを追加します')
          .addStringOption((o) =>
            o.setName('title').setDescription('タスク名').setRequired(true).setMaxLength(100),
          )
          .addStringOption((o) =>
            o.setName('due').setDescription('期限 例: 2026-11-20 / 2026-11-20 18:30 / 明日 / 今日 9:00'),
          )
          .addStringOption((o) =>
            o
              .setName('priority')
              .setDescription('優先度（既定: 中）')
              .addChoices(
                { name: '🔴 高', value: 'high' },
                { name: '🟡 中', value: 'medium' },
                { name: '🟢 低', value: 'low' },
              ),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName('done')
          .setDescription('タスクを完了にします')
          .addStringOption((o) =>
            o
              .setName('task')
              .setDescription('完了にするタスク（入力して絞り込めます）')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      ),
    // 完了候補: 未完了のタスク（期限が近い順・最大25件）
    async autocomplete(interaction) {
      if (interaction.user.id !== OWNER_ID) return interaction.respond([]);
      const q = interaction.options.getFocused().toLowerCase();
      const choices = taskStore
        .listTasks({ status: 'todo' })
        .filter((t) => t.title.toLowerCase().includes(q))
        .slice(0, 25)
        .map((t) => ({ name: clip(`${t.title} — ${formatDue(t.dueDate)}`, 100), value: t.id }));
      return interaction.respond(choices);
    },
    async execute(interaction) {
      if (!(await requireOwner(interaction))) return;
      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const title = interaction.options.getString('title').trim();
        if (!title) {
          await interaction.reply({ content: 'タスク名が空です。', flags: MessageFlags.Ephemeral });
          return;
        }
        let dueDate = null;
        const dueInput = interaction.options.getString('due');
        if (dueInput) {
          const parsed = parseDue(dueInput);
          if (!parsed) {
            await interaction.reply({
              content: '期限の形式が正しくありません。例: `2026-11-20` / `2026-11-20 18:30` / `明日` / `今日 9:00`',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          dueDate = parsed.toISOString();
        }
        const priority = interaction.options.getString('priority') ?? 'medium';
        const task = taskStore.createTask({ title, dueDate, priority });
        await interaction.reply({
          content: `➕ タスクを追加しました\n${taskLine(task)}`,
          flags: MessageFlags.Ephemeral,
          allowedMentions: NO_PING,
        });
        return;
      }

      if (sub === 'done') {
        const id = interaction.options.getString('task');
        const task = taskStore.getTask(id);
        if (!task) {
          await interaction.reply({
            content: 'そのタスクが見つかりません。候補から選び直してください。',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (task.status === 'done') {
          await interaction.reply({
            content: `すでに完了しています: ${clip(task.title, 100)}`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_PING,
          });
          return;
        }
        const updated = taskStore.updateTask(id, { status: 'done' });
        await interaction.reply({
          content: `✅ 完了にしました\n${taskLine(updated)}`,
          flags: MessageFlags.Ephemeral,
          allowedMentions: NO_PING,
        });
        return;
      }

      // list
      const filter = interaction.options.getString('filter') ?? 'todo';
      const labels = { todo: '未完了', today: '今日が期限', done: '完了済み', all: 'すべて' };
      const tasks =
        filter === 'today'
          ? taskStore.listTasksDueToday()
          : taskStore.listTasks({ status: filter === 'all' ? undefined : filter });
      const shown = tasks.slice(0, 15);
      const body = shown.length
        ? `${shown.map(taskLine).join('\n')}${tasks.length > 15 ? `\n…ほか ${tasks.length - 15} 件` : ''}`
        : '（該当するタスクはありません）';
      await interaction.reply({
        content: clip(`📋 **タスク: ${labels[filter]}（${tasks.length}件）**\n${body}`, 1900),
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_PING,
      });
    },
  },
  // 朝の通知と同じ内容を、いつでも本人にだけ表示する（確認用。通知の送信済み記録には影響しない）
  {
    data: new SlashCommandBuilder()
      .setName('morning')
      .setDescription('朝の通知と同じ内容（今日のタスクと習慣）を今すぐ表示します'),
    async execute(interaction) {
      if (!(await requireOwner(interaction))) return;
      await interaction.reply({
        content: buildMorningMessage(),
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_PING,
      });
    },
  },
];

const commandMap = new Map(commands.map((c) => [c.data.name, c]));
const commandJson = commands.map((c) => c.data.toJSON());

// サーバー単位で登録すると即時反映される（グローバル登録は反映に時間がかかる）
async function registerCommands(guild) {
  try {
    await guild.commands.set(commandJson);
    console.log(`コマンドを登録しました: ${guild.name}（${commandJson.length}件）`);
  } catch (err) {
    console.error(`コマンド登録に失敗しました: ${guild.name}`, err);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`ログインしました: ${c.user.tag}`);
  for (const guild of c.guilds.cache.values()) {
    await registerCommands(guild);
  }
  startMorningNotifier();
});

// 起動後に bot が新しいサーバーへ招待されたときも登録する
client.on(Events.GuildCreate, registerCommands);

client.on(Events.InteractionCreate, async (interaction) => {
  // 入力候補（オートコンプリート）
  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error(`/${interaction.commandName} の入力候補でエラー:`, err);
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const command = commandMap.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`/${interaction.commandName} でエラー:`, err);
    const msg = { content: 'コマンドの実行中にエラーが起きました。', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

// 動作確認用: 「ping」と送ると「pong」と返す
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content === 'ping') {
    await message.reply('pong');
  }
});

// 二重起動の防止: bot が複数同時に動くと、1回のコマンドを全部が処理して
// タスクが重複登録されてしまう。ローカルのポートを占有して「1つだけ」にする。
const LOCK_PORT = Number(process.env.BOT_LOCK_PORT) || 47831;
const lockServer = require('net').createServer();
lockServer.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('別の bot がすでに起動しているため、このプロセスは終了します。');
  } else {
    console.error('二重起動チェックに失敗しました:', err);
  }
  process.exit(1);
});
lockServer.listen(LOCK_PORT, '127.0.0.1', () => client.login(token));
