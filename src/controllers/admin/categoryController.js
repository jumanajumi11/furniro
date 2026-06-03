import * as categoryService from '../../services/admin/category.service.js';
import Category from '../../models/category.js'; 

// =================== LIST CATEGORIES (With Sorting, Search, Pagination) ===================
export const listCategories = async (req, res) => {
    try {
        const search = req.query.search || '';
        const page   = parseInt(req.query.page)  || 1;
        const limit  = parseInt(req.query.limit) || 10;
        const sort   = req.query.sort   || 'desc';   // desc, asc, az, za
        const status = req.query.status || 'all';    // all, listed, hidden
        const totalActive = await Category.countDocuments({ isListed: true }); // ഇത് ചേർക്കുക

        const result = await categoryService.listCategories({ search, page, limit, sort, status });

        res.render('admin/categories', {
            activePage:    'categories',
            categories:    result.categories,
            search:        result.search,
            status:        result.status,
            currentPage:   result.currentPage,
            totalPages:    result.totalPages,
            total:         result.total,
            totalListed:   result.totalListed,
            totalHidden:   result.totalHidden,
            totalDeleted:  result.totalDeleted,
            totalActive:   result.totalListed,
            limit:         result.limit,
            sort:          sort,
            error:         req.query.error   || null,
            success:       req.query.success || null
        });
    } catch (err) {
        console.error('List Categories Error:', err);
        res.status(500).send('Server Error');
    }
};

// =================== CREATE CATEGORY ===================
export const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const isListed = req.body.isListed !== 'false'; // default true
        const image    = req.file ? req.file.filename : '';

        await categoryService.createCategory({ name, description, image, isListed });

        res.json({ success: true, message: 'Category created successfully.' });
    } catch (err) {
        console.error('Create Category Error:', err);
        res.status(400).json({
            success: false,
            message: err.message || 'Server error. Please try again.'
        });
    }
};

// =================== TOGGLE VISIBILITY (Hide / Show) ===================
export const toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        // സർവീസ് വഴി സ്റ്റാറ്റസ് മാറ്റുന്നു
        const updatedCategory = await categoryService.toggleCategoryStatus(id);
        
        // redirect ഒഴിവാക്കി JSON നൽകുക
        return res.status(200).json({ 
            success: true, 
            isListed: updatedCategory.isListed 
        });
    } catch (error) {
        console.error('Toggle Status Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Could not update status' 
        });
    }
};

// =================== UPDATE CATEGORY ===================
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const isListed = req.body.isListed !== 'false'; // default true

        const updateData = { name, description, isListed };
        if (req.file) {
            updateData.image = req.file.filename;
        }

        await categoryService.updateCategory(id, updateData);
        res.json({ success: true, message: 'Category updated successfully.' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};


 export const checkCategoryName = async (req, res) => {
    try {
        const { name } = req.query;
        
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') } 
        });
        
        if (existingCategory) {
            return res.json({ exists: true });
        }
        res.json({ exists: false });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
// =================== DELETE (Soft Delete) ===================
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await categoryService.deleteCategory(id);
        res.json({ success: true, message: 'Category deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
};