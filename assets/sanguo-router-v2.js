// Semantic Router v2
// Uses SmolLM2 only to choose one numeric intent label.
// 0 = OUT, 1..N = the currently visible scripted quick prompts.

const $ = (s) => document.querySelector(s);
const sendBtn = $('#sendChatBtn');
const input = $('#chatInput');
const messages = $('#chatMessages');
const status = $('#llmStatus');
const progress = $('#llmProgress');

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1' || params.get('debug') === 'true';
let bypass = false;
let busy = false;

function currentLabels() {
  return [...document.querySelectorAll('#quickPrompts .quickChip')]
    .map((el) => el.textContent.trim())
    .filter(Boolean);
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[\s，。！？、,.!?：:；;「」『』（）()"'`~\-]/g, '');
}

function addMessage(role, text, name) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;
  const title = document.createElement('div');
  title.className = 'msgName';
  title.textContent = name || (role === 'user' ? '你' : $('#chatCharacterName')?.textContent || '角色');
  const body = document.createElement('div');
  body.textContent = text;
  wrap.append(title, body);
  messages.appendChild(wrap);
  wrap.scrollIntoView({ block: 'nearest' });
  return wrap;
}

function buildPrompt(question, labels) {
  const options = [
    '0：超出範圍／和目前角色、場景或下列問題都不相符',
    ...labels.map((label, i) => `${i + 1}：${label}`),
  ].join('\n');

  return `你是兒童互動繪本的意圖分類器，不是聊天機器人。\n\n請把學生問題分類到最接近的一個選項。\n如果學生真正想問的意思和任何已知選項都不相符，選 0。\n只輸出一個阿拉伯數字，不可輸出任何其他文字。\n\n${options}\n\n學生問題：${question}\n答案：`;
}

function numericCandidates(result, maxLabel) {
  const step = result?.choices?.[0]?.logprobs?.content?.[0];
  const list = step?.top_logprobs || [];
  const byDigit = new Map();

  for (const c of list) {
    const token = String(c.token ?? '').trim();
    if (!/^\d$/.test(token)) continue;
    const digit = Number(token);
    if (digit < 0 || digit > maxLabel) continue;
    const prev = byDigit.get(digit);
    if (!prev || c.logprob > prev.logprob) byDigit.set(digit, c);
  }

  return [...byDigit.entries()]
    .map(([digit, c]) => ({
      digit,
      logprob: Number(c.logprob),
      probability: Math.exp(Number(c.logprob)),
      token: c.token,
    }))
    .sort((a, b) => b.logprob - a.logprob);
}

function debugResult(result, labels, question, picked) {
  if (!DEBUG) return;
  const raw = result?.choices?.[0]?.message?.content ?? '';
  const candidates = numericCandidates(result, labels.length);

  console.groupCollapsed(
    `%c[Router v2] ${JSON.stringify(question)} → ${picked}`,
    'color:#7a4d22;font-weight:bold'
  );
  console.log('Labels:', Object.fromEntries([['0', 'OUT'], ...labels.map((x, i) => [String(i + 1), x])]));
  console.log('Raw model output:', raw);
  console.table(candidates.map((c, rank) => ({
    rank: rank + 1,
    label: c.digit,
    intent: c.digit === 0 ? 'OUT' : labels[c.digit - 1],
    token: JSON.stringify(c.token),
    logprob: c.logprob.toFixed(6),
    probability_percent: (c.probability * 100).toFixed(4),
  })));
  console.log('Full response:', result);
  console.groupEnd();

  window.__SEMANTIC_DEBUG__ ??= {};
  window.__SEMANTIC_DEBUG__.last = { question, labels, picked, candidates, result };
}

async function classifyNumeric(question, labels) {
  const engine = await window.__POPBOOK__.loadLLM();
  status.textContent = '正在用單一數字 token 判斷語意…';

  const request = {
    messages: [{ role: 'user', content: buildPrompt(question, labels) }],
    temperature: 0,
    max_tokens: 1,
    logprobs: DEBUG,
    top_logprobs: DEBUG ? 5 : undefined,
  };

  const result = await engine.chat.completions.create(request);
  const raw = String(result?.choices?.[0]?.message?.content ?? '').trim();
  const match = raw.match(/[0-9]/);
  let picked = match ? Number(match[0]) : 0;
  if (!Number.isInteger(picked) || picked < 0 || picked > labels.length) picked = 0;

  debugResult(result, labels, question, picked);
  return picked;
}

async function routeQuestion(event) {
  if (bypass) return;

  const question = input.value.trim();
  if (!question || busy) return;

  const labels = currentLabels();
  if (!labels.length) return; // let original handler deal with unusual states

  // Exact canonical questions already hit the main script's deterministic fast matcher.
  // In debug mode we deliberately run them through SmolLM2 too, so their probabilities can be inspected.
  const exact = labels.find((x) => normalize(x) === normalize(question));
  if (exact && !DEBUG) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  busy = true;
  sendBtn.disabled = true;

  try {
    const picked = await classifyNumeric(question, labels);

    if (picked === 0) {
      addMessage('user', question, '你');
      addMessage('assistant', '超出範圍');
      status.textContent = '語意分類：0 → 超出範圍';
      progress.style.width = '100%';
      input.value = '';
      return;
    }

    const canonical = labels[picked - 1];
    input.value = canonical;

    // Re-enter the original deterministic handler using the canonical scripted question.
    // Then restore the user's original wording in the visible chat bubble.
    const before = [...messages.querySelectorAll('.msg.user')].length;
    bypass = true;
    sendBtn.click();
    bypass = false;

    queueMicrotask(() => {
      const userBubbles = [...messages.querySelectorAll('.msg.user')];
      if (userBubbles.length > before) {
        const body = userBubbles.at(-1)?.lastElementChild;
        if (body) body.textContent = question;
      }
      status.textContent = `語意分類：${picked} → ${canonical}`;
      progress.style.width = '100%';
    });
  } catch (error) {
    console.error('[Router v2] classification failed:', error);
    addMessage('user', question, '你');
    addMessage('system', '語意模型目前無法完成分類。', '導覽');
    status.textContent = `語意分類失敗：${error.message}`;
    input.value = '';
  } finally {
    busy = false;
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', routeQuestion, { capture: true });
input.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || bypass) return;
  const labels = currentLabels();
  const exact = labels.find((x) => normalize(x) === normalize(input.value.trim()));
  if (exact && !DEBUG) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  routeQuestion(event);
}, { capture: true });

window.__SEMANTIC_ROUTER_V2__ = {
  enabled: true,
  debug: DEBUG,
  classifyNumeric,
  currentLabels,
};

if (DEBUG) {
  console.info('[Router v2] Debug mode enabled. Classifier output is a single numeric token: 0=OUT, 1..N=intent.');
}
