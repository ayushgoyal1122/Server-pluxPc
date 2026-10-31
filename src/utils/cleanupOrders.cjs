const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function runCleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // 1. Verify preserved order before deletion
  const preservedOrder = await db.collection('orders').findOne({ orderNumber: 'VO-278301-4806' });
  if (!preservedOrder) {
    throw new Error('CRITICAL: Order VO-278301-4806 not found in database!');
  }

  const user = await db.collection('users').findOne({ _id: preservedOrder.customer });
  console.log('--- PRESERVED ORDER VERIFICATION ---');
  console.log('Order Number:', preservedOrder.orderNumber);
  console.log('Customer Email:', user ? user.email : 'N/A');
  console.log('Customer Name:', user ? user.name : 'N/A');
  console.log('Amount:', preservedOrder.total);
  console.log('Order Status:', preservedOrder.orderStatus);
  console.log('Payment Status:', preservedOrder.paymentStatus);
  console.log('Payment ID:', preservedOrder.razorpayPaymentId);
  console.log('Tracking History Length:', preservedOrder.trackingHistory ? preservedOrder.trackingHistory.length : 0);

  // 2. Count orders to delete
  const toDeleteCount = await db.collection('orders').countDocuments({ orderNumber: { $ne: 'VO-278301-4806' } });
  console.log('\nOrders targeted for deletion:', toDeleteCount);

  if (toDeleteCount !== 20) {
    throw new Error('Expected 20 orders to delete, found ' + toDeleteCount);
  }

  // 3. Delete non-preserved orders
  const deleteResult = await db.collection('orders').deleteMany({ orderNumber: { $ne: 'VO-278301-4806' } });
  console.log('Deleted count from MongoDB:', deleteResult.deletedCount);

  // 4. Verify remaining orders
  const remainingOrders = await db.collection('orders').find({}).toArray();
  console.log('\n--- POST-CLEANUP VERIFICATION ---');
  console.log('Total remaining orders in collection:', remainingOrders.length);
  if (remainingOrders.length !== 1) {
    throw new Error('CRITICAL: Expected exactly 1 remaining order, found ' + remainingOrders.length);
  }

  const remaining = remainingOrders[0];
  console.log('Remaining order number:', remaining.orderNumber);
  console.log('Matches VO-278301-4806:', remaining.orderNumber === 'VO-278301-4806');
  console.log('Payment Status intact:', remaining.paymentStatus);
  console.log('Order Status intact:', remaining.orderStatus);
  console.log('Items:', JSON.stringify(remaining.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price }))));
  console.log('Tracking Events count intact:', remaining.trackingHistory ? remaining.trackingHistory.length : 0);

  await mongoose.disconnect();
}

runCleanup().catch(err => {
  console.error('[Cleanup Error]:', err);
  process.exit(1);
});

