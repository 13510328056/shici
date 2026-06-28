// Discover MCP tools
const { spawn } = require('child_process');
const path = require('path');

const npxPath = 'C:/Program Files/nodejs/npx.cmd';
const args = ['-y', '@modao-mcp/modao-proto-mcp',
  '--token=e9c9a1691fda6abb7883ec62ed8d74ee', '--url=https://modao.cc'];

function call(method, params, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(npxPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    proc.stdout.on('data', d => output += d.toString());
    proc.stderr.on('data', d => { /* ignore stderr */ });
    proc.on('close', () => {
      try {
        const lines = output.trim().split('\n').filter(l => l.trim());
        const results = lines.map(l => JSON.parse(l));
        resolve(results);
      } catch (e) {
        reject(e);
      }
    });
    const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || {} });
    proc.stdin.write(req + '\n');
    proc.stdin.end();
    setTimeout(() => { proc.kill(); resolve(null); }, timeout);
  });
}

async function main() {
  // Initialize
  console.log('=== Initialize ===');
  const init = await call('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'client', version: '1.0.0' }
  });
  console.log(JSON.stringify(init, null, 2));

  // List tools
  console.log('\n=== Tools List ===');
  const tools = await call('tools/list');
  console.log(JSON.stringify(tools, null, 2));

  // Try gen_description for the prototype
  console.log('\n=== gen_description ===');
  const desc = await call('tools/call', {
    name: 'gen_description',
    arguments: { requirement: '古诗词检索H5原型 v7' }
  }, 15000);
  console.log(JSON.stringify(desc, null, 2));
}

main().catch(console.error);
