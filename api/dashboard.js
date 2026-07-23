// ═══════════════════════════════════════
// API: /api/dashboard — Dashboard data
// ═══════════════════════════════════════
const { getSupabaseAdmin, toNum } = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const supabase = getSupabaseAdmin();
  const action = req.query?.action || req.body?.action;

  try {
    switch (action) {
      case 'summary': return await getDashboardSummary(supabase, res);
      case 'monthly_comparison': return await getMonthlyComparison(supabase, res);
      case 'budget_gauges': return await getBudgetGauges(supabase, res);
      case 'search': return await searchTransactions(supabase, req.body, res);
      default: return await getDashboardSummary(supabase, res);
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function getDashboardSummary(supabase, res) {
  const { data, error } = await supabase.from('transactions').select('*');
  if (error) throw error;

  const summary = calcSummary(data || []);
  return res.json({ success: true, data: data || [], summary, totalParsedRows: (data || []).length });
}

async function getMonthlyComparison(supabase, res) {
  const year = new Date().getFullYear();
  const { data, error } = await supabase.from('transactions')
    .select('*')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);

  if (error) throw error;

  const months = {};
  const categories = {};

  (data || []).forEach(r => {
    const m = (r.date || '').slice(0, 7);
    const cat = r.category || 'ไม่ระบุ';
    months[m] = true;
    if (!categories[cat]) categories[cat] = { name: cat, months: {}, total: 0 };
    categories[cat].months[m] = (categories[cat].months[m] || 0) + toNum(r.total_price);
    categories[cat].total += toNum(r.total_price);
  });

  const monthList = Object.keys(months).sort();
  const catArr = Object.values(categories).sort((a, b) => b.total - a.total);
  const monthTotals = {};
  monthList.forEach(m => {
    monthTotals[m] = catArr.reduce((s, c) => s + (c.months[m] || 0), 0);
  });

  return res.json({ success: true, year, months: monthList, categories: catArr, monthTotals });
}

async function getBudgetGauges(supabase, res) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data, error } = await supabase.from('budgets')
    .select('*')
    .eq('month', currentMonth);

  if (error) throw error;

  const gauges = (data || []).map(b => ({
    department: b.department,
    budgetLimit: toNum(b.budget_limit),
    currentUsage: toNum(b.current_usage),
    remaining: toNum(b.budget_limit) - toNum(b.current_usage),
    usagePercent: toNum(b.usage_percent),
    level: toNum(b.usage_percent) >= 100 ? 'critical' : toNum(b.usage_percent) >= 80 ? 'warning' : 'safe'
  }));

  return res.json({ success: true, gauges });
}

async function searchTransactions(supabase, body, res) {
  const { query } = body || {};
  if (!query) return res.json({ success: true, data: [] });
  const safeQuery = String(query).replace(/[^a-zA-Z0-9ก-๙ _.-]/g, ' ');

  const { data, error } = await supabase.from('transactions')
    .select('*')
    .or(`item.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%,department.ilike.%${safeQuery}%`);

  if (error) throw error;
  return res.json({ success: true, data: data || [] });
}

function calcSummary(data) {
  if (!data || data.length === 0) return {
    totalValue: 0, totalItems: 0, totalCategories: 0, totalDepartments: 0,
    topItem: { name: '-', quantity: 0 },
    topDepartment: { name: '-', value: 0 },
    topCategory: { name: '-', value: 0 },
    categoryBreakdown: [], departmentBreakdown: [], monthlyTrend: []
  };

  let totalValue = 0;
  const categories = {}, departments = {}, items = {}, uniqueCat = {}, uniqueDept = {};

  data.forEach(r => {
    const price = toNum(r.total_price);
    totalValue += price;
    const cat = r.category || 'ไม่ระบุ';
    const dept = r.department || 'ไม่ระบุ';
    uniqueCat[cat] = true; uniqueDept[dept] = true;
    if (!categories[cat]) categories[cat] = { name: cat, totalValue: 0, count: 0 };
    categories[cat].totalValue += price; categories[cat].count++;
    if (!departments[dept]) departments[dept] = { name: dept, totalValue: 0, count: 0 };
    departments[dept].totalValue += price; departments[dept].count++;
    if (!items[r.item]) items[r.item] = { name: r.item, totalQuantity: 0 };
    items[r.item].totalQuantity += toNum(r.quantity);
  });

  let topItem = { name: '-', quantity: 0 };
  for (const k in items) { if (items[k].totalQuantity > topItem.quantity) topItem = { name: k, quantity: items[k].totalQuantity }; }

  const catArr = Object.values(categories).sort((a, b) => b.totalValue - a.totalValue);
  const deptArr = Object.values(departments).sort((a, b) => b.totalValue - a.totalValue);

  return {
    totalValue, totalItems: data.length,
    totalCategories: Object.keys(uniqueCat).length,
    totalDepartments: Object.keys(uniqueDept).length,
    topItem, topDepartment: deptArr[0] || { name: '-', value: 0 },
    topCategory: catArr[0] || { name: '-', value: 0 },
    categoryBreakdown: catArr, departmentBreakdown: deptArr, monthlyTrend: []
  };
}
