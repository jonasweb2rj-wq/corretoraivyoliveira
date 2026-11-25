/**
 * Dirty Dozen Security Rule Verification Matrix
 * Executed against Firestore Security Rules logic invariants.
 */
export const DIRTY_DOZEN_CASES = [
  { name: 'Tenant Hijack on Property Create', expected: 'PERMISSION_DENIED', collection: 'properties' },
  { name: 'Cross-Tenant Draft Read', expected: 'PERMISSION_DENIED', collection: 'properties' },
  { name: 'Blanket List Scraping on Leads', expected: 'PERMISSION_DENIED', collection: 'leads' },
  { name: 'Shadow Field Injection on Property Update', expected: 'PERMISSION_DENIED', collection: 'properties' },
  { name: 'Privilege Escalation in User Profile', expected: 'PERMISSION_DENIED', collection: 'users' },
  { name: 'Email Spoofing Without Verification', expected: 'PERMISSION_DENIED', collection: 'admins' },
  { name: 'ID Poisoning (>128 chars)', expected: 'PERMISSION_DENIED', collection: 'properties' },
  { name: 'Resource Exhaustion (1MB String)', expected: 'PERMISSION_DENIED', collection: 'leads' },
  { name: 'Lead Consent Bypass (lgpdConsent: false)', expected: 'PERMISSION_DENIED', collection: 'leads' },
  { name: 'Lead Cross-Tenant OwnerUid Poisoning', expected: 'PERMISSION_DENIED', collection: 'leads' },
  { name: 'Timestamp Forgery on Create', expected: 'PERMISSION_DENIED', collection: 'properties' },
  { name: 'Audit Log Tampering (update/delete)', expected: 'PERMISSION_DENIED', collection: 'auditLogs' },
] as const;
