const test = require('node:test');
const assert = require('node:assert/strict');

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return payload; }
  };
}

test('admin client refuses to run without a service role key', () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { getSupabaseAdmin } = require('../lib/supabase');

  assert.throws(() => getSupabaseAdmin(), /SUPABASE_SERVICE_ROLE_KEY/);

  if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
});

test('protected requests reject missing bearer tokens', async () => {
  const { requireAuth } = require('../lib/auth');
  const res = responseDouble();

  const result = await requireAuth({ headers: {} }, res, ['admin'], {
    supabase: {},
    admin: {}
  });

  assert.equal(result, null);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Authentication required');
});

test('protected requests verify the token and enforce roles', async () => {
  const { requireAuth } = require('../lib/auth');
  const res = responseDouble();
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { email: 'user@example.com' } }, error: null }) }
  };
  const admin = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        single: async () => ({ data: { email: 'user@example.com', role: 'requester', is_active: true }, error: null })
      };
    }
  };

  const result = await requireAuth({ headers: { authorization: 'Bearer test-token' } }, res, ['admin'], { supabase, admin });

  assert.equal(result, null);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'Insufficient permissions');
});

test('user management endpoint rejects unauthenticated requests before accessing admin data', async () => {
  const handler = require('../api/users');
  const res = responseDouble();

  await handler({ method: 'POST', headers: {}, body: { action: 'list' } }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Authentication required');
});

test('all data-changing and reporting endpoints require authentication', async () => {
  const endpoints = [
    ['../api/dashboard', { action: 'summary' }],
    ['../api/executive', { action: 'kpi' }],
    ['../api/import', { action: 'preview' }],
    ['../api/inventory', { action: 'get_inventory' }],
    ['../api/requisition', { action: 'get_my_requests' }],
    ['../api/notifications', { action: 'get_templates' }]
  ];

  for (const [modulePath, body] of endpoints) {
    const handler = require(modulePath);
    const res = responseDouble();
    await handler({ method: 'POST', headers: {}, body }, res);
    assert.equal(res.statusCode, 401, modulePath);
    assert.equal(res.body.error, 'Authentication required', modulePath);
  }
});
