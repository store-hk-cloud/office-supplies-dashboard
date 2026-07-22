// ═══════════════════════════════════════
// API: /api/auth — Authentication (Supabase)
// ═══════════════════════════════════════
const { getSupabaseAdmin } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const supabase = getSupabaseAdmin();
  const { action, email, password, name, department } = req.body || {};

  try {
    switch (action) {
      case 'login':
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (loginErr) return res.json({ success: false, error: loginErr.message });
        const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
        return res.json({ success: true, user: userData || { email, name: email, role: 'requester', department: 'ไม่ระบุ' } });

      case 'register':
        const { data: signUpData, error: signUpErr } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { name: name || email }
        });
        if (signUpErr) {
          // Try regular signUp if admin.createUser fails (may need service_role)
          const { data: signUp2, error: signUp2Err } = await supabase.auth.signUp({ email, password });
          if (signUp2Err) return res.json({ success: false, error: signUp2Err.message });
          await supabase.from('users').insert({ email, name: name || email, role: 'requester', department: department || 'ไม่ระบุ' });
          return res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ! เข้าสู่ระบบได้ทันที' });
        }
        await supabase.from('users').insert({ email, name: name || email, role: 'requester', department: department || 'ไม่ระบุ' });
        return res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ! เข้าสู่ระบบได้ทันที' });

      case 'logout':
        return res.json({ success: true });

      case 'me':
        return res.json({ success: true, user: req.body?.user || null });

      default:
        return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};