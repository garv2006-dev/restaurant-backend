const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant-booking', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const adminUser = {
  name: 'Admin User',
  email: 'admin@restaurant.com',
  phone: '+1234567890',
  password: 'admin123',
  role: 'admin',
  isEmailVerified: true,
  loyaltyPoints: 0,
  preferences: {
    notifications: {
      email: true,
      sms: false
    },
    theme: 'light',
    language: 'en'
  }
};

async function seedAdmin() {
  try {
    console.log('👤 Creating admin user...');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminUser.email });
    
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log(`Email: ${existingAdmin.email}`);
      console.log('Password: admin123');
      return;
    }
    
    // Create admin user
    const admin = await User.create(adminUser);
    console.log('✅ Successfully created admin user');
    console.log(`Email: ${admin.email}`);
    console.log('Password: admin123');
    console.log('Role: admin');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

seedAdmin();