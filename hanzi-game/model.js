export const DAY = 86400000;
export const GRADES = ['一', '二', '三', '四', '五', '六'];

export function getDeck(books, grade, term, scope = 'all') {
  const entries = new Map();
  for (const book of books.filter(b => b.grade === grade && (term === '全年' || b.term === term))) {
    for (const item of book.characters) {
      if (scope !== 'all' && !item[scope]) continue;
      const previous = entries.get(item.char);
      if (previous) {
        previous.readings = [...new Set([...previous.readings, ...item.readings])];
        previous.acceptedReadings = [...new Set([...(previous.acceptedReadings || previous.readings), ...(item.acceptedReadings || item.readings)])];
        previous.recognize ||= item.recognize;
        previous.write ||= item.write;
      } else entries.set(item.char, {...item, readings: [...item.readings], bookId: book.id});
    }
  }
  return [...entries.values()];
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function selectRound(deck, records, count = 10, random = Math.random, now = Date.now()) {
  // Shuffle within priority groups, so repeated sessions don't always start at the same character.
  const priority = item => !records[item.char] ? 1 : records[item.char].due <= now ? 0 : 2;
  return shuffle(deck, random).sort((a, b) => priority(a) - priority(b)).slice(0, count);
}

export function makeQuestion(target, pool, mode, random = Math.random) {
  const correct = mode === 'sound' ? target.pinyin : target.char;
  // Exclude every known reading in BOTH directions: homophones and polyphones are not traps.
  const candidates = pool.filter(x => x.char !== target.char &&
    !(x.acceptedReadings || x.readings).some(sound => (target.acceptedReadings || target.readings).includes(sound)));
  const distractors = [];
  for (const item of shuffle(candidates, random)) {
    const value = mode === 'sound' ? item.pinyin : item.char;
    if (value !== correct && !distractors.includes(value)) distractors.push(value);
    if (distractors.length === 3) break;
  }
  if (!distractors.length) throw new Error('这组字还不足以生成不同读音的选项，请扩大字表范围。');
  return {target, mode, correct, choices: shuffle([correct, ...distractors], random), answered: false};
}

export function answerQuestion(question, choice, records, now = Date.now()) {
  if (question.answered || !question.choices.includes(choice)) return null;
  const right = choice === question.correct;
  const previous = records[question.target.char] || {attempts: 0, correct: 0, streak: 0, wrong: false};
  const streak = right ? previous.streak + 1 : 0;
  const entry = {
    attempts: previous.attempts + 1, correct: previous.correct + Number(right), streak,
    wrong: !right, last: now, due: now + (right ? DAY * [1, 3, 7][Math.min(streak - 1, 2)] : 0),
  };
  question.answered = true;
  question.chosen = choice;
  return {right, records: {...records, [question.target.char]: entry}};
}

export function sanitizeRecords(value, known) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('学习记录格式不正确');
  const result = {};
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  for (const [char, row] of Object.entries(value)) {
    if (!known.has(char)) continue;
    if (!row || !['attempts', 'correct', 'streak', 'last', 'due'].every(k => integer(row[k])) ||
        row.attempts > 1000000 || row.correct > row.attempts || row.streak > row.correct ||
        typeof row.wrong !== 'boolean' || row.last > 8640000000000000 || row.due > 8640000000000000) {
      throw new Error('学习记录中有无效的数据');
    }
    result[char] = {...row};
  }
  return result;
}

export function summarize(deck, records, now = Date.now()) {
  return {
    total: deck.length,
    seen: deck.filter(x => records[x.char]?.attempts > 0).length,
    growing: deck.filter(x => records[x.char]?.streak >= 3).length,
    wrong: deck.filter(x => records[x.char]?.wrong).length,
    due: deck.filter(x => records[x.char] && records[x.char].due <= now).length,
  };
}
