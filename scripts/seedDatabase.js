const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Room = require('../models/Room');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const Discount = require('../models/Discount');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel_booking');
    console.log('✅ MongoDB Connected for seeding');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const seedUsers = async () => {
  try {
    // Clear existing users
    await User.deleteMany({});

    const users = [
      {
        name: 'Admin User',
        email: 'admin@hotel.com',
        phone: '+1234567890',
        password: 'Admin123!',
        role: 'admin',
        isEmailVerified: true,
        isActive: true
      },
      {
        name: 'Staff Member',
        email: 'staff@restaurant.com',
        phone: '+1234567891',
        password: 'Staff123!',
        role: 'staff',
        isEmailVerified: true,
        isActive: true
      },
      {
        name: 'John Customer',
        email: 'customer@example.com',
        phone: '+1234567892',
        password: 'Customer123!',
        role: 'customer',
        isEmailVerified: true,
        isActive: true,
        loyaltyPoints: 150
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1234567893',
        password: 'Customer123!',
        role: 'customer',
        isEmailVerified: true,
        isActive: true,
        loyaltyPoints: 75
      }
    ];

    for (const userData of users) {
      const user = new User(userData);
      await user.save();
    }

    console.log('✅ Users seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding users:', error.message);
  }
};

const seedRooms = async () => {
  try {
    // Clear existing rooms
    await Room.deleteMany({});

    const rooms = [
      {
        name: 'Deluxe Private Dining',
        type: 'Private Dining',
        roomNumber: 'PD-001',
        capacity: 8,
        basePrice: 2500,
        description: 'Elegant private dining room perfect for intimate gatherings and business meetings.',
        amenities: ['Air Conditioning', 'WiFi', 'TV', 'Sound System', 'Private Washroom'],
        features: {
          hasProjector: true,
          hasWhiteboard: true,
          hasVideoConference: true,
          hasPrivateEntrance: true
        },
        images: ['room1.jpg', 'room1-2.jpg'],
        isActive: true,
        status: 'Available'
      },
      {
        name: 'Executive Boardroom',
        type: 'Conference Room',
        roomNumber: 'CR-002',
        capacity: 12,
        basePrice: 3500,
        description: 'Professional conference room with state-of-the-art technology for corporate events.',
        amenities: ['Air Conditioning', 'WiFi', 'Projector', 'Video Conference', 'Catering Service'],
        features: {
          hasProjector: true,
          hasWhiteboard: true,
          hasVideoConference: true,
          hasPrivateEntrance: false
        },
        images: ['room2.jpg'],
        isActive: true,
        status: 'Available'
      },
      {
        name: 'Garden Pavilion',
        type: 'Event Space',
        roomNumber: 'ES-003',
        capacity: 50,
        basePrice: 8000,
        description: 'Beautiful outdoor pavilion surrounded by gardens, perfect for celebrations.',
        amenities: ['Garden View', 'Open Air', 'Stage Area', 'Sound System', 'Catering Kitchen'],
        features: {
          hasProjector: false,
          hasWhiteboard: false,
          hasVideoConference: false,
          hasPrivateEntrance: true
        },
        images: ['room3.jpg'],
        isActive: true,
        status: 'Available'
      },
      {
        name: 'Cozy Corner Booth',
        type: 'Dining Booth',
        roomNumber: 'DB-004',
        capacity: 4,
        basePrice: 1200,
        description: 'Intimate corner booth for romantic dinners and small family gatherings.',
        amenities: ['Ambient Lighting', 'Music Control', 'Privacy Screen'],
        features: {
          hasProjector: false,
          hasWhiteboard: false,
          hasVideoConference: false,
          hasPrivateEntrance: false
        },
        images: ['room4.jpg'],
        isActive: true,
        status: 'Available'
      },
      {
        name: 'Rooftop Terrace',
        type: 'Event Space',
        roomNumber: 'ES-005',
        capacity: 30,
        basePrice: 6000,
        description: 'Stunning rooftop terrace with city views, ideal for cocktail parties and receptions.',
        amenities: ['City View', 'Bar Counter', 'Outdoor Heating', 'Sound System'],
        features: {
          hasProjector: false,
          hasWhiteboard: false,
          hasVideoConference: false,
          hasPrivateEntrance: true
        },
        images: ['room5.jpg'],
        isActive: true,
        status: 'Occupied'
      }
    ];

    await Room.insertMany(rooms);
    console.log('✅ Rooms seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding rooms:', error.message);
  }
};


