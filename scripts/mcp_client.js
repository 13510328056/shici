// MCP client to call 墨刀 tools
const { spawn } = require('child_process');

const mcp = spawn('C:/Program Files/nodejs/npx.cmd', [
  '-y', '@modao-mcp/modao-proto-mcp',
  '--token=e9c9a1691fda6abb7883ec62ed8d74ee',
  '--url=https://modao.cc'
], { stdio: ['pipe', 'pipe', 'pipe'] });

let buffer = '';
let reqId = 0;

mcp.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        console.log('Response:', JSON.stringify(msg, null, 2));
      } catch (e) {
        console.log('Raw:', line);
      }
    }
  }
});

mcp.stderr.on('data', (data) => {
  // MCP servers often log debug info to stderr
  const msg = data.toString().trim();
  if (msg) console.error('MCP:', msg);
});

function send(method, params = {}) {
  reqId++;
  const msg = JSON.stringify({ jsonrpc: '2.0', id: reqId, method, params });
  mcp.stdin.write(msg + '\n');
}

// Discover tools
send('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'custom-client', version: '1.0.0' }
});

setTimeout(() => {
  send('tools/list');
}, 2000);

setTimeout(() => {
  // Try gen_description with the prototype name
  send('tools/call', {
    name: 'gen_description',
    arguments: { requirement: '古诗词检索H5原型 v7 mobile design' }
  });
}, 4000);

setTimeout(() => {
  console.log('\n=== Done ===');
  mcp.kill();
  process.exit(0);
}, 10000);
