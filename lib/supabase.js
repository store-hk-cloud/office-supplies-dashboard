// ═══════════════════════════════════════
// Supabase Client — shared across API routes
// ═══════════════════════════════════════
const { createClient } = require('@supabase/supabase-js');

let supabase = null;
let supabaseAdmin = null;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getSupabase() {
  if (!supabase) {
    supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'));
  }
  return supabase;
}

// Use service_role key for admin operations (API routes)
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    supabaseAdmin = createClient(requiredEnv('SUPABASE_URL'), serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return supabaseAdmin;
}

// Helper: Generate unique ID (REQ-20260722-XXXXX)
function generateId(prefix) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

// Helper: Format currency as number
function toNum(v) { return Number(v) || 0; }

module.exports = { getSupabase, getSupabaseAdmin, generateId, toNum };
