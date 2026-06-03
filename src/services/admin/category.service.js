import Category from '../../models/category.js';

// Helper to escape regex special characters
const escapeRegex = (string) => {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
};

/**
 * 1. List categories with search, pagination, and sorting.
 */
export const listCategories = async ({ search = '', page = 1, limit = 10, sort = 'desc', status = 'all' }) => {
    const cleanSearch = (search || '').trim();
    const cleanPage   = Math.max(1, parseInt(page) || 1);
    const cleanLimit  = Math.max(1, parseInt(limit) || 10);
    const skip        = (cleanPage - 1) * cleanLimit;

    const query = { isDeleted: false };
    if (cleanSearch) {
        query.name = { $regex: escapeRegex(cleanSearch), $options: 'i' };
    }

    if (status === 'listed') {
        query.isListed = true;
    } else if (status === 'hidden') {
        query.isListed = false;
    }

    // Sorting logic
    let sortQuery = { createdAt: -1 }; // default: newest first
    if (sort === 'asc') sortQuery = { createdAt: 1 };
    if (sort === 'az')  sortQuery = { name: 1 };
    if (sort === 'za')  sortQuery = { name: -1 };

    const [categories, total, totalListed, totalHidden, totalDeleted] = await Promise.all([
        Category.find(query).sort(sortQuery).skip(skip).limit(cleanLimit).lean(),
        Category.countDocuments(query),
        Category.countDocuments({ isListed: true,  isDeleted: false }),
        Category.countDocuments({ isListed: false, isDeleted: false }),
        Category.countDocuments({ isDeleted: true })
    ]);

    return {
        categories,
        total,
        totalPages: Math.ceil(total / cleanLimit),
        currentPage: cleanPage,
        limit: cleanLimit,
        search: cleanSearch,
        status,
        totalListed,
        totalHidden,
        totalDeleted
    };
};

/**
 * 2. Get a single category by ID.
 */
export const getCategory = async (id) => {
    const category = await Category.findOne({ _id: id, isDeleted: false }).lean();
    if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
    }
    return category;
};

/**
 * 3. Create a new category with Duplicate Check.
 */
export const createCategory = async ({ name, description, image, isListed = true }) => {
    const cleanName        = (name || '').trim();
    const cleanDescription = (description || '').trim();

    if (!cleanName) {
        const error = new Error('Category name is required.');
        error.validationErrors = { name: 'Category name is required.' };
        throw error;
    }

    // Case-insensitive duplicate check
    const duplicate = await Category.findOne({
        name: { $regex: `^${escapeRegex(cleanName)}$`, $options: 'i' },
        isDeleted: false
    });

    if (duplicate) {
        const error = new Error('A category with this name already exists.');
        error.validationErrors = { name: 'A category with this name already exists.' };
        throw error;
    }

    const newCategory = new Category({
        name: cleanName,
        description: cleanDescription,
        image: image || '',
        isListed: !!isListed
    });

    await newCategory.save();
    return newCategory;
};

/**
 * 4. Toggle Category Visibility (Hide / Show)
 */
export const toggleCategoryStatus = async (id) => {
    const category = await Category.findById(id);
    if (!category) throw new Error('Category not found');

    category.isListed = !category.isListed;
    return await category.save();
};

/**
 * 5. Update an existing category.
 */
export const updateCategory = async (id, { name, description, image, isListed }) => {
    const cleanName        = (name || '').trim();
    const cleanDescription = (description || '').trim();

    if (!cleanName) {
        const error = new Error('Category name is required.');
        error.validationErrors = { name: 'Category name is required.' };
        throw error;
    }

    const duplicate = await Category.findOne({
        name: { $regex: `^${escapeRegex(cleanName)}$`, $options: 'i' },
        isDeleted: false,
        _id: { $ne: id }
    });

    if (duplicate) {
        const error = new Error('A category with this name already exists.');
        error.validationErrors = { name: 'A category with this name already exists.' };
        throw error;
    }

    const updateFields = { name: cleanName, description: cleanDescription };
    if (typeof isListed !== 'undefined') updateFields.isListed = !!isListed;
    if (typeof image    !== 'undefined') updateFields.image    = image;

    const updated = await Category.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: updateFields },
        { returnDocument: 'after', runValidators: false }
    );

    if (!updated) {
        const error = new Error('Category not found.');
        error.statusCode = 404;
        throw error;
    }

    return updated;
};

/**
 * 6. Soft delete a category.
 */
export const deleteCategory = async (id) => {
    const deleted = await Category.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: { isDeleted: true } },
        { returnDocument: 'after' }
    );

    if (!deleted) {
        const error = new Error('Category not found.');
        error.statusCode = 404;
        throw error;
    }

    return deleted;
};