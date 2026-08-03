import mongoose from 'mongoose';
import Organization from '../models/Organization.js';
import OrganizationMember from '../models/OrganizationMember.js';

const GENERIC_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'msn.com',
  'protonmail.com',
  'zoho.com',
  'yandex.com'
];

/**
 * Look up a user's membership in an organization.
 * This is the single source of truth for "is this user in this org, and as what".
 * Previously this query was copy-pasted inline in ~13 places.
 *
 * @returns {Promise<{ role: 'OrgAdmin' | 'OrgMember' } | null>} null when not a member
 */
export const getOrgMembership = async (userId, organizationId) => {
  if (!userId || !organizationId) return null;
  if (!mongoose.Types.ObjectId.isValid(organizationId)) return null;

  return OrganizationMember.findOne({ userId, organizationId }).select('role').lean();
};

/**
 * True when the user belongs to the organization at all.
 */
export const isOrgMember = async (userId, organizationId) =>
  Boolean(await getOrgMembership(userId, organizationId));

/**
 * True when the user is an admin of the organization.
 */
export const isOrgAdmin = async (userId, organizationId) => {
  const membership = await getOrgMembership(userId, organizationId);
  return membership?.role === 'OrgAdmin';
};

export const checkAndJoinOrganizationByDomain = async (user) => {
  try {
    if (!user || !user.email) return;

    const domain = user.email.split('@')[1]?.toLowerCase();
    
    if (!domain || GENERIC_DOMAINS.includes(domain)) {
      return; // Skip generic email providers
    }

    // Check if an organization exists with this domain
    const organization = await Organization.findOne({ domain });
    
    if (organization) {
      // Check if user is already a member
      const existingMember = await OrganizationMember.findOne({
        userId: user._id,
        organizationId: organization._id,
      });

      if (!existingMember) {
        // Add user to the organization
        await OrganizationMember.create({
          userId: user._id,
          organizationId: organization._id,
          role: 'OrgMember',
        });
        console.log(`Auto-joined user ${user.email} to organization ${organization.name}`);
      }
    }
  } catch (error) {
    console.error('Error auto-joining organization by domain:', error);
  }
};
