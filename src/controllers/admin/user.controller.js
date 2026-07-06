import User from '../../models/user.js';
import { logger } from '../../utils/logger.js';

export const getUsers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const sort = req.query.sort || 'desc';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        let query = {
            isAdmin: false
        };

        if (status === 'active') {
            query.isBlocked = false;
        } else if (status === 'blocked') {
            query.isBlocked = true;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'asc' || sort === 'oldest') {
            sortOption = { createdAt: 1 };
        } else if (sort === 'name_az' || sort === 'az') {
            sortOption = { name: 1 };
        } else if (sort === 'name_za' || sort === 'za') {
            sortOption = { name: -1 };
        }

        logger.debug('--- ADMIN CUSTOMER MANAGEMENT QUERY AUDIT ---');
        logger.debug('Final MongoDB Query:', JSON.stringify(query));
        const totalNonAdmins = await User.countDocuments({ isAdmin: false });
        logger.debug('Total non-admin users in Database:', totalNonAdmins);

        const totalUsers = await User.countDocuments(query);
        logger.debug('Total users matching filters (Displayed Count):', totalUsers);
        logger.debug('---------------------------------------------');

        const users = await User.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit);

        const totalPages = Math.ceil(totalUsers / limit);

        res.render('admin/customers-managment', {
            users,
            search,
            status,
            sort,
            currentPage: page,
            totalPages,
            totalUsers,
            totalNonAdmins,
            limit
        });

    } catch (error) {
        console.error("getUsers Error:", error);
        res.status(500).send('Server Error');
    }
};

export const toggleBlock = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin accounts cannot be blocked.'
            });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({
            success: true,
            isBlocked: user.isBlocked
        });

    } catch (error) {
        console.error("toggleBlock Error:", error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin accounts cannot be blocked.'
            });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({
            success: true,
            isBlocked: user.isBlocked
        });

    } catch (error) {
        console.error("blockUser Error:", error);
        res.status(500).json({
            success: false,
            message: 'Error updating user status'
        });
    }
};
