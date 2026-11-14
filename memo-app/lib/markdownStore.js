const fs = require('fs');

const HEADING_RE = /^## (\d{4}-\d{2}-\d{2})$/;
const ENTRY_RE = /^- (\d{2}:\d{2}) (.*) <!--id:(\d+)-->$/;
const PLACEHOLDER_RE = /^-\s*$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

function todayDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ensureFile(filePath, title, description) {
  if (fs.existsSync(filePath)) return;
  const content = `# ${title}\n\n${description}\n`;
  fs.writeFileSync(filePath, content, 'utf-8');
}

function listEntries(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  const entries = [];
  let currentDate = null;
  for (const line of lines) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      currentDate = heading[1];
      continue;
    }
    const entry = line.match(ENTRY_RE);
    if (entry && currentDate) {
      entries.push({
        id: entry[3],
        date: currentDate,
        time: entry[1],
        content: entry[2],
      });
    }
  }
  return entries.sort((a, b) => Number(a.id) - Number(b.id));
}

function addEntry(filePath, content) {
  ensureFile(filePath, '', '');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  const date = todayDate();
  const time = nowTime();
  const id = String(Date.now());
  const text = String(content).replace(/\r?\n/g, ' ').trim();
  const newLine = `- ${time} ${text} <!--id:${id}-->`;

  let headingIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === `## ${date}`) {
      headingIndex = i;
      break;
    }
  }

  if (headingIndex === -1) {
    // No section for today yet: append a new one at the end.
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push('', `## ${date}`, '', newLine);
  } else {
    // Find the end of today's section (next heading or EOF).
    let sectionEnd = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i++) {
      if (HEADING_RE.test(lines[i])) {
        sectionEnd = i;
        break;
      }
    }
    // Drop a trailing bare placeholder bullet within this section.
    let insertAt = sectionEnd;
    while (insertAt > headingIndex + 1 && lines[insertAt - 1] === '') insertAt--;
    if (insertAt > headingIndex + 1 && PLACEHOLDER_RE.test(lines[insertAt - 1]) && !ENTRY_RE.test(lines[insertAt - 1])) {
      lines.splice(insertAt - 1, 1);
      insertAt--;
      sectionEnd--;
    }
    lines.splice(insertAt, 0, newLine);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return { id, date, time, content: text };
}

function deleteEntry(filePath, id) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const heading = lines[i].match(HEADING_RE);
    if (heading) {
      const sectionLines = [lines[i]];
      let j = i + 1;
      while (j < lines.length && !HEADING_RE.test(lines[j])) {
        sectionLines.push(lines[j]);
        j++;
      }
      const filtered = sectionLines.filter((line, idx) => {
        if (idx === 0) return true;
        const entry = line.match(ENTRY_RE);
        return !(entry && entry[3] === String(id));
      });
      const hasEntries = filtered.some((line) => ENTRY_RE.test(line));
      if (hasEntries) {
        result.push(...filtered);
      }
      i = j;
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  fs.writeFileSync(filePath, result.join('\n'), 'utf-8');
}

module.exports = { ensureFile, listEntries, addEntry, deleteEntry };
