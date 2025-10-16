const mongoose = require('mongoose');
const Room = require('./models/Room');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant-booking', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const sampleRooms = [
  {
    roomNumber: '101',
    name: 'Deluxe Ocean View',
    type: 'Deluxe',
    description: 'Spacious room with stunning ocean views and modern amenities. Perfect for couples looking for a romantic getaway.',
    capacity: {
      adults: 2,
      children: 1
    },
    bedType: 'King',
    area: 350,
    price: {
      basePrice: 2500,
      weekendPrice: 3000,
      seasonalPricing: []
    },
    amenities: [
      { name: 'Ocean View', icon: '🌊' },
      { name: 'Private Balcony', icon: '🏖️' },
      { name: 'Mini Bar', icon: '🍺' }
    ],
    features: {
      airConditioning: true,
      wifi: true,
      breakfast: true,
      television: true,
      miniBar: true,
      balcony: true,
      seaView: true,
      cityView: false,
      parkingIncluded: true
    },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=500',
        altText: 'Deluxe Ocean View Room',
        isPrimary: true
      }
    ],
    status: 'Available',
    floor: 1,
    isActive: true,
    averageRating: 4.8,
    totalReviews: 24
  },
  {
    roomNumber: '205',
    name: 'Premium Suite',
    type: 'Suite',
    description: 'Luxurious suite with separate living area and premium amenities. Ideal for families or extended stays.',
    capacity: {
      adults: 4,
      children: 2
    },
    bedType: 'King',
    area: 650,
    price: {
      basePrice: 4500,
      weekendPrice: 5000,
      seasonalPricing: []
    },
    amenities: [
      { name: 'Separate Living Area', icon: '🛋️' },
      { name: 'Kitchenette', icon: '🍳' },
      { name: 'Work Desk', icon: '💻' }
    ],
    features: {
      airConditioning: true,
      wifi: true,
      breakfast: true,
      television: true,
      miniBar: true,
      balcony: true,
      seaView: false,
      cityView: true,
      parkingIncluded: true
    },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=500',
        altText: 'Premium Suite',
        isPrimary: true
      }
    ],
    status: 'Available',
    floor: 2,
    isActive: true,
    averageRating: 4.9,
    totalReviews: 18
  },
  {
    roomNumber: '102',
    name: 'Standard Comfort',
    type: 'Standard',
    description: 'Comfortable room with all essential amenities for a pleasant stay. Great value for money.',
    capacity: {
      adults: 2,
      children: 0
    },
    bedType: 'Queen',
    area: 250,
    price: {
      basePrice: 1500,
      weekendPrice: 1800,
      seasonalPricing: []
    },
    amenities: [
      { name: 'Garden View', icon: '🌿' },
      { name: 'Work Desk', icon: '💻' }
    ],
    features: {
      airConditioning: true,
      wifi: true,
      breakfast: false,
      television: true,
      miniBar: false,
      balcony: false,
      seaView: false,
      cityView: false,
      parkingIncluded: false
    },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=500',
        altText: 'Standard Comfort Room',
        isPrimary: true
      }
    ],
    status: 'Available',
    floor: 1,
    isActive: true,
    averageRating: 4.5,
    totalReviews: 32
  },
  {
    roomNumber: '301',
    name: 'Executive Deluxe',
    type: 'Deluxe',
    description: 'Elegantly furnished deluxe room with city views and executive amenities.',
    capacity: {
      adults: 2,
      children: 1
    },
    bedType: 'King',
    area: 400,
    price: {
      basePrice: 3000,
      weekendPrice: 3500,
      seasonalPricing: []
    },
    amenities: [
      { name: 'City View', icon: '🏙️' },
      { name: 'Executive Lounge Access', icon: '🥂' },
      { name: 'Premium Bathroom', icon: '🛁' }
    ],
    features: {
      airConditioning: true,
      wifi: true,
      breakfast: true,
      television: true,
      miniBar: true,
      balcony: true,
      seaView: false,
      cityView: true,
      parkingIncluded: true
    },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=500',
        altText: 'Executive Deluxe Room',
        isPrimary: true
      }
    ],
    status: 'Available',
    floor: 3,
    isActive: true,
    averageRating: 4.7,
    totalReviews: 41
  },
  {
    roomNumber: '103',
    name: 'Garden Standard',
    type: 'Standard',
    description: 'Peaceful standard room overlooking our beautiful gardens.',
    capacity: {
      adults: 2,
      children: 1
    },
    bedType: 'Double',
    area: 280,
    price: {
      basePrice: 1800,
      weekendPrice: 2100,
      seasonalPricing: []
    },
    amenities: [
      { name: 'Garden View', icon: '🌿' },
      { name: 'Reading Corner', icon: '📚' }
    ],
    features: {
      airConditioning: true,
      wifi: true,
      breakfast: false,
      television: true,
      miniBar: false,
      balcony: true,
      seaView: false,
      cityView: false,
      parkingIncluded: true
    },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500',
        altText: 'Garden Standard Room',
        isPrimary: true
      }
    ],
    status: 'Available',
    floor: 1,
    isActive: true,
    averageRating: 4.3,
    totalReviews: 28
  }
];

async function seedRooms() {
  try {
    console.log('🌱 Seeding rooms...');
    
    // Clear existing rooms
    await Room.deleteMany({});
    console.log('Cleared existing rooms');
    
    // Insert sample rooms
    const rooms = await Room.insertMany(sampleRooms);
    console.log(`✅ Successfully created ${rooms.length} rooms`);
    
    rooms.forEach(room => {
      console.log(`- ${room.name} (${room.roomNumber}) - ₹${room.price.basePrice}/night`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding rooms:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

seedRooms();