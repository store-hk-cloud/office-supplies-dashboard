// ═══════════════════════════════════════
// API: /api/requisition — Requisition + Approval
// ═══════════════════════════════════════
const { getSupabase, generateId, toNum } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const supabase = getSupabase();
  const { action, data } = req.body || {};

  try {
    switch (action) {
      case 'create_request': return await createRequest(supabase, data, res);
      case 'get_my_requests': return await getMyRequests(supabase, data, res);
      case 'get_pending': return await getPendingRequests(supabase, res);
      case 'approve': return await approveRequest(supabase, data, res);
      case 'reject': return await rejectRequest(supabase, data, res);
      case 'cancel': return await cancelRequest(supabase, data, res);
      case 'get_categories': return await getCategories(supabase, res);
      case 'get_items': return await getItemsByCategory(supabase, data, res);
      case 'get_users': return await getUsers(supabase, res);
      case 'add_user': return await addUser(supabase, data, res);
      case 'get_budgets': return await getBudgets(supabase, res);
      case 'set_budget': return await setBudget(supabase, data, res);
      case 'system_stats': return await getSystemStats(supabase, res);
      default: return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function createRequest(supabase, d, res) {
  if (!d.item) return res.json({ success: false, error: 'กรุณาระบุรายการ' });
  if (!d.quantity || d.quantity <= 0) return res.json({ success: false, error: 'กรุณาระบุจำนวน' });

  const requestId = generateId('REQ');
  const totalPrice = toNum(d.quantity) * toNum(d.unitPrice);

  const { error } = await supabase.from('requests').insert({
    request_id: requestId,
    requester_email: d.requesterEmail || 'anonymous@hillkoff.com',
    requester_name: d.requesterName || 'ผู้ใช้ทั่วไป',
    department: d.department || 'ไม่ระบุ',
    item: d.item,
    category: d.category || 'ไม่ระบุ',
    quantity: toNum(d.quantity),
    unit_price: toNum(d.unitPrice),
    total_price: totalPrice,
    reason: d.reason || '',
    date_needed: d.dateNeeded || null,
    status: 'pending',
    approver_email: d.approverEmail || ''
  });

  if (error) throw error;
  return res.json({ success: true, requestId, totalPrice, message: `สร้างคำขอเบิกเรียบร้อย: ${requestId}` });
}

async function getMyRequests(supabase, d, res) {
  const email = d?.requesterEmail || 'anonymous@hillkoff.com';
  const { data, error } = await supabase.from('requests').select('*').eq('requester_email', email).order('created_at', { ascending: false });
  if (error) throw error;
  return res.json({ success: true, requests: data || [], count: (data || []).length });
}

async function getPendingRequests(supabase, res) {
  const { data, error } = await supabase.from('requests').select('*').eq('status', 'pending').order('created_at', { ascending: true });
  if (error) throw error;
  return res.json({ success: true, requests: data || [], count: (data || []).length });
}

async function approveRequest(supabase, d, res) {
  const { requestId, approverEmail, approverComment } = d || {};
  if (!requestId) return res.json({ success: false, error: 'กรุณาระบุ Request ID' });

  const { data: reqs, error: findErr } = await supabase.from('requests').select('*').eq('request_id', requestId).single();
  if (findErr || !reqs) return res.json({ success: false, error: 'ไม่พบคำขอ' });
  if (reqs.status !== 'pending') return res.json({ success: false, error: 'คำขอนี้ถูกดำเนินการแล้ว' });

  const now = new Date().toISOString().slice(0, 10);

  // Update request status
  await supabase.from('requests').update({
    status: 'approved',
    approver_email: approverEmail || '',
    approver_comment: approverComment || 'อนุมัติ',
    approval_date: now
  }).eq('request_id', requestId);

  // Save to transactions
  await supabase.from('transactions').insert({
    transaction_id: generateId('TRN'),
    request_id: requestId,
    date: reqs.request_date || now,
    item: reqs.item,
    category: reqs.category,
    department: reqs.department,
    quantity: toNum(reqs.quantity),
    unit_price: toNum(reqs.unit_price),
    total_price: toNum(reqs.total_price),
    requester_name: reqs.requester_name,
    approved_by: approverEmail || '',
    approval_date: now
  });

  return res.json({ success: true, message: `อนุมัติคำขอ ${requestId} เรียบร้อย` });
}

async function rejectRequest(supabase, d, res) {
  const { requestId, comment } = d || {};
  if (!requestId) return res.json({ success: false, error: 'กรุณาระบุ Request ID' });

  await supabase.from('requests').update({
    status: 'rejected',
    approver_comment: comment || 'ปฏิเสธ',
    approval_date: new Date().toISOString().slice(0, 10)
  }).eq('request_id', requestId);

  return res.json({ success: true, message: `ปฏิเสธคำขอ ${requestId} เรียบร้อย` });
}

async function cancelRequest(supabase, d, res) {
  const { requestId } = d || {};
  if (!requestId) return res.json({ success: false, error: 'กรุณาระบุ Request ID' });

  await supabase.from('requests').update({ status: 'cancelled' }).eq('request_id', requestId);
  return res.json({ success: true, message: `ยกเลิกคำขอ ${requestId} เรียบร้อย` });
}

async function getCategories(supabase, res) {
  const STATIC = ['เครื่องเขียน', 'กระดาษ', 'หมึกพิมพ์', 'อุปกรณ์สำนักงาน', 'อุปกรณ์ทำความสะอาด', 'ซอฟต์แวร์/ไลเซนส์', 'เฟอร์นิเจอร์', 'อื่นๆ'];
  const { data } = await supabase.from('transactions').select('category');
  const dynCats = [...new Set((data || []).map(r => r.category).filter(Boolean))];
  const all = [...new Set([...dynCats, ...STATIC])];
  return res.json({ success: true, categories: all });
}

async function getItemsByCategory(supabase, d, res) {
  const cat = d?.category || '';
  const STATIC = { 'เครื่องเขียน': ['ปากกา', 'ดินสอ'], 'กระดาษ': ['A4', 'A3'], 'อื่นๆ': ['อื่นๆ (ระบุ)'] };
  const { data } = await supabase.from('transactions').select('item').eq('category', cat);
  const dynItems = [...new Set((data || []).map(r => r.item).filter(Boolean))];
  const staticItems = STATIC[cat] || ['โปรดระบุ'];
  const all = [...new Set([...dynItems, ...staticItems])];
  return res.json({ success: true, items: all.length > 0 ? all : ['โปรดระบุ'] });
}

async function getUsers(supabase, res) {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return res.json({ success: true, users: data || [], count: (data || []).length });
}

async function addUser(supabase, d, res) {
  const { error } = await supabase.from('users').insert({
    email: d.email, name: d.name, role: d.role || 'requester', department: d.department || ''
  });
  if (error) return res.json({ success: false, error: error.message });
  return res.json({ success: true, message: 'เพิ่มผู้ใช้เรียบร้อย' });
}

async function getBudgets(supabase, res) {
  const { data, error } = await supabase.from('budgets').select('*').order('month', { ascending: false });
  if (error) throw error;
  return res.json({ success: true, budgets: data || [] });
}

async function setBudget(supabase, d, res) {
  const { error } = await supabase.from('budgets').upsert({
    department: d.department,
    month: d.month,
    budget_limit: toNum(d.budgetLimit),
    current_usage: 0,
    usage_percent: 0
  }, { onConflict: 'department,month' });
  if (error) return res.json({ success: false, error: error.message });
  return res.json({ success: true, message: 'ตั้งงบประมาณเรียบร้อย' });
}

async function getSystemStats(supabase, res) {
  const [{ count: users }, { count: pending }, { count: approved }, { count: trans }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('transactions').select('*', { count: 'exact', head: true })
  ]);
  return res.json({ success: true, stats: { totalUsers: users, pendingRequests: pending, approvedRequests: approved, totalTransactions: trans } });
}