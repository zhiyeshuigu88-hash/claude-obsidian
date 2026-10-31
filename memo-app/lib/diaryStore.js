const fs = require('fs');

const HEADING_RE = /^## (\d{4}-\d{2}-\d{2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(date) {
  return DATE_RE.test(date);
}

function ensureFile(filePath, title, description) {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, `# ${title}\n\n${description}\n`, 'utf-8');
}

function trimBlock(lines) {
  const l = lines.slice();
  while (l.length && l[0] === '') l.shift();
  while (l.length && l[l.length - 1] === '') l.pop();
  return l.join('\n');
}

function parseSections(filePath) {
  if (!fs.existsSync(filePath)) return { preambleText: '', sections: [] };
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  const preambleLines = [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      current = { date: heading[1], lines: [] };
      sections.push(current);
      continue;
    }
    (current ? current.lines : preambleLines).push(line);
  }
  return {
    preambleText: trimBlock(preambleLines),
    sections: sections.map((s) => ({ date: s.date, content: trimBlock(s.lines) })),
  };
}

function listDiaryEntries(filePath) {
  const { sections } = parseSections(filePath);
  return sections
    .map((s) => {
      const preview = s.content.split('\n').find((l) => l.trim() !== '') || '';
      return { date: s.date, preview: preview.slice(0, 60) };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function readDiary(filePath, date) {
  const { sections } = parseSections(filePath);
  const section = sections.find((s) => s.date === date);
  return section ? section.content : '';
}

function saveDiary(filePath, title, description, date, content) {
  ensureFile(filePath, title, description);
  const { preambleText, sections } = parseSections(filePath);
  const trimmed = String(content).replace(/\r\n/g, '\n');
  const idx = sections.findIndex((s) => s.date === date);
  const isEmpty = trimmed.trim() === '';

  if (isEmpty) {
    if (idx !== -1) sections.splice(idx, 1);
  } else if (idx !== -1) {
    sections[idx] = { date, content: trimmed };
  } else {
    let insertAt = sections.findIndex((s) => s.date > date);
    if (insertAt === -1) insertAt = sections.length;
    sections.splice(insertAt, 0, { date, content: trimmed });
  }

  const blocks = [preambleText, ...sections.map((s) => `## ${s.date}\n\n${s.content}`)].filter((b) => b !== '');
  fs.writeFileSync(filePath, blocks.join('\n\n') + '\n', 'utf-8');
}

module.exports = { isValidDate, listDiaryEntries, readDiary, saveDiary };
