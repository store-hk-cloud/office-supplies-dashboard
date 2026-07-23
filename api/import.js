// ═══════════════════════════════════════
// API: /api/import — File Upload + Parse Excel/CSV
// ═══════════════════════════════════════
const { getSupabaseAdmin, generateId, toNum } = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const auth = await requireAuth(req, res, ['approver', 'admin']);
  if (!auth) return;
  const supabase = getSupabaseAdmin();
  const { action } = req.body || {};

  try {
    switch (action) {
      case 'preview': return await previewFile(supabase, req.body, res);
      case 'import': return await importFile(supabase, req.body, res);
      default: return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function importFile(supabase, body, res) {
  const { data: rows, monthKey, fileName } = body || {};
  if (!rows || !Array.isArray(rows)) return res.json({ success: false, error: 'No data rows provided' });

  let imported = 0, skipped = 0;
  for (const row of rows) {
    if (!row.item) { skipped++; continue; }
    const dedupKey = [row.item, row.department, row.date, row.totalPrice, row.quantity].join('||');
    const { data: existing } = await supabase.from('transactions').select('id').eq('item', row.item).eq('department', row.department).eq('date', row.date).limit(1);
    if (existing && existing.length > 0) { skipped++; continue; }

    const { error: insertError } = await supabase.from('transactions').insert({
      transaction_id: generateId('TRN'),
      request_id: 'IMPORT-' + (fileName || 'upload'),
      date: row.date || (monthKey ? monthKey + '-01' : new Date().toISOString().slice(0, 10)),
      item: row.item,
      category: row.category || 'ไม่ระบุ',
      department: row.department || 'ไม่ระบุ',
      quantity: toNum(row.quantity),
      unit_price: toNum(row.unitPrice),
      total_price: toNum(row.totalPrice),
      requester_name: 'System Import',
      approved_by: 'Import',
      approval_date: new Date().toISOString().slice(0, 10)
    });
    if (insertError) return res.status(500).json({ success: false, error: insertError.message, imported, skipped });
    imported++;
  }

  // Log import
  await supabase.from('import_logs').insert({ file_name: fileName, total_rows: rows.length, imported_rows: imported, skipped_rows: skipped, month_key: monthKey });

  return res.json({ success: true, rows: imported, skipped, total: rows.length });
}

async function previewFile(supabase, body, res) {
  // In a real implementation, this would parse the file buffer
  // For now, return preview metadata
  return res.json({ success: true, preview: true, message: 'File ready for import' });
}