const seedLoyaltyProgram = async () => {
  try {
    // Clear existing loyalty programs
    await LoyaltyProgram.deleteMany({});

    const loyaltyProgram = {
      name: 'Gold Diner Rewards',
      description: 'Earn points with every booking and redeem for amazing rewards!',
      pointsPerRupee: 1,
      isActive: true,
      rewards: [
        {
          name: '10% Off Your Next Booking',
          pointsRequired: 100,
          discountType: 'percentage',
          discountValue: 10,
          description: 'Get 10% off your next room booking',
          isActive: true
        },
        {
          name: 'Free Appetizer',
          pointsRequired: 150,
          discountType: 'fixed',
          discountValue: 450,
          description: 'Complimentary appetizer with your meal',
          isActive: true
        },
        {
          name: 'VIP Room Upgrade',
          pointsRequired: 300,
          discountType: 'percentage',
          discountValue: 50,
          description: 'Upgrade to a premium room at 50% off',
          isActive: true
        }
      ],
      tiers: [
        {
          name: 'Bronze',
          minimumPoints: 0,
          benefits: {
            extraPointsMultiplier: 1,
            priorityBooking: false,
            specialOffers: false
          }
        },
        {
          name: 'Silver',
          minimumPoints: 500,
          benefits: {
            extraPointsMultiplier: 1.2,
            priorityBooking: true,
            specialOffers: false
          }
        },
        {
          name: 'Gold',
          minimumPoints: 1000,
          benefits: {
            extraPointsMultiplier: 1.5,
            priorityBooking: true,
            specialOffers: true
          }
        }
      ]
    };

    await LoyaltyProgram.create(loyaltyProgram);
    console.log('✅ Loyalty program seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding loyalty program:', error.message);
  }
};

const seedDiscounts = async () => {
  try {
    // Clear existing discounts
    await Discount.deleteMany({});

    const discounts = [
      {
        code: 'WELCOME10',
        name: 'Welcome Discount',
        description: 'Special discount for new customers',
        type: 'percentage',
        value: 10,
        minOrderAmount: 1000,
        maxDiscount: 500,
        usageLimit: {
          total: 100,
          perUser: 1
        },
        userLimit: 1,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        applicableFor: 'all',
        restrictions: {
          firstTimeOnly: true,
          loyaltyTierRequired: '',
          dayOfWeekRestrictions: []
        }
      },
      {
        code: 'WEEKEND20',
        name: 'Weekend Special',
        description: '20% off on weekend bookings',
        type: 'percentage',
        value: 20,
        minOrderAmount: 2000,
        maxDiscount: 1000,
        usageLimit: {
          total: 50,
          perUser: 2
        },
        userLimit: 2,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        applicableFor: 'rooms',
        restrictions: {
          firstTimeOnly: false,
          loyaltyTierRequired: '',
          dayOfWeekRestrictions: ['Saturday', 'Sunday']
        }
      },
      {
        code: 'FAMILY500',
        name: 'Family Dinner Deal',
        description: 'Fixed discount for family bookings',
        type: 'fixed',
        value: 500,
        minOrderAmount: 3000,
        maxDiscount: 500,
        usageLimit: {
          total: 30,
          perUser: 1
        },
        userLimit: 1,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        applicableFor: 'all',
        restrictions: {
          firstTimeOnly: false,
          loyaltyTierRequired: '',
          dayOfWeekRestrictions: []
        }
      }
    ];

    await Discount.insertMany(discounts);
    console.log('✅ Discounts seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding discounts:', error.message);
  }
};

const seedDatabase = async () => {
  try {
    await connectDB();
    
    console.log('🌱 Starting database seeding...');
    
    await seedUsers();
    await seedRooms();
    await seedLoyaltyProgram();
    await seedDiscounts();
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('👨‍💼 Admin Credentials:');
    console.log('   Email: admin@hotel.com');
    console.log('   Password: Admin123!');
    console.log('');
    console.log('👥 Staff Credentials:');
    console.log('   Email: staff@restaurant.com');
    console.log('   Password: Staff123!');
    console.log('');
    console.log('👤 Customer Credentials:');
    console.log('   Email: customer@example.com');
    console.log('   Password: Customer123!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;