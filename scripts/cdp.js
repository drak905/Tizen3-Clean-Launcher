// Minimal Chrome DevTools Protocol client: node scripts/cdp.js <expr...>
const port = process.env.CDP_PORT || 38090;
(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  let id = 0; const pending = {}; const logs = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    else if (msg.method === 'Runtime.consoleAPICalled') logs.push('console.' + msg.params.type + ': ' + msg.params.args.map(a => a.value ?? a.description).join(' '));
    else if (msg.method === 'Console.messageAdded') logs.push('console: ' + msg.params.message.text);
    else if (msg.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + JSON.stringify(msg.params.exceptionDetails));
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable'); await send('Console.enable').catch(() => {});
  for (const expr of process.argv.slice(2)) {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    console.log('>>', expr.slice(0, 80)); console.log(JSON.stringify(res.result?.result?.value ?? res.result ?? res.error));
  }
  await new Promise(r => setTimeout(r, Number(process.env.CDP_WAIT || 1500)));
  logs.forEach(l => console.log(l));
  ws.close();
})().catch(e => { console.error(e); process.exit(1); });
