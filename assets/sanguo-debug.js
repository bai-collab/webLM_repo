// Semantic debug state for Router v2.
// Enable with: sanguo-popbook.html?debug=1
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1' || params.get('debug') === 'true';

window.__SEMANTIC_DEBUG__ = {
  enabled: DEBUG,
  last: null,
};

if (DEBUG) {
  console.info('[Semantic Debug] enabled. Router v2 will print numeric top-logprobs for each classification.');
  console.info('[Semantic Debug] label convention: 0 = OUT, 1..N = current scripted intents.');
}
