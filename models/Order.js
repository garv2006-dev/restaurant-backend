const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    items: {
      type: [OrderItemSchema],
      validate: [arr => arr.length > 0, 'Order must contain at least one item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxes: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'card', 'upi'],
      default: 'cod',
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Cancelled'],
      default: 'Pending',
    },
    orderNumber: {
      type: String,
      unique: true,
    },
    notes: String,
  },
  { timestamps: true }
);

OrderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `ORD-${ts}-${rnd}`;
  }
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
