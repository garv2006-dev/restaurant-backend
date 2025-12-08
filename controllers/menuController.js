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
            limit = 20,
        } = req.query;

        // Base query should match schema fields
        // Only return items that are marked active and available
        const query = {
            isActive: true,
            'availability.isAvailable': true,
        };

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

        // Filter by dietary preferences (nested fields in schema)
        if (isVegetarian === 'true') {
            query['dietaryInfo.isVegetarian'] = true;
        }
        if (isVegan === 'true') {
            query['dietaryInfo.isVegan'] = true;
        }

        // Search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                {
                    ingredients: {
                        $elemMatch: {
                            name: { $regex: search, $options: 'i' },
                        },
                    },
                },
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
                    sortOptions = { 'popularity.averageRating': -1 };
                    break;
                case 'popular':
                    sortOptions = { 'popularity.orderCount': -1 };
                    break;
                default:
                    sortOptions = { name: 1 };
            }
        } else {
            sortOptions = { category: 1, name: 1 };
        }

        // Pagination
        const numericPage = Number(page) || 1;
        const numericLimit = Number(limit) || 20;
        const skip = (numericPage - 1) * numericLimit;

        const menuItems = await MenuItem.find(query)
            .sort(sortOptions)
            .limit(numericLimit)
            .skip(skip);

        const total = await MenuItem.countDocuments(query);

        // Response shape expected by frontend: { success: true, items: [...] }
        res.status(200).json({
            success: true,
            items: menuItems,
            count: menuItems.length,
            total,
            pagination: {
                page: numericPage,
                limit: numericLimit,
                pages: Math.ceil(total / numericLimit) || 1,
            },
        });
    } catch (error) {
        console.error('Get menu items error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
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
        const {
            itemName,
            name,
            category,
            price,
            preparationTime,
            servingSize,
            imageUrl,
            description,
            ingredients,
            allergens,
            tags,
            dietaryInfo,
            availability,
            images,
        } = req.body;

        const payload = {};

        // Basic fields (support both itemName and name)
        payload.name = name || itemName;
        payload.category = category;
        payload.price = price;
        payload.preparationTime = preparationTime;
        payload.servingSize = servingSize;
        payload.description = description;

        // Ingredients: accept comma-separated or array
        if (Array.isArray(ingredients)) {
            payload.ingredients = ingredients.map((ing) =>
                typeof ing === 'string' ? { name: ing } : ing
            );
        } else if (typeof ingredients === 'string') {
            payload.ingredients = ingredients
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((name) => ({ name }));
        }

        // Allergens: accept comma-separated or array
        if (Array.isArray(allergens)) {
            payload.allergens = allergens;
        } else if (typeof allergens === 'string') {
            payload.allergens = allergens
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }

        // Dietary & availability tags: accept tags object or nested dietaryInfo/availability
        const mergedDietary = {
            isVegetarian: false,
            isVegan: false,
            isGlutenFree: false,
            isDairyFree: false,
            isKeto: false,
            isSpicy: false,
            ...(dietaryInfo || {}),
        };

        const mergedAvailability = {
            isAvailable: true,
            ...(availability || {}),
        };

        if (tags && typeof tags === 'object') {
            if (typeof tags.vegetarian === 'boolean') mergedDietary.isVegetarian = tags.vegetarian;
            if (typeof tags.vegan === 'boolean') mergedDietary.isVegan = tags.vegan;
            if (typeof tags.glutenFree === 'boolean') mergedDietary.isGlutenFree = tags.glutenFree;
            if (typeof tags.dairyFree === 'boolean') mergedDietary.isDairyFree = tags.dairyFree;
            if (typeof tags.spicy === 'boolean') mergedDietary.isSpicy = tags.spicy;
            if (typeof tags.available === 'boolean') mergedAvailability.isAvailable = tags.available;
        }

        payload.dietaryInfo = mergedDietary;
        payload.availability = {
            ...mergedAvailability,
        };

        // Images: support either imageUrl string or images array
        if (Array.isArray(images) && images.length > 0) {
            payload.images = images.map((img, index) => ({
                url: img.url || img,
                altText: img.altText || payload.name,
                isPrimary: index === 0,
            }));
        } else if (typeof imageUrl === 'string' && imageUrl.trim()) {
            payload.images = [{
                url: imageUrl.trim(),
                altText: payload.name,
                isPrimary: true,
            }];
        } else if (req.body.images && Array.isArray(req.body.images) && req.body.images.length > 0) {
            payload.images = req.body.images;
        }

        // Fallback to request body for any additional optional fields
        const extraFields = ['subcategory', 'discountPrice', 'cuisine', 'nutritionalInfo', 'tags', 'isSignatureDish', 'isFeatured'];
        extraFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                payload[field] = req.body[field];
            }
        });

        // Validate core required fields before hitting Mongoose.
        // Images are optional here; schema already enforces url on individual image docs.
        const missing = [];
        if (!payload.name) missing.push('name');
        if (!payload.category) missing.push('category');
        if (payload.price === undefined) missing.push('price');
        if (payload.preparationTime === undefined) missing.push('preparationTime');
        if (!payload.servingSize) missing.push('servingSize');
        if (!payload.description) missing.push('description');

        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`,
            });
        }

        const menuItem = await MenuItem.create(payload);

        res.status(201).json({
            success: true,
            message: 'Menu item added',
            item: menuItem,
        });

    } catch (error) {
        console.error('Create menu item error:', error);

        // Mongoose validation error
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', '),
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server Error',
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