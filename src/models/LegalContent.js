import mongoose from 'mongoose';

const legalContentSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      enum: ['terms-and-conditions', 'privacy-policy'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      maxlength: [50000, 'Content cannot exceed 50,000 characters'],
    },
    status: {
      type: String,
      enum: ['published', 'draft'],
      default: 'published',
      index: true,
    },
    characterCount: {
      type: Number,
      default: 0,
    },
    lastUpdatedBy: {
      type: String,
      default: 'Admin',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to automatically compute characterCount
legalContentSchema.pre('save', function (next) {
  if (this.content) {
    this.characterCount = this.content.length;
  }
  next();
});

export const LegalContent = mongoose.model('LegalContent', legalContentSchema);

