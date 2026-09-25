// Semantic Router v2.1
// SmolLM2 only chooses one numeric intent label.
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
let digitTokenPromise = null;

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

function contextText() {
  const scene = $('#chatSceneInfo')?.textContent?.trim() || '';
  const character = $('#chatCharacterName')?.textContent?.trim() || '';
  return { scene, character };
}

function buildPrompt(question, labels) {
  const { scene, character } = contextText();
  const options = [
    '0：超出範圍；和目前角色、場景、下列問題都沒有直接關係',
    ...labels.map((label, i) => `${i + 1}：${label}`),
  ].join('\n');

  return `你是兒童互動繪本的語意意圖分類器，不是聊天機器人。\n\n目前角色：${character}\n目前場景：${scene}\n\n任務：判斷學生真正想問的意思，選最接近的一個選項。\n即使學生用不同說法、反問句或口語表達，只要語意相同就選對應項目。\n若與所有已知問題都沒有直接關係，選 0。\n只輸出一個阿拉伯數字，不得輸出說明、標點或其他文字。\n\n${options}\n\n學生問題：${question}\n答案：`;
}

async function loadDigitTokenInfo(maxDigit = 9) {
  if (digitTokenPromise) return digitTokenPromise;
  digitTokenPromise = (async () => {
    // q4f16/q4f32 use the same tokenizer. Fetching tokenizer.json is much smaller than the model.
    const url = 'https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/tokenizer.json';
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`tokenizer.json HTTP ${response.status}`);
    const tokenizer = await response.json();
    const vocab = tokenizer?.model?.vocab || {};
    const byDigit = new Map();

    for (let d = 0; d <= maxDigit; d++) {
      const variants = [String(d), `Ġ${d}`, `▁${d}`];
      const ids = variants
        .filter((token) => Object.prototype.hasOwnProperty.call(vocab, token))
        .map((token) => ({ token, id: Number(vocab[token]) }))
        .filter((x) => Number.isInteger(x.id));
      if (ids.length) byDigit.set(d, ids);
    }

    if (DEBUG) {
      console.groupCollapsed('[Router v2.1] digit token IDs');
      console.table([...byDigit.entries()].flatMap(([digit, rows]) => rows.map((r) => ({ digit, token: r.token, token_id: r.id }))));
      console.groupEnd();
    }
    return byDigit;
  })().catch((error) => {
    console.warn('[Router v2.1] Could not load tokenizer for logit_bias; falling back to unconstrained decode.', error);
    return new Map();
  });
  return digitTokenPromise;
}

function buildDigitBias(tokenInfo, maxLabel) {
  const bias = {};
  for (let d = 0; d <= maxLabel; d++) {
    for (const item of tokenInfo.get(d) || []) bias[String(item.id)] = 100;
  }
  return Object.keys(bias).length ? bias : undefined;
}

function parseDigitFromToken(token, maxLabel) {
  const text = String(token ?? '').trim();
  const m = text.match(/^([0-9])$/);
  if (!m) return null;
  const value = Number(m[1]);
  return value >= 0 && value <= maxLabel ? value : null;
}

function numericCandidates(result, maxLabel) {
  const steps = result?.choices?.[0]?.logprobs?.content || [];
  const byDigit = new Map();
  for (const step of steps) {
    for (const c of step?.top_logprobs || []) {
      const digit = parseDigitFromToken(c.token, maxLabel);
      if (digit == null) continue;
      const logprob = Number(c.logprob);
      const prev = byDigit.get(digit);
      if (!prev || logprob > prev.logprob) byDigit.set(digit, { token: c.token, logprob });
    }
  }
  const rows = [...byDigit.entries()].map(([digit, c]) => ({
    digit,
    token: c.token,
    logprob: c.logprob,
    probability: Math.exp(c.logprob),
  })).sort((a, b) => b.logprob - a.logprob);
  const total = rows.reduce((sum, r) => sum + r.probability, 0) || 1;
  rows.forEach((r) => { r.normalized = r.probability / total; });
  return rows;
}

