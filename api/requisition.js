// ═══════════════════════════════════════
// API: /api/requisition — Multi-item Request + Bulk Approve + Budget
// ═══════════════════════════════════════
const { getSupabaseAdmin, generateId, toNum } = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { action, data } = req.body || {};
  const adminActions = new Set(['get_users', 'add_user', 'get_budgets', 'set_budget', 'system_stats', 'get_inventory', 'add_inventory', 'add_inventory_batch']);
  const approverActions = new Set(['get_pending', 'approve', 'reject', 'bulk_approve']);
  const roles = adminActions.has(action) ? ['admin'] : approverActions.has(action) ? ['approver', 'admin'] : ['requester', 'approver', 'admin'];
  const auth = await requireAuth(req, res, roles);
  if (!auth) return;
  const supabase = getSupabaseAdmin();

  try {
    switch (action) {
      // ── CREATE (multi-item) ──
      case 'create_request': return await createRequest(supabase, data, res, auth.profile);
      // ── READ ──
      case 'get_my_requests': return await getMyRequests(supabase, res, auth.profile);
      case 'get_pending': return await getPendingRequests(supabase, res);
      // ── APPROVE / REJECT / CANCEL ──
      case 'approve': return await approveRequest(supabase, data, res, auth.profile);
      case 'reject': return await rejectRequest(supabase, data, res, auth.profile);
      case 'cancel': return await cancelRequest(supabase, data, res, auth.profile);
      case 'bulk_approve': return await bulkApprove(supabase, data, res, auth.profile);
      // ── CATEGORIES / ITEMS ──
      case 'get_categories': return await getCategories(supabase, res);
      case 'get_items': return await getItemsByCategory(supabase, data, res);
      // ── USERS ──
      case 'get_users': return await getUsers(supabase, res);
      case 'add_user': return await addUser(supabase, data, res);
      // ── BUDGETS ──
      case 'get_budgets': return await getBudgets(supabase, res);
      case 'set_budget': return await setBudget(supabase, data, res);
      case 'get_department_budget': return await getDeptBudget(supabase, res, auth.profile);
      // ── SYSTEM ──
      case 'system_stats': return await getSystemStats(supabase, res);
      // ── INVENTORY ──
      case 'get_inventory': return await getInventory(supabase, res);
      case 'add_inventory': return await addInventory(supabase, data, res);
      case 'add_inventory_batch': return await addInventoryBatch(supabase, data, res);
      default: return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════
// CREATE REQUEST (multi-item support)
// ═══════════════════════════════════════
async function createRequest(supabase, d, res, profile) {
  const items = d.items || (d.item ? [{ item: d.item, category: d.category, quantity: d.quantity, unitPrice: d.unitPrice }] : []);
  if (items.length === 0) return res.json({ success: false, error: 'กรุณาระบุอย่างน้อย 1 รายการ' });

  const requestId = generateId('REQ');
  let totalPrice = 0;
  const rows = [];

  for (const it of items) {
    if (!it.item) continue;
    const qty = toNum(it.quantity);
    const up = toNum(it.unitPrice);
    const tp = Math.round(qty * up * 100) / 100;
    totalPrice += tp;
    rows.push({
      request_id: requestId,
      requester_email: profile.email,
      requester_name: profile.name || profile.email,
      department: profile.department || 'ไม่ระบุ',
      item: it.item,
      category: it.category || 'ไม่ระบุ',
      quantity: qty,
      unit_price: up,
      total_price: tp,
      reason: it.reason || d.reason || '',
      date_needed: d.dateNeeded || null,
      request_date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      approver_email: d.approverEmail || ''
    });
  }

  const { error } = await supabase.from('requests').insert(rows);
  if (error) throw error;
  return res.json({ success: true, requestId, totalPrice: Math.round(totalPrice * 100) / 100, itemCount: rows.length, message: `สร้างคำขอเบิก ${requestId} (${rows.length} รายการ) เรียบร้อย` });
}

// ═══════════════════════════════════════
// GET MY REQUESTS (grouped by request_id)
// ═══════════════════════════════════════
async function getMyRequests(supabase, res, profile) {
  const email = profile.email;
  const { data, error } = await supabase.from('requests').select('*').eq('requester_email', email).order('created_at', { ascending: false });
  if (error) throw error;
  const grouped = groupRequests(data || []);
  return res.json({ success: true, requests: grouped, count: grouped.length });
}

// ═══════════════════════════════════════
// GET PENDING (grouped by request_id)
// ═══════════════════════════════════════
async function getPendingRequests(supabase, res) {
  const { data, error } = await supabase.from('requests').select('*').eq('status', 'pending').order('created_at', { ascending: true });
  if (error) throw error;
  const grouped = groupRequests(data || []);
  return res.json({ success: true, requests: grouped, count: grouped.length });
}

// ═══════════════════════════════════════
// APPROVE (single request_id → multiple transactions)
// ═══════════════════════════════════════
async function approveRequest(supabase, d, res, profile) {
  const { requestId, approverComment } = d || {};
  const approverEmail = profile.email;
  if (!requestId) return res.json({ success: false, error: 'กรุณาระบุ Request ID' });

  const { data: items, error: findErr } = await supabase.from('requests').select('*').eq('request_id', requestId);
  if (findErr || !items || items.length === 0) return res.json({ success: false, error: 'ไม่พบคำขอ' });
  if (items[0].status !== 'pending') return res.json({ success: false, error: 'คำขอนี้ถูกดำเนินการแล้ว' });

  const now = new Date().toISOString().slice(0, 10);
  const transRows = items.map(it => ({
    transaction_id: generateId('TRN'),
    request_id: requestId,
    date: it.request_date || now,
    item: it.item,
    category: it.category || 'ไม่ระบุ',
    department: it.department || 'ไม่ระบุ',
    quantity: toNum(it.quantity),
    unit_price: toNum(it.unit_price),
    total_price: toNum(it.total_price),
    requester_name: it.requester_name,
    approved_by: approverEmail || '',
    approval_date: now
  }));

  await supabase.from('requests').update({ status: 'approved', approver_email: approverEmail || '', approver_comment: approverComment || 'อนุมัติ', approval_date: now }).eq('request_id', requestId);
  await supabase.from('transactions').insert(transRows);
  await recalcBudgetForDept(supabase, items[0].department);

  const totalPrice = Math.round(items.reduce((s, it) => s + toNum(it.total_price), 0) * 100) / 100;
  return res.json({ success: true, message: `อนุมัติคำขอ ${requestId} (${items.length} รายการ) เรียบร้อย`, requesterEmail: items[0].requester_email, totalPrice });
}

// ═══════════════════════════════════════
// BULK APPROVE
// ═══════════════════════════════════════
async function bulkApprove(supabase, d, res, profile) {
  const { requestIds } = d || {};
  const approverEmail = profile.email;
  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) return res.json({ success: false, error: 'กรุณาระบุ Request IDs' });

  let totalItems = 0;
  for (const id of requestIds) {
    const { data: items } = await supabase.from('requests').select('*').eq('request_id', id);
    if (!items || items.length === 0 || items[0].status !== 'pending') continue;
    const now = new Date().toISOString().slice(0, 10);
    const transRows = items.map(it => ({
      transaction_id: generateId('TRN'), request_id: id,
      date: it.request_date || now, item: it.item, category: it.category || 'ไม่ระบุ',
      department: it.department || 'ไม่ระบุ', quantity: toNum(it.quantity),
      unit_price: toNum(it.unit_price), total_price: toNum(it.total_price),
      requester_name: it.requester_name, approved_by: approverEmail || '', approval_date: now
    }));
    await supabase.from('requests').update({ status: 'approved', approver_email: approverEmail || '', approval_date: now }).eq('request_id', id);
    await supabase.from('transactions').insert(transRows);
    await recalcBudgetForDept(supabase, items[0].department);
    totalItems += items.length;
  }
  return res.json({ success: true, message: `อนุมัติ ${requestIds.length} คำขอ (${totalItems} รายการ) เรียบร้อย` });
}

// ═══════════════════════════════════════
// REJECT / CANCEL (affects all rows of a request_id)
// ═══════════════════════════════════════
async function rejectRequest(supabase, d, res, profile) {
  const { requestId, comment } = d || {};
  if (!requestId) return res.json({ success: false, error: 'กรุณาระบุ Request ID' });
  await supabase.from('requests').update({ status: 'rejected', approver_email: profile.email, approver_comment: comment || 'ปฏิเสธ', approval_date: new Date().toISOString().slice(0, 10) }).eq('request_id', requestId);
  return res.json({ success: true, message: `ปฏิเสธคำขอ ${requestId} เรียบร้อย` });
}
async function cancelRequest(supabase, d, res, profile) {
  const { requestId } = d || {};
  if (!requestId) return res.json({ success: false, error: 'กรุณาระบุ Request ID' });
  const { data: rows, error: findError } = await supabase.from('requests').select('requester_email,status').eq('request_id', requestId);
  if (findError || !rows || rows.length === 0) return res.json({ success: false, error: 'ไม่พบคำขอ' });
  if (!['admin', 'approver'].includes(profile.role) && rows.some(row => row.requester_email !== profile.email)) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  if (rows.some(row => row.status !== 'pending')) return res.json({ success: false, error: 'คำขอนี้ดำเนินการแล้ว' });
  const { error } = await supabase.from('requests').update({ status: 'cancelled' }).eq('request_id', requestId);
  if (error) throw error;
  return res.json({ success: true, message: `ยกเลิกคำขอ ${requestId} เรียบร้อย` });
}

// ═══════════════════════════════════════
// BUDGET: Auto-recalculate after approval
// ═══════════════════════════════════════
async function recalcBudgetForDept(supabase, department) {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { data: trans } = await supabase.from('transactions').select('total_price').eq('department', department).gte('date', `${currentMonth}-01`).lte('date', `${currentMonth}-31`);
    const totalUsed = (trans || []).reduce((s, t) => s + toNum(t.total_price), 0);
    const { data: budgets } = await supabase.from('budgets').select('*').eq('department', department).eq('month', currentMonth);
    if (budgets && budgets.length > 0) {
      const limit = toNum(budgets[0].budget_limit);
      const usagePercent = limit > 0 ? Math.round((totalUsed / limit) * 10000) / 100 : 0;
      await supabase.from('budgets').update({ current_usage: totalUsed, usage_percent: usagePercent }).eq('department', department).eq('month', currentMonth);
    }
  } catch(e) { /* silent */ }
}
async function getDeptBudget(supabase, res, profile) {
  const dept = profile.department || '';
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data } = await supabase.from('budgets').select('*').eq('department', dept).eq('month', currentMonth);
  if (data && data.length > 0) return res.json({ success: true, budget: { limit: toNum(data[0].budget_limit), used: toNum(data[0].current_usage), remaining: toNum(data[0].budget_limit) - toNum(data[0].current_usage), percent: toNum(data[0].usage_percent) } });
  return res.json({ success: true, budget: null });
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function groupRequests(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.request_id;
    if (!map[key]) map[key] = { request_id: key, requester_name: r.requester_name, requester_email: r.requester_email, department: r.department, request_date: r.request_date, status: r.status, reason: r.reason, approver_comment: r.approver_comment, approval_date: r.approval_date, date_needed: r.date_needed, items: [], total_price: 0 };
    map[key].items.push({ item: r.item, category: r.category, quantity: toNum(r.quantity), unit_price: toNum(r.unit_price), total_price: toNum(r.total_price) });
    map[key].total_price += toNum(r.total_price);
  }
  return Object.values(map).sort((a, b) => (b.request_date || '').localeCompare(a.request_date || ''));
}

