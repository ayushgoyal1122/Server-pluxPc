import mongoose from 'mongoose';

const platformFeeSettingsSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    feeType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    feeValue: {
      type: Number,
      default: 0,
      min: [0, 'Fee value cannot be negative'],
    },
    minFee: {
      type: Number,
      default: null,
      min: [0, 'Minimum fee cannot be negative'],
    },
    maxFee: {
      type: Number,
      default: null,
      min: [0, 'Maximum fee cannot be negative'],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helper method on model to get active or default singleton settings
platformFeeSettingsSchema.statics.getOrCreate = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      enabled: false,
      feeType: 'fixed',
      feeValue: 0,
      minFee: null,
      maxFee: null,
    });
  }
  return settings;
};

export const PlatformFeeSettings = mongoose.model('PlatformFeeSettings', platformFeeSettingsSchema);
export default PlatformFeeSettings;

