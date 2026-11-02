import {GRADES, getDeck, selectRound, makeQuestion, answerQuestion, sanitizeRecords, summarize} from './model.js';

const $ = selector => document.querySelector(selector);
const content = $('#content');
const KEY = 'ziyadao-progress-v1';
const SETTINGS = 'ziyadao-settings-v1';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, known, records = {}, grade = 1, term = '上', scope = 'all', tab = 'play', page = 0, query = '';
let session = null, storageWarning = false, readFailure = false, toastTimer;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}
function save() {
  if (readFailure) {toast('原记录读取失败，暂不覆盖。本次进度可在家长小屋导出备份。'); return;}
  try { localStorage.setItem(KEY, JSON.stringify({schemaVersion: 1, records})); storageWarning = false; }
  catch { storageWarning = true; toast('浏览器暂时不能保存进度。本次仍能玩，请在家长小屋导出备份。'); }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS, JSON.stringify({grade, term, scope})); } catch { /* Optional preferences. */ }
}
const deck = () => getDeck(data.books, grade, term, scope);
const label = () => `${GRADES[grade - 1]}年级 · ${term === '全年' ? '全年' : term + '册'}`;
const metadata = item => `${item.recognize ? '认读' : ''}${item.recognize && item.write ? ' · ' : ''}${item.write ? '写字' : ''}`;
function note(item) {
  return item.readings.length > 1 ? `这是多音字。本卡读 ${item.pinyin}；还有 ${item.readings.filter(x => x !== item.pinyin).join('、')} 等教材字表读音。` : '拼音显示本卡常用读音。';
}
function refreshHeader() {
  $('#grades').innerHTML = GRADES.map((n, i) => `<button class="grade" data-grade="${i + 1}" aria-pressed="${grade === i + 1}"><b>${n}</b>年级</button>`).join('');
  document.querySelectorAll('[data-term]').forEach(b => b.setAttribute('aria-pressed', b.dataset.term === term));
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $('#scope').value = scope;
  const selected = data.books.filter(b => b.grade === grade && (term === '全年' || b.term === term));
  const recognition = selected.reduce((s, b) => s + b.source.recognizeCount, 0);
  const writing = selected.reduce((s, b) => s + b.source.writeCount, 0);
  $('#coverage').textContent = `${label()} · 当前 ${deck().length} 个不同汉字。教材标注：认读生字 ${recognition} 个，写字 ${writing} 个（两表可重叠；另含多音字复习）。旧版统编字表，当前学校版本请与课本核对。`;
  $('#review-count').textContent = summarize(deck(), records).wrong;
}
function render() {
  refreshHeader();
  if (session) return renderSession();
  if (tab === 'play') renderPlay(); else renderCards();
}
function statsHTML(items) {
  const stats = summarize(items, records);
  return `<div class="stats"><div class="stat"><strong>${stats.seen}<small> / ${stats.total}</small></strong><span>已经练过的字</span></div><div class="stat"><strong>${stats.growing}</strong><span>连续答对三轮 · 小树苗</span></div><div class="stat"><strong>${stats.due}</strong><span>到了再见面的时间</span></div></div>`;
}
function renderPlay() {
  const items = deck();
  if (!items.length) {content.innerHTML = `<div class="empty"><div class="plant">🌱</div><h3>这册没有单列识字表</h3><p>六年级镜像仅有写字表。请选择“写字表”或“认读与写字”。</p><button class="secondary" data-action="all-scope">查看已有字表</button></div>`;return;}
  const groups = Array.from({length: Math.ceil(items.length / 20)}, (_, i) => items.slice(i * 20, (i + 1) * 20));
  content.innerHTML = `<div class="panel">${statsHTML(items)}<div class="mode-grid"><button class="mode" data-mode="learn"><span class="mode-icon">字</span><span class="arrow">↗</span><h3>认识新朋友</h3><p>翻一翻字卡，读一读，再描一描</p></button><button class="mode" data-mode="character"><span class="mode-icon">拼</span><span class="arrow">↗</span><h3>拼音找汉字</h3><p>看看拼音，找到它的汉字朋友</p></button><button class="mode" data-mode="sound"><span class="mode-icon">音</span><span class="arrow">↗</span><h3>汉字找拼音</h3><p>认出这个字，选一选它的读音</p></button></div><div class="little-heading"><h3>一小片一小片地探索</h3><span>每片最多 20 字 · 每轮 10 题</span></div><div class="trail">${groups.map((group, i) => `<button data-group="${i}"><strong>第 ${i + 1} 片小森林</strong><span>${group.slice(0, 4).map(x => x.char).join(' ')} · ${summarize(group, records).seen}/${group.length}</span></button>`).join('')}</div><div class="tips"><strong>陪伴小提示</strong>　先翻卡认识，再玩拼音闯关。每次 10～15 分钟就好，不计时、不扣星星。答错的字会留在“再见一面”。</div></div>`;
}
function renderCards() {
  const items = deck().filter(x => tab !== 'review' || records[x.char]?.wrong);
  const filtered = items.filter(x => !query || x.char.includes(query) || x.pinyin.includes(query) || x.word?.includes(query));
  const pages = Math.max(1, Math.ceil(filtered.length / 36));
  page = Math.max(0, Math.min(page, pages - 1));
  content.innerHTML = `<div class="panel">${tab === 'review' ? `<div class="little-heading"><h3>再见一面，就熟悉一点</h3><span>仅显示当前年级、学期的待巩固字</span></div><p class="small">答错没关系。下一轮独立答对后，这个字会从待巩固列表移出；连续答对三轮才长成小树苗。</p>${items.length ? '<button class="primary" data-action="review">复习这些字 →</button>' : ''}` : ''}<div class="toolbar"><input id="search" class="search" aria-label="查找汉字、词语或带调拼音" placeholder="找一个字、词语或带调拼音" value="${escape(query)}"><span class="small">共 ${filtered.length} 字 · 点击字卡认一认</span></div>${filtered.length ? `<div class="card-grid">${filtered.slice(page * 36, (page + 1) * 36).map(x => `<button class="mini-card" data-card="${x.char}">${records[x.char]?.streak >= 3 ? '<span class="dot" aria-label="连续答对三轮">芽</span>' : records[x.char]?.wrong ? '<span class="dot" aria-label="待巩固">↻</span>' : ''}<b>${x.char}</b><small>${x.pinyin}</small></button>`).join('')}</div><div class="pager"><button data-page="-1" ${page === 0 ? 'disabled' : ''}>上一页</button><span>${page + 1} / ${pages}</span><button data-page="1" ${page === pages - 1 ? 'disabled' : ''}>下一页</button></div>` : `<div class="empty"><div class="plant">🌱</div><h3>${query ? '还没有找到这个字' : tab === 'review' ? '这里暂时没有待巩固的字' : '这册没有单列识字表'}</h3><p>${query ? '试试单个汉字，或换个年级、学期。' : tab === 'review' ? '去闯一小关，和汉字交个朋友吧。' : '请选择“写字表”或“认读与写字”。'}</p><button class="secondary" data-action="home">去闯关乐园</button></div>`}</div>`;
}
function start(mode, items = deck(), group = null) {
  if (!items.length) return toast('这里还没有可练习的字，试试切换字表。');
  session = {mode, targets: selectRound(items, records), index: 0, correct: 0, mistakes: [], revealed: false, pool: deck(), group, question: null};
  render();
  content.scrollIntoView({behavior: 'smooth', block: 'start'});
}
function renderSession() {
  if (session.index >= session.targets.length) return renderResult();
  const target = session.targets[session.index];
  const top = `<div class="game-top"><button data-action="exit">← 返回乐园</button><span>${label()} · ${session.mode === 'learn' ? '认识新朋友' : '拼音闯关'}</span><span>${session.index + 1} / ${session.targets.length}</span></div><div class="progress-bar" role="progressbar" aria-label="本轮进度" aria-valuemin="0" aria-valuemax="${session.targets.length}" aria-valuenow="${session.index}"><span style="width:${100 * session.index / session.targets.length}%"></span></div>`;
  if (session.mode === 'learn') {
    content.innerHTML = `<section class="game">${top}${flashHTML(target, session.revealed)}<div class="game-actions"><button class="secondary" data-action="learn-back" ${session.index === 0 ? 'disabled' : ''}>上一个字</button><button class="primary" data-action="next">${session.index + 1 === session.targets.length ? '完成这次认识' : '下一个朋友 →'}</button></div><p class="notes" style="text-align:center;margin-top:18px">翻卡和描写不计作答对；玩拼音闯关可以检验自己。</p></section>`;
    bindCanvas(target.char);
    return;
  }
  if (!session.question) {
    try { session.question = makeQuestion(target, session.pool, session.mode); }
    catch (error) { session = null; render(); toast(error.message); return; }
  }
  const q = session.question;
  content.innerHTML = `<section class="game">${top}<div class="question"><h2>${q.mode === 'character' ? '哪个汉字读这个音？' : '这个汉字读什么音？'}</h2>${q.mode === 'character' ? `<div class="big-pinyin">${target.pinyin}</div>` : `<div class="big-char">${target.char}</div><p class="context">${target.word ? `词语：${target.word}` : target.readings.length > 1 ? `多音字 · 选项中只有一个是它的常见读音` : '选出本卡的常用读音'}</p>`}<div class="choices">${q.choices.map((choice, i) => `<button data-choice="${i}" class="choice ${q.mode === 'sound' ? 'sound-choice' : ''} ${q.answered && choice === q.correct ? 'correct' : ''} ${q.answered && choice === q.chosen && choice !== q.correct ? 'incorrect' : ''}" ${q.answered ? 'disabled' : ''}>${escape(choice)}${q.answered && choice === q.correct ? '<span class="small"> ✓</span>' : ''}${q.answered && choice === q.chosen && choice !== q.correct ? '<span class="small"> 再认识一下</span>' : ''}</button>`).join('')}</div><div class="feedback" role="status">${q.answered ? `${q.chosen === q.correct ? '找到了，真仔细！' : '没关系，我们再认识一次。'}<br><strong>${target.char} · ${target.pinyin}</strong>${target.word ? `，比如“${target.word}”` : ''}` : '慢慢想，不用抢时间。'}</div>${q.answered ? `<div class="game-actions"><button class="secondary" data-card="${target.char}">看看字卡</button><button class="primary" data-action="next">${session.index + 1 === session.targets.length ? '看看小收获 →' : '下一个 →'}</button></div>` : ''}</div></section>`;
  if (q.answered) content.querySelector('[data-action="next"]')?.focus({preventScroll: true});
}
function flashHTML(item, revealed = true, titleId = 'learn-title') {
  return `<div class="flash"><p class="eyebrow">${metadata(item)}</p><h2 id="${titleId}" class="big-char">${item.char}</h2>${revealed ? `<div class="pinyin">${item.pinyin}</div>${item.word ? `<p class="word">${item.word}</p><p class="word-pinyin">${item.wordPinyin}</p><p class="notes">${item.wordSource}</p>` : ''}<button class="audio" data-speak="${item.char}">♪ 听一听</button><p class="notes">${note(item)}</p><button class="text-button" data-action="hide-reading">收起拼音，自己认一认</button><div class="trace-wrap"><div class="trace"><span class="ghost" aria-hidden="true">${item.char}</span><canvas aria-label="${item.char}字自由描写区域"></canvas></div><div class="trace-tools"><button data-action="clear-canvas">擦掉重写</button><label><input type="checkbox" id="show-ghost" checked> 显示底字</label></div><p class="notes">用手指或触控笔描一描。自由练习，不判断笔顺与书写正误。</p></div>` : '<button class="reveal" data-action="reveal">点开拼音，看看你认对了吗？</button>'}</div>`;
}
function renderResult() {
  const learning = session.mode === 'learn';
  content.innerHTML = `<section class="game result"><div class="plant" aria-hidden="true">🌱</div><p class="eyebrow">一小步，也是成长</p><h2>${learning ? '又和汉字熟悉了一点！' : '小森林探索完成！'}</h2>${learning ? `<p>这次看过了 ${session.targets.length} 个字。<br>试试拼音闯关，看看还记得谁。</p>` : `<div class="score">${session.correct}<span class="small"> / ${session.targets.length} 题首次答对</span></div><p>${session.mistakes.length ? `这次要再见一面的字：${session.mistakes.map(x => x.char).join('、')}。<br>已经放进待巩固列表，下次一起再认识。` : '每一道题都找到了好朋友，做得很仔细。'}<br>今天可以休息一下，明天再来看看。</p>`}<div class="game-actions"><button class="secondary" data-action="exit">回到乐园</button><button class="primary" data-action="${learning ? 'test-learned' : 'again'}">${learning ? '试试拼音找汉字' : '再玩一小轮'}</button></div><p class="notes" style="margin-top:22px">${storageWarning ? '当前进度未保存，请到家长小屋导出备份。' : '学习进度保存在当前浏览器，不同设备不会自动同步。'}</p></section>`;
}
function openCard(char) {
  const item = deck().find(x => x.char === char);
  if (!item) return;
  $('#card-content').innerHTML = flashHTML(item, true, 'card-title');
  $('#card-dialog').dataset.char = char;
  $('#card-dialog').showModal();
  bindCanvas(char);
}
function bindCanvas() {
  const canvas = $('#card-dialog').open ? $('#card-dialog canvas') : content.querySelector('canvas');
  if (!canvas) return;
  const box = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio);
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  ctx.lineWidth = 9; ctx.strokeStyle = '#527b56'; ctx.lineCap = ctx.lineJoin = 'round';
  let drawing = false;
  const point = e => {const r = canvas.getBoundingClientRect();return [e.clientX - r.left, e.clientY - r.top];};
  canvas.addEventListener('pointerdown', e => {e.preventDefault(); drawing = true;canvas.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));ctx.lineTo(...point(e));ctx.stroke();});
  canvas.addEventListener('pointermove', e => {if (drawing) {ctx.lineTo(...point(e));ctx.stroke();}});
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => {drawing = false;});
}
function speak(char) {
  if (!('speechSynthesis' in window)) return toast('这台设备暂不支持朗读，可以看拼音和词语来认字。');
  const item = deck().find(x => x.char === char);
  speechSynthesis.cancel();
  const voices = speechSynthesis.getVoices().filter(v => /^zh[-_]?(CN|Hans)/i.test(v.lang));
  if (!voices.length) return toast('设备还没有可用的普通话语音，请看拼音，或在设备设置中添加中文语音。');
  const voice = voices.find(v => v.localService) || voices[0];
  const utterance = new SpeechSynthesisUtterance(item.word || item.char);
  utterance.lang = 'zh-CN'; utterance.voice = voice; utterance.rate = .7;
  utterance.onerror = () => toast('这次没有读出来，可以看拼音，或检查设备的语音设置。');
  speechSynthesis.speak(utterance);
}
function stopAudio() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

