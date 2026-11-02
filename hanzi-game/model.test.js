import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DAY, getDeck, makeQuestion, answerQuestion, selectRound, summarize, sanitizeRecords} from './model.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const known = new Set(data.books.flatMap(b => b.characters.map(c => c.char)));

test('twelve actual source tables retain counts, provenance, and distinct reading/writing requirements', () => {
  assert.equal(data.books.length, 12);
  assert.equal(known.size, 2999);
  for (const book of data.books) {
    assert.equal(new Set(book.characters.map(x => x.char)).size, book.characters.length);
    assert.equal(book.characters.filter(x => x.write).length, book.source.writeCount);
    assert.equal(book.characters.filter(x => x.recognize && !x.supplementaryReading).length, book.source.recognizeCount);
    assert.match(book.source.sha256, /^[a-f0-9]{64}$/);
    assert.match(book.source.commit, /^[a-f0-9]{40}$/);
    for (const item of book.characters) {
      assert.match(item.char, /^[\u4e00-\u9fff]$/);
      assert.match(item.pinyin, /^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜêńňǹḿ]+$/);
      assert.ok(item.readings.includes(item.pinyin));
      assert.ok(item.acceptedReadings.includes(item.pinyin));
      if (item.word) {
        assert.ok(item.word.includes(item.char));
        assert.equal(item.word.length, item.wordPinyin.split(' ').length);
        assert.equal(item.wordPinyin.split(' ')[item.word.indexOf(item.char)], item.pinyin);
        assert.ok(['教材词语表', '常用组词（自编）'].includes(item.wordSource));
      }
    }
  }
});

test('grade and term filters use source membership, merge duplicates, and preserve the sixth-grade boundary', () => {
  assert.equal(getDeck(data.books, 1, '全年').length, 700);
  assert.equal(getDeck(data.books, 6, '上', 'recognize').length, 0);
  assert.equal(getDeck(data.books, 6, '上', 'write').length, 180);
  assert.equal(getDeck(data.books, 6, '全年').length, 294);
  assert.ok(getDeck(data.books, 1, '上').some(x => x.char === '天' && x.pinyin === 'tiān'));
  assert.equal(getDeck(data.books, 1, '上', 'write').length, 100);
});

test('every book supports both quiz directions with exactly one unambiguous answer', () => {
  for (const book of data.books) {
    const pool = getDeck(data.books, book.grade, book.term);
    for (const target of pool) {
      for (const mode of ['character', 'sound']) {
        const question = makeQuestion(target, pool, mode, () => .3);
        assert.equal(question.choices.length, 4);
        assert.equal(new Set(question.choices).size, 4);
        assert.equal(question.choices.filter(c => c === question.correct).length, 1);
        for (const choice of question.choices.filter(c => c !== question.correct)) {
          if (mode === 'character') assert.ok(!pool.find(c => c.char === choice).acceptedReadings.some(p => target.acceptedReadings.includes(p)));
          else assert.ok(!target.acceptedReadings.includes(choice));
        }
      }
    }
  }
});

test('wrong answers, retries, later success, and spaced review count actual independent submissions', () => {
  const pool = getDeck(data.books, 1, '上');
  const target = pool[0];
  let q = makeQuestion(target, pool, 'character');
  let result = answerQuestion(q, q.choices.find(x => x !== q.correct), {}, 100);
  assert.equal(result.right, false);
  assert.equal(result.records[target.char].wrong, true);
  assert.equal(result.records[target.char].due, 100);
  assert.equal(answerQuestion(q, q.correct, result.records, 101), null);
  let records = result.records;
  for (let i = 1; i <= 3; i++) {
    q = makeQuestion(target, pool, 'sound');
    records = answerQuestion(q, q.correct, records, 100 + i).records;
    assert.equal(records[target.char].due, 100 + i + DAY * [1,3,7][i - 1]);
  }
  assert.equal(records[target.char].attempts, 4);
  assert.equal(records[target.char].wrong, false);
  assert.equal(summarize(pool, records, 104).growing, 1);
  q = makeQuestion(target, pool, 'sound');
  records = answerQuestion(q, q.choices.find(x => x !== q.correct), records, 105).records;
  assert.equal(summarize(pool, records, 105).growing, 0);
  assert.equal(summarize(pool, records, 105).wrong, 1);
});

test('review prioritizes due characters and new characters without duplicates', () => {
  const pool = getDeck(data.books, 1, '上').slice(0, 12);
  const records = {[pool[0].char]: {due: 0}, [pool[1].char]: {due: 99999}};
  const selected = selectRound(pool, records, 10, () => .4, 100);
  assert.equal(selected[0].char, pool[0].char);
  assert.equal(selected.length, 10);
  assert.equal(new Set(selected.map(x => x.char)).size, 10);
  assert.ok(!selected.some(x => x.char === pool[1].char));
});

test('backup rejects malformed counters and only restores known characters', () => {
  const record = {attempts: 2, correct: 1, streak: 1, wrong: false, last: 100, due: 200};
  assert.deepEqual(sanitizeRecords({'天':record,'X':record}, known), {'天':record});
  assert.throws(() => sanitizeRecords({'天':{...record,correct:3}}, known));
  assert.throws(() => sanitizeRecords({'天':{...record,attempts:-1}}, known));
  assert.throws(() => sanitizeRecords({'天':{...record,due:'soon'}}, known));
  assert.throws(() => sanitizeRecords([], known));
});
