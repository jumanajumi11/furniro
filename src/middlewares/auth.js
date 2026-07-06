import User from '../models/user.js';
import { logger } from '../utils/logger.js';

export const isLogin = async (req, res, next) => {
    try {
        if (req.session.user || req.session.user_id) {
            const id = req.session.user_id || (req.session.user ? req.session.user._id : null);
            const userData = await User.findById(id);

            if (userData && !userData.isAdmin && !userData.isBlocked) {
                return next();
            }
        }

        const isAjax =
            req.xhr ||
            req.headers['x-requested-with'] === 'XMLHttpRequest' ||
            (req.headers.accept && req.headers.accept.includes('application/json')) ||
            req.headers['content-type'] === 'application/json';

        if (isAjax) {
            return res.status(401).json({
                success: false,
                message: 'Please login to continue',
                redirectUrl: '/login'
            });
        }

        if (req.session) {
            req.session.destroy(() => {
                res.clearCookie('user.sid');
                res.redirect('/login');
            });
        } else {
            res.redirect('/login');
        }
    } catch (error) {
        logger.error('Auth Middleware Error:', error.message);
        res.redirect('/login');
    }
};

export const isLogout = async (req, res, next) => {
    try {
        if (req.session.user_id || req.session.user) {
            const id = req.session.user_id || (req.session.user ? req.session.user._id : null);
            const userData = await User.findById(id);
            if (userData && !userData.isAdmin && !userData.isBlocked) {
                return res.redirect('/'); 
            }
        }
        next();
    } catch (error) {
        logger.error('isLogout middleware error:', error.message);
        next();
    }
};

export const isAdmin = async (req, res, next) => {
    try {
        if (req.session.admin && req.session.admin._id) { 
            const adminData = await User.findById(req.session.admin._id);
            if (adminData && adminData.isAdmin && !adminData.isBlocked) {
                return next();
            }
        }
        
        if (req.session) {
            req.session.destroy(() => {
                res.clearCookie('admin.sid');
                res.redirect('/admin/login');
            });
        } else {
            res.redirect('/admin/login');
        }
    } catch (error) {
        logger.error('Admin Auth Middleware Error:', error.message);
        res.redirect('/admin/login');
    }
};

export const isAdminLogout = async (req, res, next) => {
    try {
        if (req.session.admin && req.session.admin._id) {
            const adminData = await User.findById(req.session.admin._id);
            if (adminData && adminData.isAdmin && !adminData.isBlocked) {
                return res.redirect('/admin/dashboard'); 
            }
        }
        next();
    } catch (error) {
        logger.error('isAdminLogout middleware error:', error.message);
        next();
    }
};

export const checkBlockedStatus = async (req, res, next) => {
    try {
        const id = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (id) {
            const user = await User.findById(id);

            if (user && user.isBlocked) {
                return req.session.destroy(() => {
                    res.clearCookie('user.sid');
                    const isAjax = req.xhr || 
                                   (req.headers.accept && req.headers.accept.includes('json')) || 
                                   req.path === '/update-profile' ||
                                   req.method !== 'GET';

                    if (isAjax) {
                        return res.status(401).json({ 
                            success: false, 
                            isBlocked: true, 
                            message: 'Your account is blocked' 
                        });
                    }
                    res.redirect('/login?error=Your account is blocked');
                });
            }
        }
        next();
    } catch (error) {
        next();
    }
};