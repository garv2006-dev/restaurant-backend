require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');

(async () => {
  try {
    await connectDB();

    const email = process.env.ADMIN_EMAIL || 'admin@restaurant.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';
    const phone = process.env.ADMIN_PHONE || '9999999999';

    let user = await User.findOne({ email });
    if (user) {
      user.role = 'admin';
      if (user.phone == null) user.phone = phone;
      await user.save();
      console.log(`✅ Existing user promoted to admin: ${email}`);
    } else {
      user = await User.create({
        name: 'Administrator',
        email,
        phone,
        password,
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
      });
      console.log(`✅ Admin user created: ${email}`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create admin:', err);
    process.exit(1);
  }
})();
