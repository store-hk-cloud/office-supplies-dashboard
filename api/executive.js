// ═══════════════════════════════════════
// API: /api/executive — Executive KPI Dashboard
// ═══════════════════════════════════════
const { getSupabaseAdmin, toNum } = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const supabase = getSupabaseAdmin();
  const { action, year } = req.body || {};
  const targetYear = year || new Date().getFullYear();

  try {
    switch (action) {
      case 'kpi': return await getExecutiveKPI(supabase, targetYear, res);
      case 'trends': return await getMonthlyTrends(supabase, targetYear, res);
      case 'heatmap': return await getHeatmap(supabase, targetYear, res);
      case 'top_items': return await getTopItems(supabase, targetYear, res);
      case 'yoy': return await getYoYComparison(supabase, targetYear, res);
      case 'alerts': return await getAlerts(supabase, res);
      default: return await getExecutiveKPI(supabase, targetYear, res);
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function getExecutiveKPI(supabase, year, res) {
  const { data, error } = await supabase.from('transactions').select('*')
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  if (error) throw error;

  let totalValue = 0;
  const depts = {}, cats = {};

  (data || []).forEach(r => {
    const p = toNum(r.total_price);
    totalValue += p;
    const d = r.department || 'ไม่ระบุ';
    const c = r.category || 'ไม่ระบุ';
    depts[d] = (depts[d] || 0) + p;
    cats[c] = (cats[c] || 0) + p;
  });

  const topDept = Object.entries(depts).sort((a, b) => b[1] - a[1])[0];
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];

  // Budget summary
  const currentMonth = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const { data: budgets } = await supabase.from('budgets').select('*').eq('month', currentMonth);
  const budgetTotal = (budgets || []).reduce((s, b) => s + toNum(b.budget_limit), 0);
  const budgetUsed = (budgets || []).reduce((s, b) => s + toNum(b.current_usage), 0);

  return res.json({
    success: true,
    kpi: {
      totalValue: Math.round(totalValue * 100) / 100,
      totalItems: (data || []).length,
      totalDepartments: Object.keys(depts).length,
      totalCategories: Object.keys(cats).length,
      topDepartment: topDept ? { name: topDept[0], value: topDept[1] } : { name: '-', value: 0 },
      topCategory: topCat ? { name: topCat[0], value: topCat[1] } : { name: '-', value: 0 },
      avgPerItem: (data || []).length > 0 ? Math.round((totalValue / data.length) * 100) / 100 : 0,
      budgetTotal, budgetUsed,
      budgetRemaining: budgetTotal - budgetUsed,
      budgetUsagePercent: budgetTotal > 0 ? Math.round((budgetUsed / budgetTotal) * 10000) / 100 : 0
    }
  });
}

async function getMonthlyTrends(supabase, year, res) {
  const { data, error } = await supabase.from('transactions').select('*')
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  if (error) throw error;

  const months = Array(12).fill(0);
  (data || []).forEach(r => {
    const m = new Date(r.date).getMonth();
    months[m] += toNum(r.total_price);
  });

  return res.json({ success: true, year, months: months.map((v, i) => ({ month: i + 1, value: Math.round(v * 100) / 100 })) });
}

async function getHeatmap(supabase, year, res) {
  const { data, error } = await supabase.from('transactions').select('*')
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  if (error) throw error;

  const matrix = {};
  (data || []).forEach(r => {
    const d = r.department || 'ไม่ระบุ';
    const c = r.category || 'ไม่ระบุ';
    const key = `${d}|||${c}`;
    matrix[key] = (matrix[key] || 0) + toNum(r.total_price);
  });

  const depts = [...new Set((data || []).map(r => r.department || 'ไม่ระบุ'))];
  const cats = [...new Set((data || []).map(r => r.category || 'ไม่ระบุ'))];

  return res.json({ success: true, departments: depts, categories: cats, matrix });
}

async function getTopItems(supabase, year, res) {
  const { data, error } = await supabase.from('transactions').select('*')
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  if (error) throw error;

  const items = {};
  (data || []).forEach(r => {
    const key = r.item || 'ไม่ระบุ';
    if (!items[key]) items[key] = { name: key, quantity: 0, value: 0 };
    items[key].quantity += toNum(r.quantity);
    items[key].value += toNum(r.total_price);
  });

  const top10 = Object.values(items).sort((a, b) => b.value - a.value).slice(0, 10);
  return res.json({ success: true, topItems: top10 });
}

async function getYoYComparison(supabase, year, res) {
  const [curData, prevData] = await Promise.all([
    supabase.from('transactions').select('*').gte('date', `${year}-01-01`).lte('date', `${year}-12-31`),
    supabase.from('transactions').select('*').gte('date', `${year - 1}-01-01`).lte('date', `${year - 1}-12-31`)
  ]);

  const curTotal = (curData.data || []).reduce((s, r) => s + toNum(r.total_price), 0);
  const prevTotal = (prevData.data || []).reduce((s, r) => s + toNum(r.total_price), 0);
  const growth = prevTotal > 0 ? Math.round(((curTotal - prevTotal) / prevTotal) * 10000) / 100 : 0;

  return res.json({
    success: true,
    currentYear: { year, total: curTotal, items: (curData.data || []).length },
    previousYear: { year: year - 1, total: prevTotal, items: (prevData.data || []).length },
    growthPercent: growth
  });
}

async function getAlerts(supabase, res) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [budgets, lowStock, pendingOld] = await Promise.all([
    supabase.from('budgets').select('*').eq('month', currentMonth),
    supabase.from('inventory').select('stock_qty,min_stock'),
    supabase.from('requests').select('*').eq('status', 'pending').lte('created_at', new Date(now - 3 * 86400000).toISOString())
  ]);

  const alerts = [];

  (budgets.data || []).forEach(b => {
    if (toNum(b.usage_percent) >= 100) alerts.push({ type: 'budget_critical', department: b.department, percent: toNum(b.usage_percent), message: `งบประมาณ ${b.department} ใช้เต็ม 100%` });
    else if (toNum(b.usage_percent) >= 80) alerts.push({ type: 'budget_warning', department: b.department, percent: toNum(b.usage_percent), message: `งบประมาณ ${b.department} ใช้ไป ${toNum(b.usage_percent)}%` });
  });

  const lowStockItems = (lowStock.data || []).filter(item => toNum(item.stock_qty) <= toNum(item.min_stock || 5));
  if (lowStockItems.length > 0) {
    alerts.push({ type: 'low_stock', count: lowStockItems.length, message: `มี ${lowStockItems.length} รายการที่สต็อกต่ำ` });
  }

  if ((pendingOld.data || []).length > 0) {
    alerts.push({ type: 'pending_old', count: pendingOld.data.length, message: `มี ${pendingOld.data.length} คำขอค้างนานเกิน 3 วัน` });
  }

  return res.json({ success: true, alerts, count: alerts.length });
}
