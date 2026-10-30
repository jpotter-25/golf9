const http = require('node:http');
const { renderToStaticMarkup } = require('react-dom/server');
const { StyleSheet } = require('react-native-web');
const { tableVisibilityFixture } = require('./helpers/tableVisibilityFixture.cjs');
http.createServer((request, response) => {
  if (request.url !== '/') { response.writeHead(404).end(); return; }
  const rows = ['draw', 'reveal', 'finished'].map(stage => `<section><h2>${stage === 'draw' ? '1. Deck card drawn' : stage === 'reveal' ? '2. Grid revealed — decision still pending' : '3. Keep revealed — turn complete'}</h2><div class="pair">${[false, true].map(observer => `<article><h3>${observer ? 'Opponent sees' : 'Active player sees'}</h3>${renderToStaticMarkup(tableVisibilityFixture({ stage, observer }).tree)}</article>`).join('')}</div></section>`).join('');
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`<!doctype html><html><head><title>Nine Below public turn cards</title><style>${StyleSheet.getSheet().textContent}</style><style>body{background:#15253c;color:#eff5ff;font-family:Arial,sans-serif;padding:16px}h1{font-size:22px}h2{font-size:16px}h3{font-size:14px;text-align:center}main{display:flex;flex-wrap:wrap;gap:24px}.pair{display:flex;gap:12px}article{background:#23445b;padding:12px;border:1px solid #62809c;border-radius:12px;min-width:190px}</style></head><body><h1>Immediate public card visibility</h1><p>Actual card/grid/pile components; synthetic table. No live accounts or physical-device testing.</p><main>${rows}</main></body></html>`);
}).listen(4181, '127.0.0.1', () => console.log('Table visibility fixture: http://127.0.0.1:4181'));
