// Semantic Router v2.2
// SmolLM2 is used only as a semantic classifier.
// 1..N = scripted intents, 9 = OUT. Canonical questions always stay deterministic.

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

const HINTS = {
  '你為什麼還在掃地？': ['敵人來了為什麼還掃地', '大軍都來了你怎麼還在掃', '為什麼若無其事地掃地', '為什麼不趕快躲起來'],
  '你會害怕嗎？': ['你不怕嗎', '你會緊張嗎', '敵軍來了你不害怕嗎', '為何不逃跑', '為什麼不逃走', '你怎麼沒有跑掉', '這麼危險你不怕嗎'],
  '你看到什麼情況？': ['你看到什麼', '外面發生什麼事', '你看到軍隊了嗎', '現在外面怎麼了'],
  '為什麼城門要打開？': ['城門怎麼不關', '為什麼不把門關起來', '開門不是很危險嗎', '為什麼要故意開城門'],
  '你為什麼要彈琴？': ['為什麼這時候還彈琴', '彈琴有什麼用', '古琴跟這個計畫有什麼關係'],
  '你怎麼保持冷靜？': ['你怎麼不緊張', '你怎麼這麼鎮定', '遇到危險怎麼冷靜下來'],
  '這個計畫不危險嗎？': ['如果失敗怎麼辦', '不怕被識破嗎', '這樣不是很冒險嗎'],
  '你為什麼撤退？': ['為什麼退兵', '怎麼不進城', '你為什麼跑了'],
  '你在懷疑什麼？': ['你在怕什麼', '你擔心什麼', '為什麼覺得裡面有埋伏'],
  '謹慎有什麼好處？': ['為什麼要這麼小心', '太多疑會怎樣', '小心一點有什麼用'],
  '為什麼三天就夠？': ['三天真的做得到嗎', '為什麼不用十天', '你怎麼敢答應三天'],
  '遇到難題先做什麼？': ['碰到困難第一步怎麼辦', '你怎麼想辦法', '解決問題要先做什麼'],
  '羽扇是法寶嗎？': ['羽扇有什麼用', '為什麼一直搖扇子', '扇子是不是有魔法'],
  '為什麼出造箭難題？': ['為什麼要考諸葛亮', '為什麼叫他造箭', '你為什麼故意出難題'],
  '你相信三天做得到嗎？': ['你相信諸葛亮嗎', '你覺得三天可能嗎', '你覺得他辦得到嗎'],
  '為什麼成功借到箭？': ['箭是怎麼拿到的', '草船為什麼能借到箭', '你怎麼做到的'],
  '為什麼還能喝茶？': ['你怎麼這麼從容', '你不緊張嗎', '這時候還喝茶不怕嗎'],
  '什麼是逆向思考？': ['什麼叫換個方向想', '為什麼不自己造箭', '逆向思考是什麼意思'],
  '為什麼要結拜？': ['你們為什麼當兄弟', '結拜有什麼意義', '為什麼要做這個約定'],
  '你們承諾了什麼？': ['你們約定什麼', '結拜時答應了什麼', '最重要的承諾是什麼'],
  '為什麼要舉杯？': ['酒杯代表什麼', '碰杯是什麼意思', '為什麼要喝酒'],
  '同心協力是什麼？': ['怎樣才算合作', '一起做事情有什麼用', '合作重要嗎'],
  '在等誰？': ['你在等誰', '你為什麼一個人在這裡', '你在等朋友嗎'],
  '為什麼想找夥伴？': ['自己做不行嗎', '為什麼需要朋友', '為什麼想找人一起'],
  '你最重視什麼？': ['你覺得什麼最重要', '你最在乎什麼', '你看重什麼'],
  '你為什麼來桃園？': ['你來這裡做什麼', '你怎麼會來', '你為什麼出現在這裡'],
  '你怎麼看劉備？': ['你覺得劉備怎樣', '你相信劉備嗎', '你對劉備的印象如何'],
  '什麼是義氣？': ['義氣是什麼', '朋友之間怎麼才算有義氣', '有義氣是什麼意思'],
  '你為什麼也來了？': ['你怎麼也來桃園', '你來找誰', '你為什麼出現'],
  '朋友需要幫忙怎麼辦？': ['朋友遇到困難怎麼辦', '你會幫朋友嗎', '夥伴出事時你怎麼做'],
  '你最重視哪個承諾？': ['你最在意哪個約定', '你最重視什麼', '信用重要嗎'],
  '你會守承諾嗎？': ['你說話算話嗎', '你會反悔嗎', '答應的事會做到嗎'],
  '結拜是為了財寶嗎？': ['是為了錢嗎', '你們想要寶物嗎', '結拜是因為利益嗎'],
  '這段故事想告訴我們什麼？': ['這故事有什麼道理', '可以學到什麼', '這段重點是什麼'],
  '好朋友要怎麼相處？': ['朋友之間最重要什麼', '怎麼當好朋友', '朋友應該怎麼相處'],
  '信任重要嗎？': ['為什麼要相信朋友', '信用重要嗎', '朋友要互相信任嗎'],
  '合作時要注意什麼？': ['一起做事要注意什麼', '怎樣合作比較好', '合作的重點是什麼'],
  '你從結拜學到什麼？': ['你有什麼收穫', '這次結拜讓你學到什麼', '你學到了什麼'],
  '為什麼需要團隊？': ['一定要合作嗎', '一個人不是比較快嗎', '為什麼需要夥伴']
};

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
  return {
    scene: $('#chatSceneInfo')?.textContent?.trim() || '',
    character: $('#chatCharacterName')?.textContent?.trim() || ''
  };
}

