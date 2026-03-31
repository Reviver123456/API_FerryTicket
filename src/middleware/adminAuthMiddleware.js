import { supabase } from '../config/supabase.js';
import { fail } from '../utils/http.js';
import {
  linkAuthIdentityToLocalRecord,
  verifySupabaseAccessToken
} from '../services/supabaseAuth.service.js';

const getBearerToken = (header = '') => (header.startsWith('Bearer ') ? header.slice(7) : null);

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const loadAdminSession = async (authUser) => {
  const authScope = authUser?.user_metadata?.scope;
  if (authScope && authScope !== 'admin') {
    throw new Error('Unauthorized');
  }

  const authEmail = String(authUser.email || '').toLowerCase();
  const { data: linkedAdmin, error: linkedError } = await supabase
    .from('admin_users')
    .select('id, name, username, phone, email, role, status, agent_id, permissions_override, two_factor_enabled, two_factor_method, last_login_at, auth_user_id, agents(id, agent_code, name, company_name, status)')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (linkedError) {
    throw linkedError;
  }

  let admin = linkedAdmin;

  if (!admin && authEmail) {
    const { data: emailAdmin, error: emailError } = await supabase
      .from('admin_users')
      .select('id, name, username, phone, email, role, status, agent_id, permissions_override, two_factor_enabled, two_factor_method, last_login_at, auth_user_id, agents(id, agent_code, name, company_name, status)')
      .eq('email', authEmail)
      .maybeSingle();

    if (emailError) {
      throw emailError;
    }

    if (emailAdmin) {
      if (!emailAdmin.auth_user_id) {
        await linkAuthIdentityToLocalRecord({
          table: 'admin_users',
          localId: emailAdmin.id,
          authUserId: authUser.id
        });
      }
      admin = {
        ...emailAdmin,
        auth_user_id: authUser.id
      };
    }
  }

  if (!admin) {
    throw new Error('Unauthorized');
  }

  if (admin.status !== 'active') {
    throw new Error('Admin account is not active');
  }

  const { data: roleRow, error: roleError } = await supabase
    .from('admin_roles')
    .select('code, name, permissions, status')
    .eq('code', admin.role)
    .maybeSingle();

  if (roleError) {
    throw new Error('Unable to load permissions');
  }

  const rolePermissions = Array.isArray(roleRow?.permissions) ? roleRow.permissions : [];
  const overridePermissions = Array.isArray(admin.permissions_override) ? admin.permissions_override : [];

  return {
    id: admin.id,
    name: admin.name,
    username: admin.username,
    phone: admin.phone,
    email: admin.email,
    role: admin.role,
    role_name: roleRow?.name || admin.role,
    status: admin.status,
    agent_id: admin.agent_id,
    two_factor_enabled: admin.two_factor_enabled,
    two_factor_method: admin.two_factor_method,
    last_login_at: admin.last_login_at,
    agents: admin.agents,
    auth_user_id: authUser.id,
    permissions: unique([...rolePermissions, ...overridePermissions])
  };
};

export const adminAuthRequired = async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization || '');
  if (!token) return fail(res, 'Unauthorized', 401);

  try {
    const authUser = await verifySupabaseAccessToken(token);
    req.admin = await loadAdminSession(authUser);
    return next();
  } catch (error) {
    const message = error.message === 'Admin account is not active'
      ? error.message
      : 'Invalid token';
    return fail(res, message, 401);
  }
};

export const adminPermissionRequired = (...requiredPermissions) => (req, res, next) => {
  const permissions = req.admin?.permissions || [];
  if (permissions.includes('*')) return next();

  const hasPermission = requiredPermissions.every((permission) => permissions.includes(permission));
  if (!hasPermission) {
    return fail(res, 'Forbidden', 403, {
      required_permissions: requiredPermissions
    });
  }

  return next();
};
