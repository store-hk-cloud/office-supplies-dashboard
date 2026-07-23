const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');

test('production page does not load the Tailwind CDN compiler', () => {
  assert.equal(html.includes('https://cdn.tailwindcss.com'), false);
});

test('startup does not run a direct Supabase REST DNS preflight', () => {
  assert.equal(html.includes("fetch(SUPABASE_URL+'/rest/v1/'"), false);
});

test('browser authentication uses the same-origin API instead of Supabase Auth directly', () => {
  assert.equal(html.includes('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'), false);
  assert.match(html, /postApi\('\/api\/auth'/);
});