// ── Categories, Items, Users, Budgets, Inventory (same as before) ──
async function getCategories(supabase, res) {
  const STATIC = ['เครื่องเขียน','กระดาษ','หมึกพิมพ์','อุปกรณ์สำนักงาน','อุปกรณ์ทำความสะอาด','ซอฟต์แวร์/ไลเซนส์','เฟอร์นิเจอร์','อื่นๆ'];
  const { data } = await supabase.from('transactions').select('category');
  const dyn = [...new Set((data||[]).map(r=>r.category).filter(Boolean))];
  return res.json({success:true, categories:[...new Set([...dyn,...STATIC])]});
}
async function getItemsByCategory(supabase, d, res) {
  const cat = d?.category || '';
  const { data } = await supabase.from('transactions').select('item').eq('category', cat);
  const dyn = [...new Set((data||[]).map(r=>r.item).filter(Boolean))];
  return res.json({success:true, items:dyn.length>0?dyn:['โปรดระบุ']});
}
async function getUsers(supabase, res) { const { data, error } = await supabase.from('users').select('*'); if(error)throw error; return res.json({success:true,users:data||[],count:(data||[]).length}); }
async function addUser(supabase, d, res) { const { error } = await supabase.from('users').insert({email:d.email,name:d.name,role:d.role||'requester',department:d.department||''}); if(error)return res.json({success:false,error:error.message}); return res.json({success:true,message:'เพิ่มผู้ใช้เรียบร้อย'}); }
async function getBudgets(supabase, res) { const { data, error } = await supabase.from('budgets').select('*').order('month',{ascending:false}); if(error)throw error; return res.json({success:true,budgets:data||[]}); }
async function setBudget(supabase, d, res) { const { error } = await supabase.from('budgets').upsert({department:d.department,month:d.month,budget_limit:toNum(d.budgetLimit),current_usage:0,usage_percent:0},{onConflict:'department,month'}); if(error)return res.json({success:false,error:error.message}); return res.json({success:true,message:'ตั้งงบประมาณเรียบร้อย'}); }
async function getSystemStats(supabase, res) {
  const [{count:users},{count:pending},{count:approved},{count:trans}] = await Promise.all([
    supabase.from('users').select('*',{count:'exact',head:true}),
    supabase.from('requests').select('*',{count:'exact',head:true}).eq('status','pending'),
    supabase.from('requests').select('*',{count:'exact',head:true}).eq('status','approved'),
    supabase.from('transactions').select('*',{count:'exact',head:true})
  ]);
  return res.json({success:true,stats:{totalUsers:users,pendingRequests:pending,approvedRequests:approved,totalTransactions:trans}});
}
// ── INVENTORY ──
async function getInventory(supabase, res) { const { data, error } = await supabase.from('inventory').select('*').order('created_at',{ascending:false}); if(error)throw error; return res.json({success:true,items:data||[],count:(data||[]).length}); }
async function addInventory(supabase, d, res) { const id = generateId('INV'); const { error } = await supabase.from('inventory').insert({item_id:id,item:d.item,category:d.category||'',stock_qty:toNum(d.stockQty),min_stock:toNum(d.minStock),unit_price:toNum(d.unitPrice),unit:d.unit||'ชิ้น',supplier:d.supplier||''}); if(error)return res.json({success:false,error:error.message}); return res.json({success:true,message:'เพิ่มสินค้าเรียบร้อย'}); }
async function addInventoryBatch(supabase, d, res) {
  const items = d.items || [];
  if (items.length === 0) return res.json({success:false,error:'ไม่มีรายการ'});
  const rows = items.map(it => ({item_id:generateId('INV'),item:it.item,category:it.category||'',stock_qty:toNum(it.stockQty),min_stock:toNum(it.minStock),unit_price:toNum(it.unitPrice),unit:it.unit||'ชิ้น',supplier:it.supplier||''}));
  const { error } = await supabase.from('inventory').insert(rows);
  if (error) return res.json({success:false,error:error.message});
  return res.json({success:true,message:`เพิ่ม ${rows.length} รายการเรียบร้อย`,count:rows.length});
}
