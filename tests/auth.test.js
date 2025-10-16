const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/restaurant-test');
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Authentication', () => {
  test('Should register new user', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      password: 'Password123!'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
  });

  test('Should login valid user', async () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      password: 'Password123!'
    });
    await user.save();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Password123!' })
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  test('Should reject invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' })
      .expect(401);

    expect(response.body.success).toBe(false);
  });
});