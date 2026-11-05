import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const styles = ['Public Campaign Cinematic', 'Minimal Still Life', 'Human-centered Documentary', 'Editorial Campaign'];
const sizes = { '1:1': '1024x1024', '4:5': '1024x1280', '2:3': '1024x1536', '3:4': '1024x1360', '9:16': '1024x1824', '16:9': '1792x1008' };
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function apiFailure(res, status, data, fallback) {
  const error = data?.error || {};
  const code = error.code || '';
  const type = error.type || '';
  if (['credit_balance_exhausted', 'insufficient_quota', 'organization_usage_limit_exceeded', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded'].includes(code) || type === 'insufficient_quota') {
    return send(res, 503, { error: '이번 체험에 준비한 이미지 생성 크레딧을 모두 사용했어요. 제작자가 크레딧을 충전하면 다시 이용할 수 있어요.', code: 'CREDITS_EXHAUSTED' });
  }
  if (code === 'rate_limit_exceeded' || (status === 429 && type !== 'insufficient_quota')) {
    return send(res, 429, { error: '요청이 잠시 몰렸어요. 잠깐 기다린 뒤 다시 시도해 주세요.', code: 'TEMPORARY_RATE_LIMIT' });
  }
  return send(res, status, { error: error.message || fallback, code: code || 'API_ERROR' });
}

function readJson(req, limit = 18_000_000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > limit) { reject(new Error('요청이 너무 커요.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('요청 형식이 올바르지 않아요.')); }
    });
    req.on('error', reject);
  });
}

function getText(data) {
  for (const item of data.output || []) {
    if (item.type === 'message') {
      for (const part of item.content || []) if (part.type === 'output_text') return part.text;
    }
  }
  return '';
}

async function plan(req, res) {
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: '.env 파일에 OPENAI_API_KEY를 설정해 주세요.' });
  try {
    const body = await readJson(req, 100_000);
    const source = String(body.source || '').trim();
    if (source.length < 8) return send(res, 400, { error: '포스터로 만들 내용을 조금 더 적어 주세요.' });
    const selected = body.style && body.style !== 'Auto recommend' ? body.style : 'Auto recommend';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-6-luna',
        instructions: `You are an art director for public-service advertising. Organize the source into concise poster copy and a resource plan for a designer, not a finished layout. Choose exactly one visual direction from this catalog: ${styles.join('; ')}. Recommend one when Auto recommend is selected and explain briefly in Korean. Preserve names, dates, places, prices, URLs, institutions and factual claims exactly; never invent facts or statistics. Write one short, memorable headline and an optional supporting line. Keep details factual and concise. Create a restrained, realistic or tactile background with calm negative space for editable copy. Choose exactly one strong, recognizable focal subject that directly expresses the campaign's central message. Do not provide alternatives or a list, and do not combine unrelated objects or people. The subject must be a single isolated, transparent-background image asset that clearly matches the headline and source brief. Give it a short Korean name, one-line concept, and a detailed image prompt specifying the exact subject and action. Avoid extra objects, scenery, text, lettering, logos and watermarks inside the generated subject image. Keep the selected direction consistent across the background and subject. Do not add national motifs unless requested.`,
        input: `Selected style: ${selected}\nAspect ratio: ${body.ratio || '4:5'}\nPoster language: ${body.language || 'Korean'}\nSource text:\n${source}`,
        text: { format: { type: 'json_schema', name: 'layered_poster_plan', strict: true, schema: {
          type: 'object', properties: {
            title: { type: 'string' }, subtitle: { type: 'string' }, details: { type: 'array', items: { type: 'string' } },
            background_prompt: { type: 'string' },
            subject: { type: 'object', properties: { name: { type: 'string' }, idea: { type: 'string' }, prompt: { type: 'string' } }, required: ['name', 'idea', 'prompt'], additionalProperties: false },
            recommended_style: { type: 'string', enum: styles }, style_reason: { type: 'string' }
          }, required: ['title', 'subtitle', 'details', 'background_prompt', 'subject', 'recommended_style', 'style_reason'], additionalProperties: false
        } } }
      })
    });
    const data = await response.json();
    if (!response.ok) return apiFailure(res, response.status, data, '구성안 생성에 실패했어요.');
    send(res, 200, JSON.parse(getText(data)));
  } catch (error) { send(res, 500, { error: error.message || '구성안 생성 중 오류가 발생했어요.' }); }
}

async function generateLayer(req, res) {
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: '.env 파일에 OPENAI_API_KEY를 설정해 주세요.' });
  try {
    const body = await readJson(req);
    const prompt = String(body.prompt || '').trim();
    const role = body.role === 'subject' ? 'subject' : 'background';
    const size = sizes[body.ratio] || sizes['4:5'];
    if (!prompt) return send(res, 400, { error: '이미지 설명이 비어 있어요.' });
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2.5-flare', prompt, size, quality: 'medium', background: role === 'background' ? 'opaque' : 'transparent', n: 1 })
    });
    const data = await response.json();
    if (!response.ok) return apiFailure(res, response.status, data, `${role === 'subject' ? '상징 피사체' : '배경'} 생성에 실패했어요.`);
    const image = data.data?.[0]?.b64_json;
    if (!image) return send(res, 502, { error: 'API 응답에 이미지가 없어요.' });
    send(res, 200, { image: `data:image/png;base64,${image}` });
  } catch (error) { send(res, 500, { error: error.message || '이미지 생성 중 오류가 발생했어요.' }); }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/plan') return void plan(req, res);
  if (req.method === 'POST' && req.url === '/api/generate-layer') return void generateLayer(req, res);
  const route = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = route === '/' ? '/index.html' : route;
  const publicRoot = path.resolve(root, 'public');
  const vendorRoute = route === '/vendor/ag-psd.js';
  const allowedRoot = vendorRoute ? path.resolve(root, 'node_modules/ag-psd/dist') : publicRoot;
  const file = vendorRoute ? path.resolve(allowedRoot, 'bundle.js') : path.resolve(publicRoot, `.${requested}`);
  if (!file.startsWith(allowedRoot + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Poster Maker is running on port ${process.env.PORT || 3000}`));
