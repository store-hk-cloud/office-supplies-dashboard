// ═══════════════════════════════════════
// API: /api/users — User Management (Admin)
// ═══════════════════════════════════════
const { getSupabase, getSupabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const auth = await requireAuth(req, res, ['admin']);
  if (!auth) return;
  const supabase = getSupabaseAdmin();
  const { action, email, name, role, department, updates } = req.body || {};

  try {
    switch (action) {
      case 'list': {
        const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ success: true, users: data || [], count: (data || []).length });
      }
      case 'update': {
        if (!email) return res.json({ success: false, error: 'กรุณาระบุ email' });
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (role !== undefined) updateData.role = role;
        if (department !== undefined) updateData.department = department;
        const { error } = await supabase.from('users').update(updateData).eq('email', email);
        if (error) throw error;
        return res.json({ success: true, message: 'อัปเดตผู้ใช้เรียบร้อย' });
      }
      case 'delete': {
        if (!email) return res.json({ success: false, error: 'กรุณาระบุ email' });
        // Delete from public.users only (auth.users stays for login)
        const { error } = await supabase.from('users').delete().eq('email', email);
        if (error) throw error;
        return res.json({ success: true, message: 'ลบผู้ใช้เรียบร้อย' });
      }
      case 'add': {
        if (!email) return res.json({ success: false, error: 'กรุณาระบุ email' });
        const { error } = await supabase.from('users').upsert({ email, name: name || email, role: role || 'requester', department: department || 'ไม่ระบุ', is_active: true }, { onConflict: 'email' });
        if (error) throw error;
        return res.json({ success: true, message: 'เพิ่มผู้ใช้เรียบร้อย' });
      }
      case 'reset_password': {
        if (!email) return res.json({ success: false, error: 'กรุณาระบุ email' });
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: process.env.APP_URL || 'https://office-supplies-dashboard.vercel.app'
        });
        if (error) return res.json({ success: false, error: error.message });
        return res.json({ success: true, message: 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว' });
      }
      default:
        return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
