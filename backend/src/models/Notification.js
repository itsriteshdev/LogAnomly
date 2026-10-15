import mongoose from 'mongoose';

const userNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['anomaly', 'alert', 'system', 'assignment', 'training', 'info'],
    default: 'info',
  },
  severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'], default: 'info' },
  isRead: { type: Boolean, default: false, index: true },
  link: { type: String },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

userNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const UserNotification = mongoose.model('UserNotification', userNotificationSchema);

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  description: { type: String },
  category: { type: String },
  isSecret: { type: Boolean, default: false },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
