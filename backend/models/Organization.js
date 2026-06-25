import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allows null/undefined to be ignored for unique index
    },
    customUrlToken: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    settings: {
      requireSso: { type: Boolean, default: false },
      retentionDays: { type: Number, default: 90 }, // Keep recordings for X days
      allowPublicMeetings: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;
