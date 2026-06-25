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
