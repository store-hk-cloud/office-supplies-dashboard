// ═══════════════════════════════════════
// API: /api/auth — Authentication (Supabase)
// ═══════════════════════════════════════
const { getSupabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const supabase = getSupabase();
  const { action, email, password, name, department } = req.body || {};

  try {
    switch (action) {
      case 'login':
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (loginErr) return res.json({ success: false, error: loginErr.message });
        // Get user profile
        const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
        return res.json({ success: true, user: userData, session: loginData.session });

      case 'register':
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) return res.json({ success: false, error: signUpErr.message });
        // Create user profile
        await supabase.from('users').insert({
          email, name: name || email, role: 'requester', department: department || 'ไม่ระบุ'
        });
        return res.json({ success: true, message: 'ลงทะเบียนสำเร็จ — กรุณายืนยันอีเมล' });

      case 'logout':
        await supabase.auth.signOut();
        return res.json({ success: true });

      case 'me':
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return res.json({ success: false, error: 'Not authenticated' });
        const { data: profile } = await supabase.from('users').select('*').eq('email', user.email).single();
        return res.json({ success: true, user: profile });

      default:
        return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};