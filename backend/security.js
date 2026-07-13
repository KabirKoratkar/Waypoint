const PRODUCTION_HOSTS = new Set([
    'waypointedu.org',
    'www.waypointedu.org',
    'collegeapps-ai.vercel.app',
    'waypoint-app.vercel.app',
    'waypoint-ai.vercel.app'
]);

export function isAllowedOrigin(origin) {
    if (!origin) return true;

    try {
        const url = new URL(origin);
        if (!['http:', 'https:'].includes(url.protocol)) return false;

        const hostname = url.hostname.toLowerCase();
        const configuredOrigins = new Set(
            (process.env.ALLOWED_ORIGINS || '')
                .split(',')
                .map(value => value.trim())
                .filter(Boolean)
        );
        return hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            PRODUCTION_HOSTS.has(hostname) ||
            configuredOrigins.has(url.origin);
    } catch {
        return false;
    }
}

export function getAppBaseUrl(requestOrigin) {
    const configuredUrl = process.env.APP_URL;
    if (configuredUrl) {
        try {
            const url = new URL(configuredUrl);
            if (['http:', 'https:'].includes(url.protocol)) {
                return url.origin;
            }
        } catch {
            console.error('APP_URL is not a valid URL');
        }
    }

    if (requestOrigin && isAllowedOrigin(requestOrigin)) {
        return new URL(requestOrigin).origin;
    }

    return process.env.NODE_ENV === 'production'
        ? 'https://waypointedu.org'
        : 'http://localhost:5500';
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function createAuthMiddleware(supabase) {
    return async function requireAuth(req, res, next) {
        try {
            const authorization = req.get('authorization') || '';
            const [scheme, token] = authorization.split(' ');

            if (process.env.NODE_ENV !== 'production') {
                const devUserId = req.get('x-waypoint-dev-user');
                if (devUserId?.startsWith('dev-user-') || devUserId?.startsWith('auth0-')) {
                    const requestedUserId = req.body?.userId || req.query?.userId;
                    if (requestedUserId && requestedUserId !== devUserId) {
                        return res.status(403).json({ error: 'User ID does not match authenticated session' });
                    }
                    req.user = { id: devUserId, email: null };
                    return next();
                }
            }

            if (scheme !== 'Bearer' || !token) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }

            const requestedUserId = req.body?.userId || req.query?.userId;
            if (requestedUserId && requestedUserId !== user.id) {
                return res.status(403).json({ error: 'User ID does not match authenticated session' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Authentication check failed:', error);
            res.status(503).json({ error: 'Authentication service unavailable' });
        }
    };
}
