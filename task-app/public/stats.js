function formatDateLabel(dateKey) {
  const [, m, d] = dateKey.split('-');
  return `${Number(m)}/${Number(d)}`;
}

async function load() {
  const { daily, weekly } = await apiGet('/api/pomodoro/stats?days=7');
  const maxCount = Math.max(1, ...daily.map((d) => d.count));

  document.getElementById('weekly-summary').textContent =
    `直近7日間の合計: ${weekly.count}ポモドーロ（${Math.round(weekly.totalSeconds / 60)}分）`;

  document.getElementById('stat-bar').innerHTML = daily
    .map(
      (d) => `
    <div class="bar-wrap">
      <div class="count">${d.count}</div>
      <div class="bar" style="height:${Math.max(4, (d.count / maxCount) * 130)}px"></div>
      <div class="label">${formatDateLabel(d.date)}</div>
    </div>
  `
    )
    .join('');
}

load();
