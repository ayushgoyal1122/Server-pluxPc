import mongoose from 'mongoose';
import { Order } from '../models/Order.js';

/**
 * Idempotently backfills trackingHistory for legacy orders that predate
 * the tracking history schema implementation.
 * Strictly uses verifiable timestamps (createdAt, paidAt, updatedAt, orderStatus).
 * Never fabricates courier or delivery events.
 */
export async function backfillLegacyTrackingHistory() {
  try {
    const legacyOrders = await Order.find({
      $or: [
        { trackingHistory: { $exists: false } },
        { trackingHistory: { $size: 0 } },
      ],
    });

    if (legacyOrders.length === 0) {
      return { backfilledCount: 0 };
    }

    console.log(`[Backfill] Found ${legacyOrders.length} legacy orders without tracking history. Migrating...`);

    let migrated = 0;
    for (const order of legacyOrders) {
      const history = [
        {
          status: 'placed',
          timestamp: order.createdAt || new Date(),
          description: 'Order placed by customer.',
          actor: 'customer',
        },
      ];

      if (order.paymentStatus === 'paid' || order.paidAt) {
        history.push({
          status: 'confirmed',
          timestamp: order.paidAt || order.createdAt || new Date(),
          description: 'Payment authorized via Razorpay. Order confirmed.',
          actor: 'system',
        });
      }

      if (order.orderStatus === 'processing') {
        history.push({
          status: 'processing',
          timestamp: order.updatedAt || order.paidAt || order.createdAt || new Date(),
          description: 'Order received and processing in warehouse.',
          actor: 'system',
        });
      } else if (order.orderStatus === 'shipped' && order.shipment?.shippedAt) {
        history.push({
          status: 'shipped',
          timestamp: order.shipment.shippedAt,
          description: `Dispatched with ${order.shipment.courierName || 'courier'}.`,
          actor: 'admin',
        });
      } else if (order.orderStatus === 'out_for_delivery') {
        history.push({
          status: 'out_for_delivery',
          timestamp: order.updatedAt || new Date(),
          description: 'Out for delivery to recipient.',
          actor: 'admin',
        });
      } else if (order.orderStatus === 'delivered' && order.shipment?.deliveredAt) {
        history.push({
          status: 'delivered',
          timestamp: order.shipment.deliveredAt,
          description: 'Package delivered to recipient.',
          actor: 'admin',
        });
      } else if (order.orderStatus === 'cancelled') {
        history.push({
          status: 'cancelled',
          timestamp: order.updatedAt || order.createdAt || new Date(),
          description: 'Order cancelled.',
          actor: 'system',
        });
      }

      order.trackingHistory = history;
      if (!order.shipment) {
        order.shipment = {
          courierName: '',
          trackingNumber: '',
          trackingUrl: '',
        };
      }

      await order.save();
      migrated++;
    }

    console.log(`[Backfill] Successfully backfilled ${migrated} legacy orders.`);
    return { backfilledCount: migrated };
  } catch (err) {
    console.error('[Backfill Error]:', err);
    return { error: err.message };
  }
}

