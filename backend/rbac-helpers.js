/**
 * RBAC Helper Functions for Backend
 * Use these to check user roles and permissions
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * Check if a user has a specific role
 * @param {string} userId - User ID
 * @param {string} role - Role to check ('admin', 'moderator', 'user', 'beta_tester')
 * @returns {Promise<boolean>}
 */
export async function userHasRole(userId, role) {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return false;
    return data.role === role;
}

/**
 * Check if user is admin
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isAdmin(userId) {
    return userHasRole(userId, 'admin');
}

/**
 * Check if user is moderator or higher
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isModerator(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return false;
    return data.role === 'admin' || data.role === 'moderator';
}

/**
 * Check if user has premium access
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function hasPremiumAccess(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('is_premium, is_beta, role')
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return false;
    return data.is_premium || data.is_beta || data.role === 'admin' || data.role === 'beta_tester';
}

/**
 * Assign a role to a user (admin only)
 * @param {string} adminId - Admin performing the action
 * @param {string} userId - User to assign role to
 * @param {string} role - Role to assign
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function assignRole(adminId, userId, role) {
    // Check if requester is admin
    if (!await isAdmin(adminId)) {
        return { success: false, error: 'Only admins can assign roles' };
    }

    const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);

    if (error) {
        return { success: false, error: error.message };
    }

    // Log the action
    await logAdminAction(adminId, 'ASSIGN_ROLE', userId, { role });

    return { success: true };
}

/**
 * Log an admin action for audit trail
 * @param {string} adminId
 * @param {string} action
 * @param {string} targetUserId
 * @param {object} details
 */
export async function logAdminAction(adminId, action, targetUserId, details = {}) {
    await supabase
        .from('admin_audit_log')
        .insert({
            admin_id: adminId,
            action,
            target_user_id: targetUserId,
            details
        });
}

/**
 * Protect an endpoint - returns 403 if user doesn't have required role
 * @param {object} req - Express request
 * @param {string} requiredRole - Role required ('admin', 'moderator', etc)
 * @returns {Promise<{allowed: boolean, userId?: string}>}
 */
export async function protectEndpoint(req, requiredRole = 'admin') {
    const userId = req.user?.id || req.body?.userId;
    if (!userId) {
        return { allowed: false, error: 'Unauthorized' };
    }

    const hasRole = await userHasRole(userId, requiredRole);
    if (!hasRole) {
        return { allowed: false, error: `Requires ${requiredRole} role` };
    }

    return { allowed: true, userId };
}

/**
 * Middleware for protecting admin endpoints
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
export async function adminOnly(req, res, next) {
    const userId = req.user?.id || req.body?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const admin = await isAdmin(userId);
    if (!admin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
}

/**
 * Middleware for protecting premium endpoints
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
export async function premiumOnly(req, res, next) {
    const userId = req.user?.id || req.body?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPremium = await hasPremiumAccess(userId);
    if (!hasPremium) {
        return res.status(403).json({ error: 'Forbidden: Premium access required' });
    }

    next();
}

export default {
    userHasRole,
    isAdmin,
    isModerator,
    hasPremiumAccess,
    assignRole,
    logAdminAction,
    protectEndpoint,
    adminOnly,
    premiumOnly
};
