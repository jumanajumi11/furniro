import googleAuthService from '../../services/user/googleAuth.service.js';

export const googleCallback = async (req, res, next) => {
    try {
        if (!req.user) {
            console.log("Google user data not found");
            return res.redirect('/login');
        }

        let user;
        try {
            user = await googleAuthService.handleGoogleLogin(req.user);
        } catch (e) {
            req.logout(() => {});
            return res.render('user/login', { error: e.message });
        }

        req.session.user_id = user._id;
        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email
        };

        req.session.save((err) => {
            if (err) {
                console.error("Session Save Error:", err);
                return res.redirect('/login');
            }
            console.log("Google Login Success, Session ID:", req.session.user_id);
            return res.redirect('/');
        });
    } catch (error) {
        console.error("Google Callback Error:", error.message);
        res.redirect('/login');
    }
};

export default {
    googleCallback
};
