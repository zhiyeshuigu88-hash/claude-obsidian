// スマホ版 実績: 直近の期間と、その前の同じ長さの期間を、なめらかな 2 本の線で比べる。

const statState = { range: 7 };
const chartEl = document.getElementById('m-chart');
const statTextEl = document.getElementById('m-stat-text');
const statSegEl = document.getElementById('m-stat-seg');

const CH = { w: 340, h: 200, padL: 26, padR: 14, padT: 28, padB: 26 };

// 点列をなめらかな曲線（Catmull-Rom → ベジェ）にする
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    // 縦方向は前後の点の間に収めて、0 より下などへはみ出さないようにする
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const c1y = Math.min(hi, Math.max(lo, p1.y + (p2.y - p0.y) / 6));
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = Math.min(hi, Math.max(lo, p2.y - (p3.y - p1.y) / 6));
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

function renderChart(cur, prev) {
  const n = cur.length;
  const max = Math.max(4, ...cur.map((d) => d.count), ...prev.map((d) => d.count));
  const top = Math.ceil(max / 2) * 2; // 目盛りを偶数でそろえる
  const x = (i) => CH.padL + (n === 1 ? 0 : (i * (CH.w - CH.padL - CH.padR)) / (n - 1));
  const y = (v) => CH.padT + (1 - v / top) * (CH.h - CH.padT - CH.padB);

  const toPts = (arr) => arr.map((d, i) => ({ x: Math.round(x(i) * 10) / 10, y: Math.round(y(d.count) * 10) / 10 }));
  const curPts = toPts(cur);
  const prevPts = toPts(prev);

  // 横の目盛り線（0・半分・最大）
  const grid = [0, top / 2, top]
    .map((v) => `<line class="grid" x1="${CH.padL}" x2="${CH.w - CH.padR}" y1="${y(v)}" y2="${y(v)}"/><text class="yl" x="${CH.padL - 8}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`)
    .join('');

  // 横軸のラベル: 7日は曜日、30日は日付を数日おきに
  const step = n <= 7 ? 1 : Math.ceil(n / 5);
  const xl = cur
    .map((d, i) => {
      if (i % step !== 0 && i !== n - 1) return '';
      const dt = mParseKey(d.date);
      const label = n <= 7 ? M_WEEKDAYS[dt.getDay()] : `${dt.getMonth() + 1}/${dt.getDate()}`;
      return `<text class="xl" x="${x(i)}" y="${CH.h - 6}" text-anchor="middle">${label}</text>`;
    })
    .join('');

  // タップできる範囲（その日の値を吹き出しで出す）
  const slot = (CH.w - CH.padL - CH.padR) / Math.max(1, n - 1);
  const hits = cur.map((d, i) => `<rect class="hit" data-i="${i}" x="${x(i) - slot / 2}" y="${CH.padT - 10}" width="${slot}" height="${CH.h - CH.padT - CH.padB + 10}"/>`).join('');

  chartEl.innerHTML = `
    ${grid}
    <path class="line prev" d="${smoothPath(prevPts)}"/>
    <path class="line cur" d="${smoothPath(curPts)}"/>
    ${xl}
    <g id="m-chart-tip"></g>
    ${hits}`;

  chartEl._data = { cur, prev, curPts };
  // 最後（今日）の点を最初から示す
  showTip(n - 1);
}

function showTip(i) {
  const data = chartEl._data;
  if (!data) return;
  const p = data.curPts[i];
  const d = data.cur[i];
  const dt = mParseKey(d.date);
  const label = `${dt.getMonth() + 1}/${dt.getDate()}　${d.count}回`;
  const w = 78;
  const tx = Math.min(Math.max(p.x, CH.padL + w / 2), CH.w - CH.padR - w / 2);
  document.getElementById('m-chart-tip').innerHTML = `
    <g class="tip" transform="translate(${tx},${Math.max(p.y - 30, 4)})">
      <rect x="${-w / 2}" y="0" width="${w}" height="22" rx="8"/>
      <text x="0" y="15">${label}</text>
    </g>
    <circle class="pt" cx="${p.x}" cy="${p.y}" r="5.5"/>`;
}

chartEl.addEventListener('click', (e) => {
  const hit = e.target.closest('.hit');
  if (hit) showTip(Number(hit.dataset.i));
});

async function loadStats() {
  const { range } = statState;
  const { daily } = await apiGet(`/api/pomodoro/stats?days=${range * 2}`);
  const prev = daily.slice(0, range);
  const cur = daily.slice(range);
  renderChart(cur, prev);

  const sum = (arr) => arr.reduce((s, d) => s + d.count, 0);
  const curSum = sum(cur);
  const prevSum = sum(prev);
  const unit = range === 7 ? '7日間' : '30日間';
  statTextEl.innerHTML = `
    <span>直近${unit}は <b class="g">${curSum}</b> 回</span>
    <span>その前の${unit}は <b class="o">${prevSum}</b> 回</span>
    <span>1日平均 <b>${(curSum / range).toFixed(1)}</b> 回</span>`;
}

statSegEl.addEventListener('click', (e) => {
  const opt = e.target.closest('.seg-opt');
  if (!opt) return;
  e.preventDefault();
  statState.range = Number(opt.dataset.range);
  statSegEl.querySelectorAll('.seg-opt').forEach((o) => o.classList.toggle('active', o === opt));
  loadStats();
});

loadStats();
