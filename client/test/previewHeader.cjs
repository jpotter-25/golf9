// Run locally with: node test/previewHeader.cjs
// This renders the real header with fixture data, not a public app route.
const http = require('node:http');
const { renderToStaticMarkup } = require('react-dom/server');
const { StyleSheet } = require('react-native-web');
const { topBarFixture } = require('./helpers/topBarFixture.cjs');

http.createServer((request, response) => {
  if (request.url !== '/') { response.writeHead(404).end(); return; }
  const cases = [
    { width: 414, coins: 54321, label: 'Phone · 414px · full balance' },
    { width: 375, coins: 54321, label: 'Small phone · 375px · full balance' },
    { width: 320, coins: 54321, label: 'Narrow phone · 320px · wrapped controls' },
    { width: 375, coins: 1250000, label: 'Small phone · 1,250,000 coins' },
    { width: 375, coins: 54321, route: 'Shop', label: 'Small phone · screen with Home button' },
    { width: 320, coins: 99999, fontScale: 2, label: 'Narrow phone · simulated 200% text' },
    { width: 768, coins: Number.MAX_SAFE_INTEGER, label: 'Tablet · very large balance' },
  ];
  const content = cases.map((fixture, index) => `<section><h2>${fixture.label}</h2><div class="fixture" data-case="${index}" style="width:${fixture.width}px">${renderToStaticMarkup(topBarFixture(fixture).tree)}</div></section>`).join('');
  const sheet = StyleSheet.getSheet();
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`<!doctype html><html><head><title>Nine Below header layout checks</title><style>${sheet.textContent}</style><style>body{margin:0;padding:24px;background:#15253c;color:#eff5ff;font-family:Arial,sans-serif}h1{font-size:22px}p{color:#bbcadb}h2{font-size:14px;font-weight:400;margin:24px 0 4px}.fixture{background:#286865;padding:12px 0;border-radius:12px}main{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}section{margin:0}</style></head><body><h1>Nine Below · responsive coin balance</h1><p>Actual shared header styles; synthetic account, placeholder icons. Native device verification is separate.</p><main>${content}</main></body></html>`);
}).listen(4179, '127.0.0.1', () => console.log('Header fixture: http://127.0.0.1:4179'));
