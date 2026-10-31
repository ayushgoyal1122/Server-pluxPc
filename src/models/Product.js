import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category slug is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    categoryLabel: {
      type: String,
      required: [true, 'Category label is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be non-negative'],
    },
    originalPrice: {
      type: Number,
      min: [0, 'Original price must be non-negative'],
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    galleryImages: {
      type: [String],
      default: [],
    },
    promotionalPosters: [
      {
        image: { type: String, required: true },
        alt: { type: String, default: '' },
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        tag: { type: String, default: '' },
        sortOrder: { type: Number, default: 0 },
      },
    ],
    badge: {
      type: String,
      trim: true,
      default: '',
    },
    badgeIcon: {
      type: String,
      trim: true,
      default: '',
    },
    featureTag: {
      type: String,
      trim: true,
      default: '',
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    stockQuantity: {
      type: Number,
      default: 50,
      min: [0, 'Stock cannot be negative'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    specs: {
      type: Map,
      of: String,
      default: {},
    },
    overview: {
      type: String,
      default: '',
      trim: true,
    },
    keyFeatures: {
      type: [String],
      default: [],
    },
    highlights: [
      {
        icon: { type: String, default: 'Zap' },
        title: { type: String, required: true },
        description: { type: String, required: true },
      },
    ],
    useCases: [
      {
        title: { type: String, required: true },
        description: { type: String, required: true },
      },
    ],
    inTheBox: {
      type: [String],
      default: [],
    },
    compatibility: {
      type: [String],
      default: [],
    },
    warrantyDetails: {
      type: String,
      default: '',
      trim: true,
    },
    colors: {
      type: [String],
      default: ['bg-gray-900'],
    },
    section: {
      type: [String],
      default: ['exclusive'],
      index: true,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    isTrending: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    deletedReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Keep category product counts in sync after save/delete
export async function updateCategoryCounts(categorySlug) {
  if (!categorySlug) return;
  try {
    const Category = mongoose.model('Category');
    const Product = mongoose.model('Product');
    const count = await Product.countDocuments({ category: categorySlug, isDeleted: { $ne: true } });
    await Category.updateOne({ slug: categorySlug }, { productCount: count });
  } catch (err) {
    console.error('Failed to update category count:', err);
  }
}

productSchema.statics.updateCategoryCounts = updateCategoryCounts;

productSchema.post('save', function (doc) {
  updateCategoryCounts(doc.category);
});

productSchema.post('findOneAndDelete', function (doc) {
  if (doc) updateCategoryCounts(doc.category);
});

export const Product = mongoose.model('Product', productSchema);