function examplesFor(label) {
  return HINTS[label] || [label];
}

function buildPrompt(question, labels) {
  const { scene, character } = contextText();
  const options = labels.map((label, i) => {
    const examples = examplesFor(label).slice(0, 5).join('；');
    return `${i + 1}：${label}\n可能說法：${examples}`;
  }).join('\n\n');

  const demos = labels.map((label, i) => {
    const ex = examplesFor(label)[0] || label;
    return `學生：「${ex}」→ ${i + 1}`;
  }).join('\n');

  return `你是兒童互動繪本的語意意圖分類器，不是聊天機器人。\n\n目前角色：${character}\n目前場景：${scene}\n\n請依學生真正想問的意思分類。即使用不同說法、反問句、口語或沒有使用相同關鍵詞，只要語意相同就選同一類。\n\n${options}\n\n9：超出範圍。只有問題和上面所有類別都沒有直接語意關係時，才選 9。\n\n分類示例：\n${demos}\n學生：「今天天氣好嗎？」→ 9\n\n現在分類：\n學生：「${question}」\n答案只輸出 1 到 ${labels.length} 或 9 的一個數字，不要解釋：`;
}

function digitCandidates(result, labels) {
  const rows = [];
  const steps = result?.choices?.[0]?.logprobs?.content || [];
  for (const step of steps) {
    for (const c of step?.top_logprobs || []) {
      const t = String(c.token ?? '').trim();
      if (!/^[0-9]$/.test(t)) continue;
      const n = Number(t);
      if (n !== 9 && (n < 1 || n > labels.length)) continue;
      rows.push({ label: n, token: c.token, logprob: Number(c.logprob), p: Math.exp(Number(c.logprob)) });
    }
  }
  const best = new Map();
  for (const r of rows) {
    const old = best.get(r.label);
    if (!old || r.logprob > old.logprob) best.set(r.label, r);
  }
  const out = [...best.values()].sort((a, b) => b.logprob - a.logprob);
  const total = out.reduce((s, r) => s + r.p, 0) || 1;
  out.forEach((r) => r.normalized = r.p / total);
  return out;
}

function debugResult(result, labels, question, picked, mode) {
  if (!DEBUG) return;
  const raw = result?.choices?.[0]?.message?.content ?? '';
  const candidates = digitCandidates(result, labels);
  console.groupCollapsed(`%c[Router v2.2] ${JSON.stringify(question)} → ${picked}`,'color:#7a4d22;font-weight:bold');
  console.log('Mode:', mode);
  console.log('Labels:', Object.fromEntries([...labels.map((x, i) => [String(i + 1), x]), ['9', 'OUT']]));
  console.log('Raw model output:', raw);
  console.log('Usage:', result?.usage);
  console.table(candidates.map((c, rank) => ({
    rank: rank + 1,
    label: c.label,
    intent: c.label === 9 ? 'OUT' : labels[c.label - 1],
    token: JSON.stringify(c.token),
    logprob: c.logprob.toFixed(6),
    probability_percent: (c.p * 100).toFixed(4),
    normalized_among_digit_candidates_percent: (c.normalized * 100).toFixed(2)
  })));
  console.log('Full response:', result);
  console.groupEnd();
  window.__SEMANTIC_DEBUG__ ??= {};
  window.__SEMANTIC_DEBUG__.last = { question, labels, picked, candidates, result, mode };
}

async function classifyNumeric(question, labels, mode = 'live') {
  const engine = await window.__POPBOOK__.loadLLM();
  if (mode !== 'shadow') status.textContent = '正在判斷問題語意…';

  const request = {
    messages: [{ role: 'user', content: buildPrompt(question, labels) }],
    temperature: 0,
    top_p: 1,
    max_tokens: 3,
    logprobs: DEBUG,
    top_logprobs: DEBUG ? 5 : undefined
  };

  const result = await engine.chat.completions.create(request);
  const raw = String(result?.choices?.[0]?.message?.content ?? '').trim();
  const m = raw.match(/[1-9]/);
  let picked = m ? Number(m[0]) : null;
  if (picked !== 9 && (picked == null || picked < 1 || picked > labels.length)) {
    const candidates = digitCandidates(result, labels);
    picked = candidates.length ? candidates[0].label : 9;
  }

  debugResult(result, labels, question, picked, mode);
  return picked;
}

async function shadowClassify(question, labels) {
  try {
    const picked = await classifyNumeric(question, labels, 'shadow');
    console.info(`[Router v2.2][shadow] model picked ${picked} → ${picked === 9 ? 'OUT' : labels[picked - 1]}`);
  } catch (error) {
    console.warn('[Router v2.2][shadow] failed:', error);
  }
}

async function routeQuestion(event) {
  if (bypass) return;
  const question = input.value.trim();
  if (!question || busy) return;
  const labels = currentLabels();
  if (!labels.length) return;

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
    const picked = await classifyNumeric(question, labels, 'live');
    if (picked === 9) {
      addMessage('user', question, '你');
      addMessage('assistant', '超出範圍');
      status.textContent = '語意分類：9 → 超出範圍';
      progress.style.width = '100%';
      input.value = '';
      return;
    }

    const canonical = labels[picked - 1];
    input.value = canonical;
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
    console.error('[Router v2.2] classification failed:', error);
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
  if (exact) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  routeQuestion(event);
}, { capture: true });

window.__SEMANTIC_ROUTER_V2__ = { enabled: true, version: '2.2', debug: DEBUG, classifyNumeric, currentLabels };
if (DEBUG) console.info('[Router v2.2] Debug mode: 1..N=intent, 9=OUT; prompt includes semantic examples.');
