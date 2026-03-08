import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis.js';

let globalLimiter;
let authLimiter;

if (process.env.NODE_ENV === 'test') {
    // Bypass rate limiters explicitly during integration tests to avoid redis mock issues
    globalLimiter = (req, res, next) => next();
    authLimiter = (req, res, next) => next();
} else {
    // Global rate limiter for most API routes (100 req per 15 minutes)
    globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
        }),
        message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' }
    });

    // Strict rate limiter for Auth routes to prevent brute-force attacks (5 req per 15 minutes)
    authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
        }),
        message: { success: false, message: 'Too many login attempts from this IP, please try again after 15 minutes' }
    });
}

export { globalLimiter, authLimiter };
