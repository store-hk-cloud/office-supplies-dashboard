// ═══════════════════════════════════════
// API: /api/auth — Authentication (Supabase)
// ═══════════════════════════════════════
const { getSupabase, getSupabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { action, email, password, name, department } = req.body || {};

  try {
    switch (action) {
      case 'login': {
        const supabase = getSupabase();
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (loginErr) return res.json({ success: false, error: loginErr.message });
        const admin = getSupabaseAdmin();
        const { data: userData } = await admin.from('users').select('*').eq('email', email).single();
        return res.json({ success: true, user: userData || null, session: loginData.session });
      }

      case 'register': {
        const supabase = getSupabase();
        const admin = getSupabaseAdmin();
        const { error: signUpErr } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { name: name || email }
        });
        if (signUpErr) {
          // Try regular signUp if admin.createUser fails (may need service_role)
          const { error: signUp2Err } = await supabase.auth.signUp({ email, password });
          if (signUp2Err) return res.json({ success: false, error: signUp2Err.message });
          const { error: profileError } = await admin.from('users').insert({ email, name: name || email, role: 'requester', department: department || 'ไม่ระบุ' });
          if (profileError) return res.json({ success: false, error: profileError.message });
          return res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ! เข้าสู่ระบบได้ทันที' });
        }
        const { error: profileError } = await admin.from('users').insert({ email, name: name || email, role: 'requester', department: department || 'ไม่ระบุ' });
        if (profileError) return res.json({ success: false, error: profileError.message });
        return res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ! เข้าสู่ระบบได้ทันที' });
      }

      case 'logout':
        return res.json({ success: true });

      case 'me': {
        const auth = await requireAuth(req, res);
        if (!auth) return;
        return res.json({ success: true, user: auth.profile });
      }

      default:
        return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
