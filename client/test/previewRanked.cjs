// Local-only visual regression fixture. Run: node test/previewRanked.cjs
const http = require('node:http');
const { renderToStaticMarkup } = require('react-dom/server');
const { StyleSheet } = require('react-native-web');
const { rankedFixture } = require('./helpers/rankedFixture.cjs');
http.createServer((request, response) => {
  if (request.url !== '/') { response.writeHead(404).end(); return; }
  const cases = [
    { width: 375, label: '375px queue' }, { width: 320, label: '320px queue' },
    { width: 414, label: '414px queue', claimable: 12 },
    { width: 320, fontScale: 2, label: '320px simulated 200% text' },
    { width: 375, menu: true, label: '375px ranked menu' },
  ];
  const content = cases.map((fixture, i) => `<section><h2>${fixture.label}</h2><div class="fixture" data-case="${i}" style="width:${fixture.width}px">${renderToStaticMarkup(rankedFixture(fixture))}</div></section>`).join('');
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`<!doctype html><html><head><title>Nine Below ranked layout checks</title><style>${StyleSheet.getSheet().textContent}</style><style>body{margin:0;padding:20px;background:#15253c;color:#eff5ff;font-family:Arial,sans-serif}h1{font-size:22px}h2{font-size:14px}main{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}.fixture{background:#286865}</style></head><body><h1>Ranked queue and season layout</h1><p>Actual screen/styles; synthetic data and placeholder icons. Not physical-device verification.</p><main>${content}</main></body></html>`);
}).listen(4180, '127.0.0.1', () => console.log('Ranked fixture: http://127.0.0.1:4180'));
