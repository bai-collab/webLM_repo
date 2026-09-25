// Debug helper for the semantic router.
// Enable with: sanguo-popbook.html?debug=1
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1' || params.get('debug') === 'true';

window.__SEMANTIC_DEBUG__ = {
  enabled: DEBUG,
  patched: false,
  last: null,
};

function pct(logprob) {
  if (!Number.isFinite(logprob)) return null;
  return Math.exp(logprob) * 100;
}

function printLogprobs(result, request) {
  const choice = result?.choices?.[0];
  const content = choice?.logprobs?.content || [];
  const raw = choice?.message?.content ?? choice?.text ?? '';
  const prompt = request?.messages?.map(m => `${m.role}: ${m.content}`).join('\n') || request?.prompt || '';

  const snapshot = {
    time: new Date().toISOString(),
    raw,
    prompt,
    content,
    result,
  };
  window.__SEMANTIC_DEBUG__.last = snapshot;

  console.groupCollapsed(`%c[Semantic Debug] output = ${JSON.stringify(raw)}`, 'color:#7a4d22;font-weight:bold');
  console.log('Model request:', request);
  console.log('Raw model output:', raw);

  if (!content.length) {
    console.warn('No logprobs returned. The WebLLM build/model may not expose them for this request.');
    console.log('Full response:', result);
    console.groupEnd();
    return;
  }

  content.forEach((step, index) => {
    const selectedProb = pct(step.logprob);
    console.group(`Token ${index + 1}: ${JSON.stringify(step.token)}  logprob=${Number(step.logprob).toFixed(5)}  p≈${selectedProb?.toFixed(3)}%`);
    const rows = (step.top_logprobs || []).map((candidate, rank) => ({
      rank: rank + 1,
      token: candidate.token,
      logprob: Number(candidate.logprob).toFixed(6),
      probability_percent: pct(candidate.logprob)?.toFixed(4),
      token_bytes: Array.isArray(candidate.bytes) ? candidate.bytes.join(' ') : '',
    }));
    console.table(rows);
    console.groupEnd();
  });

  console.log('Full response:', result);
  console.groupEnd();
}

async function patchEngine() {
  if (!DEBUG || window.__SEMANTIC_DEBUG__.patched) return;

  const popbook = window.__POPBOOK__;
  if (!popbook?.loadLLM) {
    setTimeout(patchEngine, 150);
    return;
  }

  try {
    console.info('[Semantic Debug] debug=1 detected. Loading/attaching to WebLLM…');
    const engine = await popbook.loadLLM();
    const completions = engine?.chat?.completions;
    if (!completions?.create) throw new Error('engine.chat.completions.create not found');
    if (completions.__semanticDebugPatched) {
      window.__SEMANTIC_DEBUG__.patched = true;
      return;
    }

    const originalCreate = completions.create.bind(completions);
    completions.create = async function debugCreate(request) {
      const debugRequest = {
        ...request,
        logprobs: true,
        top_logprobs: 5,
      };
      const result = await originalCreate(debugRequest);
      printLogprobs(result, debugRequest);
      return result;
    };
    completions.__semanticDebugPatched = true;
    window.__SEMANTIC_DEBUG__.patched = true;
    console.info('[Semantic Debug] WebLLM patched. Future classifier calls will print top-5 logprobs.');
  } catch (error) {
    console.error('[Semantic Debug] Failed to attach:', error);
  }
}

if (DEBUG) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', patchEngine, { once: true });
  } else {
    patchEngine();
  }
}