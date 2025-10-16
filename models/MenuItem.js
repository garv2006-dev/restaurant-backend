const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a menu item name'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Please add a description'],
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    category: {
        type: String,
        required: [true, 'Please add a category'],
        enum: [
            'Appetizers',
            'Main Course',
            'Desserts',
            'Beverages',
            'Breakfast',
            'Lunch',
            'Dinner',
            'Snacks',
            'Alcoholic Beverages',
            'Non-Alcoholic Beverages'
        ]
    },
    subcategory: {
        type: String,
        required: false
    },
    price: {
        type: Number,
        required: [true, 'Please add a price'],
        min: 0
    },
    discountPrice: {
        type: Number,
        min: 0
    },
    cuisine: {
        type: String,
        enum: [
            'Indian',
            'Chinese',
            'Italian',
            'Continental',
            'Mexican',
            'Thai',
            'Japanese',
            'Mediterranean',
            'American',
            'French'
        ]
    },
    dietaryInfo: {
        isVegetarian: {
            type: Boolean,
            default: false
        },
        isVegan: {
            type: Boolean,
            default: false
        },
        isGlutenFree: {
            type: Boolean,
            default: false
        },
        isDairyFree: {
            type: Boolean,
            default: false
        },
        isKeto: {
            type: Boolean,
            default: false
        },
        isSpicy: {
            type: Boolean,
            default: false
        },
        spiceLevel: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        }
    },
    nutritionalInfo: {
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number,
        fiber: Number,
        sugar: Number,
        sodium: Number
    },
    ingredients: [{
        name: {
            type: String,
            required: true
        },
        quantity: String,
        allergen: {
            type: Boolean,
            default: false
        }
    }],
    allergens: [{
        type: String,
        enum: [
            'Gluten',
            'Dairy',
            'Eggs',
            'Nuts',
            'Peanuts',
            'Soy',
            'Shellfish',
            'Fish',
            'Sesame'
        ]
    }],
    preparationTime: {
        type: Number, // in minutes
        required: true,
        min: 1,
        max: 120
    },
    servingSize: {
        type: String,
        required: true
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        altText: String,
        isPrimary: {
            type: Boolean,
            default: false
        }
    }],
    availability: {
        isAvailable: {
            type: Boolean,
            default: true
        },
        availableDays: [{
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        }],
        availableHours: {
            start: String, // Format: "HH:MM"
            end: String    // Format: "HH:MM"
        },
        seasonalAvailability: [{
            season: String,
            startDate: Date,
            endDate: Date
        }]
    },
    popularity: {
        orderCount: {
            type: Number,
            default: 0
        },
        averageRating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        totalReviews: {
            type: Number,
            default: 0
        }
    },
    chef: {
        name: String,
        specialty: String
    },
    tags: [String],
    isSignatureDish: {
        type: Boolean,
        default: false
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for better performance
MenuItemSchema.index({ category: 1 });
MenuItemSchema.index({ price: 1 });
MenuItemSchema.index({ 'dietaryInfo.isVegetarian': 1 });
MenuItemSchema.index({ 'dietaryInfo.isVegan': 1 });
MenuItemSchema.index({ 'availability.isAvailable': 1 });
MenuItemSchema.index({ isActive: 1 });
MenuItemSchema.index({ name: 'text', description: 'text' });

// Method to check if item is available at given time
MenuItemSchema.methods.isAvailableAt = function(date, time) {
    if (!this.availability.isAvailable || !this.isActive) {
        return false;
    }

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Check if available on this day
    if (this.availability.availableDays.length > 0 && 
        !this.availability.availableDays.includes(dayName)) {
        return false;
    }

    // Check seasonal availability
    if (this.availability.seasonalAvailability.length > 0) {
        const isInSeason = this.availability.seasonalAvailability.some(season => 
            date >= season.startDate && date <= season.endDate
        );
        if (!isInSeason) return false;
    }

    // Check time availability
    if (this.availability.availableHours.start && this.availability.availableHours.end) {
        const startTime = this.availability.availableHours.start;
        const endTime = this.availability.availableHours.end;
        
        if (time < startTime || time > endTime) {
            return false;
        }
    }

    return true;
};

// Method to update popularity stats
MenuItemSchema.methods.updatePopularity = async function() {
    const Booking = mongoose.model('Booking');
    
    const stats = await Booking.aggregate([
        { $unwind: '$pricing.menuItems' },
        { $match: { 'pricing.menuItems.item': this._id } },
        {
            $group: {
                _id: '$pricing.menuItems.item',
                totalOrders: { $sum: '$pricing.menuItems.quantity' }
            }
        }
    ]);
    
    if (stats.length > 0) {
        this.popularity.orderCount = stats[0].totalOrders;
        await this.save();
    }
};

// Method to update average rating
MenuItemSchema.methods.updateAverageRating = async function() {
    const Review = mongoose.model('Review');
    
    const stats = await Review.aggregate([
        { $match: { menuItem: this._id, isApproved: true } },
        { $group: { _id: '$menuItem', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    
    if (stats.length > 0) {
        this.popularity.averageRating = Math.round(stats[0].avgRating * 10) / 10;
        this.popularity.totalReviews = stats[0].count;
    } else {
        this.popularity.averageRating = 0;
        this.popularity.totalReviews = 0;
    }
    
    await this.save();
};

// Static method to get popular items
MenuItemSchema.statics.getPopularItems = function(limit = 10) {
    return this.find({ isActive: true })
        .sort({ 'popularity.orderCount': -1, 'popularity.averageRating': -1 })
        .limit(limit);
};

// Static method to search items
MenuItemSchema.statics.searchItems = function(query, filters = {}) {
    let searchQuery = { isActive: true };
    
    // Text search
    if (query) {
        searchQuery.$text = { $search: query };
    }
    
    // Apply filters
    if (filters.category) {
        searchQuery.category = filters.category;
    }
    
    if (filters.cuisine) {
        searchQuery.cuisine = filters.cuisine;
    }
    
    if (filters.minPrice || filters.maxPrice) {
        searchQuery.price = {};
        if (filters.minPrice) searchQuery.price.$gte = filters.minPrice;
        if (filters.maxPrice) searchQuery.price.$lte = filters.maxPrice;
    }
    
    if (filters.isVegetarian) {
        searchQuery['dietaryInfo.isVegetarian'] = true;
    }
    
    if (filters.isVegan) {
        searchQuery['dietaryInfo.isVegan'] = true;
    }
    
    if (filters.isGlutenFree) {
        searchQuery['dietaryInfo.isGlutenFree'] = true;
    }
    
    return this.find(searchQuery);
};

module.exports = mongoose.model('MenuItem', MenuItemSchema);