import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    excerpt: {
      type: String,
      required: [true, 'Excerpt is required'],
      trim: true,
      maxlength: [400, 'Excerpt cannot exceed 400 characters'],
    },
    content: {
      type: String,
      required: [true, 'Article content is required'],
    },
    coverImage: {
      type: String,
      required: [true, 'Cover image URL is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    categorySlug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
      default: 'PLUXPC Hardware Lab',
    },
    authorRole: {
      type: String,
      trim: true,
      default: 'Hardware Editor',
    },
    authorAvatar: {
      type: String,
      trim: true,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
      index: true,
    },
    readTime: {
      type: String,
      default: '5 min read',
      trim: true,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [100, 'Meta title cannot exceed 100 characters'],
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [250, 'Meta description cannot exceed 250 characters'],
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
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
  },
  {
    timestamps: true,
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

// Compound indexes for fast search and listing
blogSchema.index({ status: 1, isDeleted: 1, publishedAt: -1 });
blogSchema.index({ categorySlug: 1, status: 1, isDeleted: 1, publishedAt: -1 });
blogSchema.index({ title: 'text', excerpt: 'text', tags: 'text' });

export const Blog = mongoose.model('Blog', blogSchema);

