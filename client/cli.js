'use strict';

const readline = require('readline');
const { request } = require('./http-client');

// ─── TERMINAL INTERFACE ───────────────────────────────────────────────────────

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ─── RESPONSE FORMATTER ───────────────────────────────────────────────────────

function printResponse(res) {
  console.log('\n──────────────── RESPONSE ─────────────────');
  console.log(`Status : ${res.statusCode} ${res.statusText}`);
  console.log('Headers:');
  for (const [key, value] of Object.entries(res.headers)) {
    console.log(`  ${key}: ${value}`);
  }

  if (res.body.length > 0) {
    console.log('Body:');
    try {
      const parsed = JSON.parse(res.body);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(res.body);
    }
  }

  console.log('───────────────────────────────────────────\n');
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║             HTTP/1.1 Client          ║');
  console.log('║  Write "exit" in the URL to quit     ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Ask the API key one time before the loop so it can be reused in every request without asking again
  const apiKey = await prompt('API key (leave empty if server requires none): ');
  if (apiKey.length > 0) {
    console.log(`[*] API key set — will be sent automatically as x-api-key on every request.\n`);
  }

  let requestCount = 0;

  while (true) {
    if (requestCount > 0) {
      console.log('════════════════ NEXT REQUEST ══════════════\n');
    }

    const url = await prompt('URL    : ');
    if (url.toLowerCase() === 'exit') break;

    const method  = (await prompt('Method (GET/POST/PUT/DELETE/HEAD) [GET]: ')).toUpperCase() || 'GET';
    const rawHdrs = await prompt('Extra headers (key:value,key:value) [none]: ');
    const rawBody = await prompt('JSON body (leave empty if none): ');

    const headers = {};

    //  Add the API key header if provided
    if (apiKey.length > 0) {
      headers['x-api-key'] = apiKey;
    }

    if (rawHdrs.length > 0) {
      for (const pair of rawHdrs.split(',')) {
        const idx = pair.indexOf(':'); // indexOf instead of split to avoid issues with values containing ':' (tokens, URLs)
        if (idx !== -1) {
          const key   = pair.substring(0, idx).trim();
          const value = pair.substring(idx + 1).trim();
          headers[key] = value;
        }
      }
    }

    let body = null;
    if (rawBody.length > 0) {
      try {
        body = JSON.parse(rawBody); // parse first so buildRequest does not double-stringify
      } catch {
        console.log('CAUTION: body is not valid JSON, it will be sent as a plain string.\n');
        body = rawBody;
      }
    }

    try {
      console.log(`\n→ Sending ${method} ${url} ...`);
      const res = await request({ method, url, headers, body });
      printResponse(res);
    } catch (err) {
      console.error(`Error: ${err.message}\n`);
    }

    requestCount++;
  }

  console.log('\nGoodbye');
  rl.close();
}

main();
