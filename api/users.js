// ═══════════════════════════════════════
// API: /api/users — User Management (Admin)
// ═══════════════════════════════════════
const { getSupabaseAdmin } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
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
        const { data: userData } = await supabase.from('users').select('id').eq('email', email).single();
        if (!userData) return res.json({ success: false, error: 'ไม่พบผู้ใช้' });
        const newPassword = Math.random().toString(36).slice(-8);
        const { error } = await supabase.auth.admin.updateUserById(userData.id, { password: newPassword });
        if (error) return res.json({ success: false, error: error.message });
        return res.json({ success: true, newPassword, message: `รีเซ็ตรหัสผ่านเป็น: ${newPassword}` });
      }
      default:
        return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};