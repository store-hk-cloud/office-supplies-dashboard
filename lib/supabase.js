// ═══════════════════════════════════════
// Supabase Client — shared across API routes
// ═══════════════════════════════════════
const { createClient } = require('@supabase/supabase-js');

// These must be set as Vercel Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
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

module.exports = { getSupabase, generateId, toNum };