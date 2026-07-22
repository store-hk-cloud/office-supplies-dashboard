// ═══════════════════════════════════════
// Supabase Client — shared across API routes
// ═══════════════════════════════════════
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://orgjpruiiyrjapezzwgp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZ2pwcnVpaXlyamFwZXp3emdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTQ4NTQsImV4cCI6MjEwMDI5MDg1NH0.00Mp5FZrW65XFIwudMKacV6pTaLJl17uBR__ArNtmqQ';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase = null;
let supabaseAdmin = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

// Use service_role key for admin operations (API routes)
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
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