function openParent() {
  const all = getDeck(data.books, grade, '全年');
  $('#parent-content').innerHTML = `<div class="parent-copy">${storageWarning ? '<p class="notice">浏览器暂时不能保存进度，请及时导出备份。</p>' : ''}<p>建议每次 10～15 分钟，从孩子正在学习的年级、学期开始。可以先认字卡，再做每轮最多十题的小游戏。不设倒计时，也不因答错扣分。</p><h3>进度是怎样计算的？</h3><p>“练过”表示提交过选择题。只有第一次选择计入本题成绩，重复点击不会增加次数。答错后立即保留待巩固标记；之后的新一轮独立答对才移出。连续三轮答对会长成“小树苗”，这只是游戏记录，不代表已经完全掌握。答对后分别在 1、3、7 天后优先复习，答错的字立即优先。当前年级全年练过 ${summarize(all, records).seen} 个字。</p><h3>备份与隐私</h3><p>无需账号，不收集姓名、学校或联系方式。记录保存在此浏览器；清理数据或更换设备不会自动保留。可导出 JSON，再在另一台设备导入。导入按每个字最后练习时间合并，不累加重复记录。朗读使用设备语音，部分设备的语音服务可能需要联网。</p><div class="parent-actions"><button data-action="export">导出学习记录</button><label class="import-label">导入备份<input id="import-file" type="file" accept="application/json,.json" hidden></label><button class="danger" data-action="ask-clear">清空学习记录</button></div><div id="clear-confirm" class="confirm-clear" hidden><p>将删除这个浏览器中所有年级的学习记录，无法撤回。建议先导出备份。</p><button class="secondary" data-action="cancel-clear">保留记录</button> <button class="primary" data-action="confirm-clear">确认清空</button></div><h3>字表来源与适用范围</h3><p><strong>面向南京小学生的练习工具，并非南京教育部门发布的官方字表。</strong>本版提取了统编版旧版小学语文十二册的识字表和写字表；六年级教材镜像只列写字表。尚未核对南京各校当前使用的教材、修订版本和教学进度，请与孩子手中的课本核对。上下册重复字在“全年”中去重；识字与写字有重叠，不能直接相加。蓝色多音字是复习内容，不计入教材标注的新增生字数。</p><p>${data.pronunciationNote} 朗读依赖设备中文语音，尤其是多音字请结合词语核对；没有中文语音时会明确提示，不作为听力考核。词语例子优先取自对应册词语表，另补充自编常用组词并逐卡标注来源；没有适合词语的字卡仅显示汉字与拼音。自由描写没有笔顺识别或评分。</p><p>参考来源为第三方公开镜像 <a href="https://github.com/TapXWorld/ChinaTextbook/tree/${data.books[0].source.commit}/小学/语文/统编版" target="_blank" rel="noopener noreferrer">TapXWorld/ChinaTextbook</a>，不等同于出版社或学校的版本认证。本应用不分发教材 PDF、插图或课文。具体页码（PDF页序）、来源文件校验摘要及提取方法保存在 data.json 和 scripts/extract-data.py。</p><ul class="source-list">${data.books.map(b => `<li><a href="https://github.com/${b.source.repository}/blob/${b.source.commit}/${encodeURI(b.source.path)}" target="_blank" rel="noopener noreferrer">${b.title}</a>：识字表 ${b.source.recognizePages.join('、') || '无'} 页 / 写字表 ${b.source.writePages.join('、')} 页；教材标注 ${b.source.recognizeCount} 个认读生字、${b.source.writeCount} 个写字。</li>`).join('')}</ul><h3>手机和平板怎么用？</h3><p>通过网站的 /hanzi-game/ 目录打开，可添加到设备主屏幕作为书签。无需安装应用。页面和数据首次加载需要网络；本版没有离线缓存承诺。年级、字表、玩法随时可切换，切换时会结束当前一轮，已经提交的成绩保留。</p></div>`;
  $('#parent-dialog').showModal();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.close) {$('#' + button.dataset.close).close();stopAudio();return;}
  if (!data) return;
  if (button.dataset.grade) {grade = Number(button.dataset.grade);session = null;page = 0;query = '';saveSettings();render();}
  if (button.dataset.term) {term = button.dataset.term;session = null;page = 0;query = '';saveSettings();render();}
  if (button.dataset.tab) {tab = button.dataset.tab;session = null;page = 0;query = '';render();}
  if (button.dataset.mode) start(button.dataset.mode);
  if (button.dataset.group !== undefined) start('character', deck().slice(Number(button.dataset.group) * 20, (Number(button.dataset.group) + 1) * 20), Number(button.dataset.group));
  if (button.dataset.card) openCard(button.dataset.card);
  if (button.dataset.speak) speak(button.dataset.speak);
  if (button.dataset.page) {page += Number(button.dataset.page);renderCards();}
  if (button.dataset.choice !== undefined && session?.question) {
    const q = session.question;
    const result = answerQuestion(q, q.choices[Number(button.dataset.choice)], records);
    if (!result) return;
    records = result.records;
    if (result.right) session.correct++; else session.mistakes.push(q.target);
    save(); refreshHeader(); renderSession();
  }
  const action = button.dataset.action;
  if (action === 'next' && session && (session.mode === 'learn' || session.question?.answered)) {session.index++;session.question = null;session.revealed = false;stopAudio();renderSession();}
  if (action === 'learn-back' && session && session.index > 0) {session.index--;session.revealed = false;renderSession();}
  if (action === 'reveal' || action === 'hide-reading') {
    const dialog = button.closest('#card-dialog');
    if (dialog) {$('#card-content').innerHTML = flashHTML(deck().find(x => x.char === dialog.dataset.char), action === 'reveal', 'card-title');bindCanvas();}
    else if (session) {session.revealed = action === 'reveal';renderSession();}
  }
  if (action === 'exit' || action === 'home') {session = null;tab = 'play';stopAudio();render();}
  if (action === 'all-scope') {scope = 'all';saveSettings();render();}
  if (action === 'again' && session) {const mode = session.mode;const group = session.group;start(mode, group === null ? deck() : deck().slice(group * 20, (group + 1) * 20), group);}
  if (action === 'test-learned' && session) start('character', session.targets);
  if (action === 'review') start('character', deck().filter(x => records[x.char]?.wrong));
  if (action === 'clear-canvas') {const canvas = button.closest('.trace-wrap').querySelector('canvas');canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);}
  if (action === 'export') {
    const url = URL.createObjectURL(new Blob([JSON.stringify({schemaVersion: 1, exportedAt: new Date().toISOString(), records}, null, 2)], {type:'application/json'}));
    const a = document.createElement('a');a.href = url;a.download = '字芽岛-学习记录.json';document.body.append(a);a.click();a.remove();setTimeout(() => URL.revokeObjectURL(url), 1000);toast('已导出学习记录，请妥善保存。');
  }
  if (action === 'ask-clear') $('#clear-confirm').hidden = false;
  if (action === 'cancel-clear') $('#clear-confirm').hidden = true;
  if (action === 'confirm-clear') {records = {};session = null;readFailure = false;storageWarning = false;save();render();$('#parent-dialog').close();toast('已清空此浏览器的学习记录。');}
});
$('#scope').addEventListener('change', event => {scope = event.target.value;session = null;page = 0;query = '';saveSettings();render();});
content.addEventListener('input', event => {
  if (event.target.id !== 'search') return;
  query = event.target.value.trim().slice(0, 30);page = 0;
  const start = event.target.selectionStart;
  renderCards();$('#search').focus({preventScroll:true});$('#search').setSelectionRange(start, start);
});
document.addEventListener('change', async event => {
  if (event.target.id === 'show-ghost') event.target.closest('.trace-wrap').querySelector('.ghost').hidden = !event.target.checked;
  if (event.target.id !== 'import-file') return;
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1000000) throw new Error('备份文件不能超过 1 MB');
    const value = JSON.parse(await file.text());
    if (value.schemaVersion !== 1) throw new Error('备份版本不支持');
    const imported = sanitizeRecords(value.records, known);
    for (const [char, record] of Object.entries(imported)) if (!records[char] || record.last > records[char].last) records[char] = record;
    readFailure = false;save();render();$('#parent-dialog').close();toast(`已合并 ${Object.keys(imported).length} 个字的学习记录。`);
  } catch (error) {toast(error instanceof SyntaxError ? '文件不是有效的 JSON 备份，原记录未更改。' : error.message);}
  event.target.value = '';
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', stopAudio);
$('#parent-open').addEventListener('click', () => data && openParent());
$('#source-open').addEventListener('click', () => data && openParent());

async function boot() {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) throw new Error('字表未能加载');
    data = await response.json();
    known = new Set(data.books.flatMap(b => b.characters.map(x => x.char)));
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {const value = JSON.parse(raw);if (value.schemaVersion !== 1) throw new Error();records = sanitizeRecords(value.records, known);}
    } catch {storageWarning = true;readFailure = true;toast('暂时无法读取原学习记录，未覆盖原数据；请先检查或备份浏览器数据。');}
    try {
      const preferences = JSON.parse(localStorage.getItem(SETTINGS) || '{}');
      if (Number.isInteger(preferences.grade) && preferences.grade >= 1 && preferences.grade <= 6) grade = preferences.grade;
      if (['上','下','全年'].includes(preferences.term)) term = preferences.term;
      if (['all','recognize','write'].includes(preferences.scope)) scope = preferences.scope;
    } catch { /* Preferences can safely fall back. */ }
    render();
  } catch {content.innerHTML = '<div class="empty"><h2>小岛的字表暂时没搬过来</h2><p>请通过 HTTP 网站打开此页面，并检查 data.json 是否完整。连接恢复后再试一次。</p><button class="primary" id="retry-load">重新加载</button></div>';$('#retry-load').onclick = boot;}
}
boot();