function debugResult(result, labels, question, picked, meta = {}) {
  if (!DEBUG) return;
  const raw = result?.choices?.[0]?.message?.content ?? '';
  const candidates = numericCandidates(result, labels.length);

  console.groupCollapsed(
    `%c[Router v2.1] ${JSON.stringify(question)} → ${picked}`,
    'color:#7a4d22;font-weight:bold'
  );
  console.log('Mode:', meta.mode || 'live');
  console.log('Labels:', Object.fromEntries([['0', 'OUT'], ...labels.map((x, i) => [String(i + 1), x])]));
  console.log('Raw model output:', raw);
  console.log('Usage:', result?.usage);
  console.table(candidates.map((c, rank) => ({
    rank: rank + 1,
    label: c.digit,
    intent: c.digit === 0 ? 'OUT' : labels[c.digit - 1],
    token: JSON.stringify(c.token),
    logprob: c.logprob.toFixed(6),
    probability_percent: (c.probability * 100).toFixed(4),
    normalized_among_digit_candidates_percent: (c.normalized * 100).toFixed(2),
  })));
  console.log('Full response:', result);
  console.groupEnd();

  window.__SEMANTIC_DEBUG__ ??= {};
  window.__SEMANTIC_DEBUG__.last = { question, labels, picked, candidates, result, meta };
}

async function classifyNumeric(question, labels, meta = {}) {
  const engine = await window.__POPBOOK__.loadLLM();
  if (meta.mode !== 'shadow') status.textContent = '正在用單一數字 token 判斷語意…';

  const tokenInfo = await loadDigitTokenInfo(labels.length);
  const logitBias = buildDigitBias(tokenInfo, labels.length);
  const request = {
    messages: [{ role: 'user', content: buildPrompt(question, labels) }],
    temperature: 0,
    top_p: 1,
    max_tokens: logitBias ? 1 : 4,
    ignore_eos: Boolean(logitBias),
    logit_bias: logitBias,
    logprobs: DEBUG,
    top_logprobs: DEBUG ? 5 : undefined,
  };

  const result = await engine.chat.completions.create(request);
  const raw = String(result?.choices?.[0]?.message?.content ?? '').trim();
  const match = raw.match(/[0-9]/);
  let picked = match ? Number(match[0]) : null;

  // If text decoding was odd, recover from top-logprobs instead of forcing OUT.
  if (picked == null || picked < 0 || picked > labels.length) {
    const candidates = numericCandidates(result, labels.length);
    picked = candidates.length ? candidates[0].digit : 0;
  }

  debugResult(result, labels, question, picked, meta);
  return picked;
}

async function shadowClassify(question, labels) {
  try {
    const picked = await classifyNumeric(question, labels, { mode: 'shadow' });
    console.info(`[Router v2.1][shadow] expected canonical question; model picked ${picked} → ${picked === 0 ? 'OUT' : labels[picked - 1]}`);
  } catch (error) {
    console.warn('[Router v2.1][shadow] classification failed:', error);
  }
}

async function routeQuestion(event) {
  if (bypass) return;

  const question = input.value.trim();
  if (!question || busy) return;

  const labels = currentLabels();
  if (!labels.length) return;

  // Canonical questions must always use the deterministic scripted path.
  // Debug mode evaluates the model in the background only, so debugging never changes the student's answer.
  const exact = labels.find((x) => normalize(x) === normalize(question));
  if (exact) {
    if (DEBUG) void shadowClassify(question, labels);
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  busy = true;
  sendBtn.disabled = true;

  try {
    const picked = await classifyNumeric(question, labels, { mode: 'live' });

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

    // Feed the canonical question into the original deterministic script handler.
    // Afterwards, restore the student's original wording in the visible bubble.
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
    console.error('[Router v2.1] classification failed:', error);
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
  if (exact) {
    if (DEBUG) void shadowClassify(input.value.trim(), labels);
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  routeQuestion(event);
}, { capture: true });

window.__SEMANTIC_ROUTER_V2__ = {
  version: '2.1',
  enabled: true,
  debug: DEBUG,
  classifyNumeric,
  currentLabels,
  loadDigitTokenInfo,
};

if (DEBUG) {
  console.info('[Router v2.1] Debug enabled. Canonical questions use deterministic answers + shadow classification.');
  console.info('[Router v2.1] Non-canonical questions use constrained numeric classification: 0=OUT, 1..N=intent.');
}
