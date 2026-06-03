/**
 * Global error handling middleware.
 */
export const errorHandler = (err, req, res, next) => {
    console.error("❌ GLOBAL ERROR HANDLER:", err);

    const isAjax = req.xhr || 
                   (req.headers.accept && req.headers.accept.includes('json')) || 
                   req.method !== 'GET';

    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred on the server.';

    if (isAjax) {
        return res.status(statusCode).json({
            success: false,
            message: message
        });
    }

    // Traditional page rendering fallback
    res.status(statusCode).render('user/404', {
        error: message
    });
};

export default errorHandler;
