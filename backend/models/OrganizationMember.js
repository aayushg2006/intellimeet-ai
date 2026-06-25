import mongoose from 'mongoose';

const organizationMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    role: {
      type: String,
      enum: ['OrgAdmin', 'OrgMember'],
      default: 'OrgMember',
    },
  },
  { timestamps: true }
);

// Ensure a user can only have one membership record per organization
organizationMemberSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

const OrganizationMember = mongoose.model('OrganizationMember', organizationMemberSchema);

export default OrganizationMember;
