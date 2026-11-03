import express from 'express';
import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Enforce admin authentication across all earnings endpoints
router.use(requireAdmin);

/**
 * GET /api/admin/earnings
 * Fetches revenue metrics (Total Revenue, Today's Revenue) and searchable, paginated transactions.
 */
router.get('/', async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // 1. Calculate Total Revenue & Today's Revenue from verified paid orders
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [revenueAgg] = await Order.aggregate([
      {
        $facet: {
          totalRevenue: [
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, sum: { $sum: '$total' }, count: { $sum: 1 } } },
          ],
          todayRevenue: [
            {
              $match: {
                paymentStatus: 'paid',
                $or: [
                  { paidAt: { $gte: todayStart } },
                  { createdAt: { $gte: todayStart } },
                ],
              },
            },
            { $group: { _id: null, sum: { $sum: '$total' }, count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const totalRevenue = revenueAgg?.totalRevenue?.[0]?.sum || 0;
    const todayRevenue = revenueAgg?.todayRevenue?.[0]?.sum || 0;

    // 2. Build filter for searchable transactions table
    const filter = {};

    if (q && q.trim()) {
      const searchTrim = q.trim();
      const searchRegex = new RegExp(searchTrim, 'i');

      // Search matching users by name or email
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      })
        .select('_id')
        .lean();

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { razorpayPaymentId: searchRegex },
        { orderNumber: searchRegex },
        { 'deliveryAddress.fullName': searchRegex },
        { 'deliveryAddress.phone': searchRegex },
        { customer: { $in: userIds } },
      ];
    }

    // 3. Query transactions sorted by newest first
    const [rawOrders, totalTransactions] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email avatar isDeleted createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    // Format transactions to match reference table
    const transactions = rawOrders.map((order, index) => {
      // Calculate total item quantity for this order
      const itemsCount = Array.isArray(order.items)
        ? order.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
        : 0;

      const customerObj = order.customer && typeof order.customer === 'object' ? order.customer : null;
      const customerId = customerObj?._id?.toString() || order.customer?.toString() || '';
      const customerName = customerObj?.name || order.deliveryAddress?.fullName || 'Customer';
      const customerEmail = customerObj?.email || '';

      return {
        sNo: skip + index + 1,
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        transactionId: order.razorpayPaymentId || order.orderNumber,
        paymentId: order.razorpayPaymentId || null,
        user: {
          id: customerId,
          name: customerName,
          email: customerEmail,
          avatar: customerObj?.avatar || '',
        },
        itemsCount,
        itemsSummary: (order.items || []).map((i) => ({
          name: i.name,
          quantity: i.quantity,
          imageUrl: i.imageUrl,
          price: i.price,
          subtotal: i.subtotal,
        })),
        amount: order.total || 0,
        currency: order.currency || 'INR',
        paymentStatus: order.paymentStatus || 'pending',
        orderStatus: order.orderStatus || 'placed',
        purchasedAt: order.paidAt || order.createdAt,
        createdAt: order.createdAt,
      };
    });

    res.json({
      success: true,
      totalRevenue,
      todayRevenue,
      totalTransactions,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalTransactions / limitNum) || 1,
      transactions,
    });
  } catch (err) {
    console.error('[Admin Manage Earning Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve earnings and transactions data.',
    });
  }
});

/**
 * GET /api/admin/earnings/users/:userId
 * Fetches user profile, e-commerce summary statistics, and purchase history.
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    // 1. Fetch user profile
    const user = await User.findById(userId).select('-passwordHash').lean();

    // Fetch all orders placed by this customer
    const orders = await Order.find({ customer: userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!user && orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found in system records.',
      });
    }

    const fallbackName = orders[0]?.deliveryAddress?.fullName || 'Customer';
    const fallbackEmail = orders[0]?.customer?.email || '';

    // 2. Compute e-commerce summary statistics
    const totalOrders = orders.length;
    let totalItemsPurchased = 0;
    let totalSpent = 0;
    let paidOrdersCount = 0;

    const purchaseHistory = orders.map((order) => {
      const orderItems = Array.isArray(order.items) ? order.items : [];
      const orderItemCount = orderItems.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

      totalItemsPurchased += orderItemCount;

      if (order.paymentStatus === 'paid') {
        totalSpent += order.total || 0;
        paidOrdersCount += 1;
      }

      return {
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        transactionId: order.razorpayPaymentId || order.orderNumber,
        itemsCount: orderItemCount,
        amount: order.total || 0,
        currency: order.currency || 'INR',
        paymentStatus: order.paymentStatus || 'pending',
        orderStatus: order.orderStatus || 'placed',
        items: orderItems.map((item) => ({
          name: item.name,
          slug: item.slug,
          imageUrl: item.imageUrl,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
        purchasedAt: order.paidAt || order.createdAt,
        createdAt: order.createdAt,
      };
    });

    const userProfile = {
      id: user?._id?.toString() || userId,
      name: user?.name || fallbackName,
      email: user?.email || fallbackEmail,
      avatar: user?.avatar || '',
      role: user?.role || 'customer',
      status: user?.isDeleted ? 'Inactive' : 'Active',
      isDeleted: Boolean(user?.isDeleted),
      memberSince: user?.createdAt || orders[orders.length - 1]?.createdAt || new Date(),
    };

    const statistics = {
      accountStatus: userProfile.status,
      totalOrders,
      paidOrdersCount,
      totalItemsPurchased,
      totalSpent,
    };

    res.json({
      success: true,
      user: userProfile,
      statistics,
      purchaseHistory,
    });
  } catch (err) {
    console.error('[Admin User Details Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user details and purchase history.',
    });
  }
});

export default router;

