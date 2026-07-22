// ═══════════════════════════════════════
// API: /api/inventory — Inventory + Suppliers + Assets
// ═══════════════════════════════════════
const { getSupabaseAdmin, generateId, toNum } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const supabase = getSupabaseAdmin();
  const { action, data } = req.body || {};

  try {
    switch (action) {
      // ── INVENTORY ──
      case 'get_inventory': return await getInventory(supabase, res);
      case 'add_inventory': return await addInventory(supabase, data, res);
      case 'add_inventory_batch': return await addInventoryBatch(supabase, data, res);
      case 'update_stock': return await updateStock(supabase, data, res);
      case 'low_stock': return await getLowStock(supabase, res);
      // ── SUPPLIERS ──
      case 'get_suppliers': return await getSuppliers(supabase, res);
      case 'add_supplier': return await addSupplier(supabase, data, res);
      case 'update_supplier': return await updateSupplier(supabase, data, res);
      case 'delete_supplier': return await deleteSupplier(supabase, data, res);
      // ── ASSETS ──
      case 'get_assets': return await getAssets(supabase, res);
      case 'add_asset': return await addAsset(supabase, data, res);
      case 'update_asset': return await updateAsset(supabase, data, res);
      // ── LOGS ──
      case 'get_logs': return await getLogs(supabase, data, res);
      default: return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function getInventory(supabase, res) { const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false }); if (error) throw error; return res.json({ success: true, items: data || [], count: (data || []).length }); }
async function addInventory(supabase, d, res) { const id = generateId('INV'); const { error } = await supabase.from('inventory').insert({ item_id: id, item: d.item, category: d.category || '', stock_qty: toNum(d.stockQty), min_stock: toNum(d.minStock) || 5, unit_price: toNum(d.unitPrice), unit: d.unit || 'ชิ้น', supplier: d.supplier || '' }); if (error) return res.json({ success: false, error: error.message }); return res.json({ success: true, message: 'เพิ่มสินค้าเรียบร้อย' }); }
async function addInventoryBatch(supabase, d, res) { const items = d.items || []; if (items.length === 0) return res.json({ success: false, error: 'ไม่มีรายการ' }); const rows = items.map(it => ({ item_id: generateId('INV'), item: it.item, category: it.category || '', stock_qty: toNum(it.stockQty), min_stock: toNum(it.minStock) || 5, unit_price: toNum(it.unitPrice), unit: it.unit || 'ชิ้น', supplier: it.supplier || '' })); const { error } = await supabase.from('inventory').insert(rows); if (error) return res.json({ success: false, error: error.message }); return res.json({ success: true, message: `เพิ่ม ${rows.length} รายการเรียบร้อย`, count: rows.length }); }
async function updateStock(supabase, d, res) { const { itemId, qty } = d || {}; if (!itemId) return res.json({ success: false, error: 'กรุณาระบุ Item ID' }); const { error } = await supabase.from('inventory').update({ stock_qty: toNum(qty), last_updated: new Date().toISOString() }).eq('item_id', itemId); if (error) throw error; return res.json({ success: true, message: 'อัปเดตสต็อกเรียบร้อย' }); }
async function getLowStock(supabase, res) { const { data, error } = await supabase.from('inventory').select('*').lte('stock_qty', 10); if (error) throw error; const lowStock = (data || []).filter(i => i.stock_qty <= (i.min_stock || 5)); return res.json({ success: true, items: lowStock, count: lowStock.length }); }

async function getSuppliers(supabase, res) { const { data, error } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false }); if (error) throw error; return res.json({ success: true, suppliers: data || [] }); }
async function addSupplier(supabase, d, res) { const id = generateId('SUP'); const { error } = await supabase.from('suppliers').insert({ supplier_id: id, name: d.name, contact: d.contact || '', phone: d.phone || '', email: d.email || '', address: d.address || '' }); if (error) return res.json({ success: false, error: error.message }); return res.json({ success: true, message: 'เพิ่ม Supplier เรียบร้อย' }); }
async function updateSupplier(supabase, d, res) { const { supplierId, ...updates } = d || {}; if (!supplierId) return res.json({ success: false, error: 'กรุณาระบุ Supplier ID' }); const { error } = await supabase.from('suppliers').update(updates).eq('supplier_id', supplierId); if (error) throw error; return res.json({ success: true, message: 'อัปเดต Supplier เรียบร้อย' }); }
async function deleteSupplier(supabase, d, res) { const { supplierId } = d || {}; if (!supplierId) return res.json({ success: false, error: 'กรุณาระบุ Supplier ID' }); const { error } = await supabase.from('suppliers').delete().eq('supplier_id', supplierId); if (error) throw error; return res.json({ success: true, message: 'ลบ Supplier เรียบร้อย' }); }

async function getAssets(supabase, res) { const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false }); if (error) throw error; return res.json({ success: true, assets: data || [] }); }
async function addAsset(supabase, d, res) { const id = generateId('AST'); const price = toNum(d.purchasePrice); const lifespan = toNum(d.lifespanYears) || 5; const { error } = await supabase.from('assets').insert({ asset_id: id, name: d.name, category: d.category || '', department: d.department || '', purchase_date: d.purchaseDate || null, purchase_price: price, status: d.status || 'ใช้งาน', assigned_to: d.assignedTo || '', location: d.location || '', notes: d.notes || '', lifespan_years: lifespan, current_value: price }); if (error) return res.json({ success: false, error: error.message }); return res.json({ success: true, message: 'เพิ่มทรัพย์สินเรียบร้อย' }); }
async function updateAsset(supabase, d, res) { const { assetId, ...updates } = d || {}; if (!assetId) return res.json({ success: false, error: 'กรุณาระบุ Asset ID' }); const { error } = await supabase.from('assets').update(updates).eq('asset_id', assetId); if (error) throw error; return res.json({ success: true, message: 'อัปเดตทรัพย์สินเรียบร้อย' }); }

async function getLogs(supabase, d, res) {
  let query = supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(100);
  if (d?.userEmail) query = query.eq('user_email', d.userEmail);
  if (d?.action) query = query.eq('action', d.action);
  const { data, error } = await query;
  if (error) throw error;
  return res.json({ success: true, logs: data || [], count: (data || []).length });
}