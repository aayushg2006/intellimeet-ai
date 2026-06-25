import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for OAuth users
  role: { type: String, enum: ['Admin', 'Member'], default: 'Member' },
  avatar: { type: String, default: '' },

  // OAuth fields
  googleId: { type: String, unique: true, sparse: true },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'both'],
    default: 'local',
  },

  // Password reset fields
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving (only if password exists and was modified)
userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
userSchema.methods.generateResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return resetToken;
};

export default mongoose.model('User', userSchema);
