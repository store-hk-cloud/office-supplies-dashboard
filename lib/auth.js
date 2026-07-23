const { getSupabase, getSupabaseAdmin } = require('./supabase');

function getBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1] : null;
}

async function requireAuth(req, res, allowedRoles, dependencies = {}) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return null;
  }

  try {
    const supabase = dependencies.supabase || getSupabase();
    const admin = dependencies.admin || getSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const authUser = authData?.user;

    if (authError || !authUser?.email) {
      res.status(401).json({ success: false, error: 'Invalid or expired session' });
      return null;
    }

    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('*')
      .eq('email', authUser.email)
      .single();

    if (profileError || !profile || profile.is_active === false) {
      res.status(403).json({ success: false, error: 'User profile is not active' });
      return null;
    }

    if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return null;
    }

    return { token, authUser, profile };
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unable to verify session' });
    return null;
  }
}

module.exports = { getBearerToken, requireAuth };
