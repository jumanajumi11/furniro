/**
 * Centralized logger utility.
 *
 * Log levels:
 *   logger.info(...)  — always shown (server start, DB connect)
 *   logger.warn(...)  — always shown (non-fatal warnings)
 *   logger.error(...) — always shown (real errors, catch blocks)
 *   logger.debug(...) — shown ONLY in development (NODE_ENV !== 'production')
 *
 * Usage:
 *   import { logger } from '../utils/logger.js';
 *   logger.info('Server started');
 *   logger.debug('OTP generated:', otp);   // suppressed in production
 *   logger.error('DB connect failed:', err);
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
    info:  (...args) => console.info('[INFO]',  ...args),
    warn:  (...args) => console.warn('[WARN]',  ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    debug: (...args) => { if (isDev) console.log('[DEBUG]', ...args); }
};

export default logger;
