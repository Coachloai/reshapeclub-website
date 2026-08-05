// Admin-only user management for the dashboard.
//
// All requests are POST { action, ... } and MUST carry the caller's
// Supabase session JWT in the Authorization header. The caller's email is
// verified against the ADMIN_EMAILS allowlist before anything runs.
//
//   list                       → list dashboard users
//   invite  { email }          → create the user, return a copyable set-password
//                                link, and (best-effort) email the invite
//   delete  { id }             → remove a user (cannot remove yourself)
//
// The service_role key never leaves this function. Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY  (auto-injected)
//   ADMIN_EMAILS        comma-separated allowlist, e.g. "a@x.com,b@y.com"
//   SET_PASSWORD_URL    where invite/reset links land (optional; defaults below)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;
const SET_PASSWORD_URL =
  Deno.env.get('SET_PASSWORD_URL') || 'https://reshape.fit/set-password/';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return json({ error: 'method not allowed' }, 405);

  try {
    // ── Verify the caller and check the allowlist ──────────────────────────
    const authz = req.headers.get('Authorization') || '';
    const token = authz.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'not authenticated' }, 401);

    const caller = await getCaller(token);
    if (!caller) return json({ error: 'not authenticated' }, 401);

    if (ADMIN_EMAILS.length === 0) {
      return json({ error: 'No admins configured. Set the ADMIN_EMAILS secret.' }, 403);
    }
    if (!ADMIN_EMAILS.includes((caller.email || '').toLowerCase())) {
      return json({ error: 'You are not authorised to manage users.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'list')       return await listUsers();
    if (action === 'invite')     return await inviteUser(body?.email, body?.role);
    if (action === 'set_role')   return await setUserRole(body?.id, body?.role);
    if (action === 'delete')     return await deleteUser(body?.id, caller.id);

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// ── Caller identity ──────────────────────────────────────────────────────
async function getCaller(token: string): Promise<{ id: string; email: string } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  if (!u || !u.id) return null;
  return { id: u.id, email: u.email || '' };
}

// ── Actions ──────────────────────────────────────────────────────────────
async function listUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: srHeaders(),
  });
  if (!res.ok) return json({ error: 'list failed: ' + (await res.text()) }, 500);
  const data = await res.json();
  const users = (data.users || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    role: u.user_metadata?.dashboard_role || 'admin',
    status: u.last_sign_in_at
      ? 'active'
      : u.email_confirmed_at || u.confirmed_at
      ? 'confirmed'
      : 'pending',
  }));
  users.sort((a: any, b: any) => (a.email || '').localeCompare(b.email || ''));
  return json({ ok: true, users });
}

async function inviteUser(emailRaw: unknown, roleRaw?: unknown) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'A valid email is required.' }, 400);
  }
  const VALID_ROLES = ['admin', 'consult'];
  const role = VALID_ROLES.includes(String(roleRaw || '')) ? String(roleRaw) : 'admin';

  // 1. Best-effort native invite — creates the user and emails them (if SMTP
  //    is configured on the project).
  let emailed = false;
  let note = '';
  let userExisted = false;

  const inv = await fetch(
    `${SUPABASE_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(SET_PASSWORD_URL)}`,
    { method: 'POST', headers: srHeaders(), body: JSON.stringify({ email, data: { dashboard_role: role } }) },
  );
  if (inv.ok) {
    emailed = true;
  } else {
    const t = await inv.text();
    if (/registered|already|exists/i.test(t)) {
      userExisted = true;
      note = 'User already existed — generated a password link you can send them.';
    } else {
      note = 'Invite email not sent (SMTP may not be configured). Copy the link below and send it yourself.';
    }
  }

  // 2. Set the role in user_metadata (covers both new and existing users).
  //    For existing users the invite above may have failed, so we patch directly.
  if (userExisted) {
    // Look up the user and patch their metadata
    const lookup = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: srHeaders() });
    if (lookup.ok) {
      const all = await lookup.json();
      const existing = (all.users || []).find((u: any) => (u.email || '').toLowerCase() === email);
      if (existing) {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
          method: 'PUT',
          headers: srHeaders(),
          body: JSON.stringify({ user_metadata: { ...existing.user_metadata, dashboard_role: role } }),
        });
      }
    }
  }

  // 3. Always produce a working copyable link. If the user already exists
  //    (incl. one the invite just created) prefer a recovery link.
  const userExists = inv.ok || userExisted;
  const link = await anyLink(email, !userExists);
  if (!link) return json({ error: 'Could not generate an invite link.' }, 500);

  return json({ ok: true, action_link: link, emailed, note, email, role });
}

async function setUserRole(idRaw: unknown, roleRaw: unknown) {
  const id = String(idRaw || '').trim();
  const VALID_ROLES = ['admin', 'consult'];
  const role = String(roleRaw || '');
  if (!id) return json({ error: 'user id required' }, 400);
  if (!VALID_ROLES.includes(role)) return json({ error: 'invalid role' }, 400);

  // Get current metadata to merge
  const get = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: srHeaders() });
  if (!get.ok) return json({ error: 'user not found' }, 404);
  const user = await get.json();

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: srHeaders(),
    body: JSON.stringify({ user_metadata: { ...user.user_metadata, dashboard_role: role } }),
  });
  if (!res.ok) return json({ error: 'failed to update role: ' + (await res.text()) }, 500);
  return json({ ok: true });
}

async function deleteUser(id: unknown, callerId: string) {
  const userId = String(id || '').trim();
  if (!userId) return json({ error: 'user id required' }, 400);
  if (userId === callerId) return json({ error: 'You cannot remove your own account.' }, 400);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: srHeaders(),
  });
  if (!res.ok) return json({ error: 'delete failed: ' + (await res.text()) }, 500);
  return json({ ok: true });
}

// ── Link generation ──────────────────────────────────────────────────────
// Tries link types in turn until one succeeds. invite needs a NEW user;
// recovery/magiclink need an EXISTING one — so we order by which we expect.
async function anyLink(email: string, preferNew: boolean): Promise<string | null> {
  const order = preferNew
    ? ['invite', 'recovery', 'magiclink']
    : ['recovery', 'magiclink', 'invite'];
  for (const type of order) {
    const g = await genLink(type, email);
    if (g) return g;
  }
  return null;
}

async function genLink(type: string, email: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: srHeaders(),
    body: JSON.stringify({ type, email, redirect_to: SET_PASSWORD_URL }),
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  if (!j) return null;
  return j.action_link || (j.properties && j.properties.action_link) || null;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function srHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
