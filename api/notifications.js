// ═══════════════════════════════════════
// API: /api/notifications — Email Alerts & Templates
// ═══════════════════════════════════════
const { getSupabaseAdmin, generateId, toNum } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const supabase = getSupabaseAdmin();
  const { action, data } = req.body || {};

  try {
    switch (action) {
      case 'send_alert': return await sendAlert(supabase, data, res);
      case 'send_approval_notification': return await sendApprovalNotification(supabase, data, res);
      case 'check_budget_alerts': return await checkBudgetAlerts(supabase, res);
      case 'save_template': return await saveTemplate(supabase, data, res);
      case 'get_templates': return await getTemplates(supabase, data, res);
      case 'delete_template': return await deleteTemplate(supabase, data, res);
      case 'get_template': return await getTemplate(supabase, data, res);
      default: return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════
// EMAIL NOTIFICATIONS (via Resend or log-only mode)
// ═══════════════════════════════════════
async function sendAlert(supabase, d, res) {
  const { to, subject, message, type } = d || {};
  if (!to || !subject || !message) {
    return res.json({ success: false, error: 'Missing to/subject/message' });
  }

  // Log the notification
  const { error: logErr } = await supabase.from('notification_logs').insert({
    recipient: to,
    subject,
    message,
    type: type || 'alert',
    status: 'logged',
    timestamp: new Date().toISOString()
  });

  if (logErr) throw logErr;

  // Attempt to send via Resend if API key is configured
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (RESEND_API_KEY && to.includes('@')) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Office Supplies <noreply@hillkoff.com>',
          to: [to],
          subject: subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#1a73e8">📊 Office Supplies Management</h2>
            <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0">${message.replace(/\n/g, '<br>')}</div>
            <p style="color:#5f6368;font-size:12px">อีเมลอัตโนมัติจากระบบ Office Supplies — กรุณาอย่าตอบกลับ</p>
          </div>`
        })
      });
      const result = await resp.json();
      if (resp.ok) {
        await supabase.from('notification_logs').insert({
          recipient: to, subject, message, type: type || 'alert',
          status: 'sent', external_id: result.id, timestamp: new Date().toISOString()
        });
        return res.json({ success: true, message: 'อีเมลถูกส่งแล้ว', id: result.id });
      }
    } catch (sendErr) {
      // Fall through to log-only
    }
  }

  return res.json({ success: true, message: 'บันทึกการแจ้งเตือนแล้ว (log-only)', emailSent: false });
}

async function sendApprovalNotification(supabase, d, res) {
  const { requestId, requesterEmail, approverEmail, status, totalPrice } = d || {};

  // Notify requester of approval/rejection
  if (requesterEmail && status) {
    const thaiStatus = status === 'approved' ? 'อนุมัติแล้ว ✅' : status === 'rejected' ? 'ปฏิเสธ ❌' : status;
    await sendAlert(supabase, {
      to: requesterEmail,
      subject: `คำขอ ${requestId} ถูก${thaiStatus}`,
      message: `คำขอเบิก ${requestId} มูลค่า ${formatCurrencyLocal(totalPrice)} ถูก${thaiStatus}\n\nวันที่: ${new Date().toLocaleDateString('th-TH')}\n\nเข้าสู่ระบบ: ${process.env.APP_URL || 'https://office-supplies.vercel.app'}`,
      type: 'approval'
    }, { json: () => {} });
  }

  // Notify approver of new pending request
  if (approverEmail && status === 'pending') {
    await sendAlert(supabase, {
      to: approverEmail,
      subject: `คำขอใหม่ ${requestId} รอการอนุมัติ`,
      message: `มีคำขอเบิกใหม่ ${requestId} จาก ${d.requesterName || requesterEmail}\nมูลค่า: ${formatCurrencyLocal(totalPrice)}\n\nกรุณาเข้าสู่ระบบเพื่ออนุมัติ`,
      type: 'approval_request'
    }, { json: () => {} });
  }

  return res.json({ success: true, message: 'Notifications processed' });
}

async function checkBudgetAlerts(supabase, res) {
  const { data: budgets } = await supabase.from('budgets').select('*');
  const alerts = [];
  for (const b of (budgets || [])) {
    const pct = toNum(b.usage_percent);
    if (pct >= 100 && !b.alert_sent) {
      alerts.push({
        department: b.department,
        month: b.month,
        usagePercent: pct,
        type: 'budget_critical',
        message: `🚨 แผนก ${b.department} ใช้งบเกิน 100% (${pct.toFixed(0)}%)`
      });
    } else if (pct >= 80 && !b.alert_sent) {
      alerts.push({
        department: b.department,
        month: b.month,
        usagePercent: pct,
        type: 'budget_warning',
        message: `⚠️ แผนก ${b.department} ใช้ไป ${pct.toFixed(0)}% ของงบประมาณ`
      });
    }
  }
  return res.json({ success: true, alerts, count: alerts.length });
}

// ═══════════════════════════════════════
// TEMPLATES (บันทึกคำขอที่ใช้บ่อย)
// ═══════════════════════════════════════
async function saveTemplate(supabase, d, res) {
  const { name, items, department, approverEmail, reason } = d || {};
  if (!name || !items || items.length === 0) {
    return res.json({ success: false, error: 'กรุณาระบุชื่อและรายการ' });
  }
  const templateId = generateId('TMP');
  const { error } = await supabase.from('request_templates').insert({
    template_id: templateId,
    name,
    department: department || '',
    approver_email: approverEmail || '',
    reason: reason || '',
    items: JSON.stringify(items),
    created_by: d.createdBy || '',
    usage_count: 0
  });
  if (error) return res.json({ success: false, error: error.message });
  return res.json({ success: true, templateId, message: 'บันทึกเทมเพลตเรียบร้อย' });
}

async function getTemplates(supabase, d, res) {
  const dept = d?.department || '';
  let query = supabase.from('request_templates').select('*');
  if (dept) query = query.or(`department.eq.${dept},department.eq.''`);
  const { data, error } = await query.order('usage_count', { ascending: false });
  if (error) throw error;
  const templates = (data || []).map(t => ({
    ...t,
    items: typeof t.items === 'string' ? JSON.parse(t.items) : (t.items || [])
  }));
  return res.json({ success: true, templates, count: templates.length });
}

async function getTemplate(supabase, d, res) {
  const { templateId } = d || {};
  if (!templateId) return res.json({ success: false, error: 'Missing templateId' });
  const { data, error } = await supabase.from('request_templates').select('*').eq('template_id', templateId).single();
  if (error || !data) return res.json({ success: false, error: 'ไม่พบเทมเพลต' });
  if (typeof data.items === 'string') data.items = JSON.parse(data.items);
  // Increment usage count
  await supabase.from('request_templates').update({ usage_count: (data.usage_count || 0) + 1 }).eq('template_id', templateId);
  return res.json({ success: true, template: data });
}

async function deleteTemplate(supabase, d, res) {
  const { templateId } = d || {};
  if (!templateId) return res.json({ success: false, error: 'Missing templateId' });
  await supabase.from('request_templates').delete().eq('template_id', templateId);
  return res.json({ success: true, message: 'ลบเทมเพลตเรียบร้อย' });
}

function formatCurrencyLocal(v) {
  if (v === null || v === undefined || isNaN(v)) return '฿0.00';
  return '฿' + Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}