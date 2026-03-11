import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis.js';

const isTestEnv = process.env.NODE_ENV === 'test';
const isDevelopmentEnv = process.env.NODE_ENV === 'development';

const toPositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const formatWaitMinutes = (windowMs) => {
    const minutes = Math.max(1, Math.ceil(windowMs / (60 * 1000)));
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};

const globalWindowMs = toPositiveInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS, 15 * 60 * 1000);
const globalMaxRequests = toPositiveInt(process.env.RATE_LIMIT_GLOBAL_MAX, isDevelopmentEnv ? 500 : 100);
const authWindowMs = toPositiveInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, isDevelopmentEnv ? 60 * 1000 : 15 * 60 * 1000);
const authMaxRequests = toPositiveInt(process.env.RATE_LIMIT_AUTH_MAX, isDevelopmentEnv ? 30 : 10);

let globalLimiter;
let authLimiter;

if (isTestEnv || isDevelopmentEnv) {
    // Bypass rate limiters in test & development to avoid blocking manual testing
    globalLimiter = (req, res, next) => next();
    authLimiter = (req, res, next) => next();
} else {
    // Global limiter stays strict in production, relaxed in development for manual testing.
    globalLimiter = rateLimit({
        windowMs: globalWindowMs,
        max: globalMaxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        // Avoid counting auth requests twice (global + auth limiter).
        skip: (req) => req.path.startsWith('/auth'),
        store: new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
        }),
        message: { success: false, message: `Too many requests from this IP, please try again after ${formatWaitMinutes(globalWindowMs)}` }
    });

    // Auth limiter defaults to a smaller window in development to keep login testing fast.
    authLimiter = rateLimit({
        windowMs: authWindowMs,
        max: authMaxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
        }),
        message: { success: false, message: `Too many login attempts from this IP, please try again after ${formatWaitMinutes(authWindowMs)}` }
    });
}

export { globalLimiter, authLimiter };
