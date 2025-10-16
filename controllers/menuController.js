const MenuItem = require('../models/MenuItem');

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
const getMenuItems = async (req, res) => {
    try {
        const {
            category,
            minPrice,
            maxPrice,
            isVegetarian,
            isVegan,
            search,
            sort,
            page = 1,
            limit = 20
        } = req.query;

        let query = { isAvailable: true };

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Filter by price range
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        // Filter by dietary preferences
        if (isVegetarian === 'true') {
            query.isVegetarian = true;
        }
        if (isVegan === 'true') {
            query.isVegan = true;
        }

        // Search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { ingredients: { $elemMatch: { $regex: search, $options: 'i' } } }
            ];
        }

        // Sorting
        let sortOptions = {};
        if (sort) {
            switch (sort) {
                case 'price_asc':
                    sortOptions = { price: 1 };
                    break;
                case 'price_desc':
                    sortOptions = { price: -1 };
                    break;
                case 'rating':
                    sortOptions = { averageRating: -1 };
                    break;
                case 'popular':
                    sortOptions = { orderCount: -1 };
                    break;
                default:
                    sortOptions = { name: 1 };
            }
        } else {
            sortOptions = { category: 1, name: 1 };
        }

        // Pagination
        const skip = (page - 1) * limit;

        const menuItems = await MenuItem.find(query)
            .sort(sortOptions)
            .limit(Number(limit))
            .skip(skip);

        const total = await MenuItem.countDocuments(query);

        res.status(200).json({
            success: true,
            count: menuItems.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: menuItems
        });

    } catch (error) {
        console.error('Get menu items error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
// @access  Public
const getMenuItem = async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        res.status(200).json({
            success: true,
            data: menuItem
        });

    } catch (error) {
        console.error('Get menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get menu categories
// @route   GET /api/menu/categories
// @access  Public
const getMenuCategories = async (req, res) => {
    try {
        const categories = await MenuItem.distinct('category', { isAvailable: true });
        
        res.status(200).json({
            success: true,
            data: categories
        });

    } catch (error) {
        console.error('Get menu categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Create menu item (Admin only)
// @route   POST /api/menu
// @access  Private/Admin
const createMenuItem = async (req, res) => {
    try {
        const menuItem = await MenuItem.create(req.body);

        res.status(201).json({
            success: true,
            data: menuItem
        });

    } catch (error) {
        console.error('Create menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update menu item (Admin only)
// @route   PUT /api/menu/:id
// @access  Private/Admin
const updateMenuItem = async (req, res) => {
    try {
        const menuItem = await MenuItem.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        res.status(200).json({
            success: true,
            data: menuItem
        });

    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete menu item (Admin only)
// @route   DELETE /api/menu/:id
// @access  Private/Admin
const deleteMenuItem = async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        await menuItem.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Menu item deleted successfully'
        });

    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Toggle menu item availability (Admin only)
// @route   PUT /api/menu/:id/toggle-availability
// @access  Private/Admin
const toggleAvailability = async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        menuItem.isAvailable = !menuItem.isAvailable;
        await menuItem.save();

        res.status(200).json({
            success: true,
            data: menuItem
        });

    } catch (error) {
        console.error('Toggle availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

module.exports = {
    getMenuItems,
    getMenuItem,
    getMenuCategories,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability
};