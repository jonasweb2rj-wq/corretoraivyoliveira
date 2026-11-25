# Security Specification & Payload-First Verification

## 1. Data Invariants
1. **Multi-Tenant Ownership Isolation**: Every tenant-scoped document (`properties`, `developments`, `landingPages`, `leads`, `testimonials`, `analyticsEvents`, `campaigns`, `media`, `aiJobs`, `auditLogs`) carries immutable `tenantId` and `ownerUid` bound to an existing `tenants/{tenantId}` document.
2. **Draft Confidentiality**: Documents with `status == 'draft'` in `properties`, `developments`, `landingPages`, and `testimonials` are never readable via `get` or `list` by unauthenticated visitors or other tenants.
3. **PII Isolation**: `users` and `leads` contain personal information (`email`, `phone`) and are readable only by the tenant owner (`ownerUid == request.auth.uid`) or verified platform admin.
4. **Temporal & Identity Integrity**: All `createdAt` fields must equal `request.time` on creation and remain immutable; all `updatedAt` fields must equal `request.time` on update. All authenticated writes require `request.auth.token.email_verified == true`.
5. **Immutable Audit Trail**: `auditLogs` can only be created with `actorUid == request.auth.uid` and can never be updated or deleted.

## 2. The "Dirty Dozen" Attack Payloads
1. **Tenant Hijack on Property Create**: Authenticated broker B attempts to create a property under `tenantId: "ivy-oliveira"` with `ownerUid: "brokerB"`. Rejected because `tenants/ivy-oliveira.data.ownerUid != request.auth.uid`.
2. **Cross-Tenant Draft Read**: Authenticated broker B attempts `get(/properties/draft-1)` belonging to broker A. Rejected because `status != 'published'` and `ownerUid != request.auth.uid`.
3. **Blanket List Scraping on Leads**: Unauthenticated or cross-tenant user runs `list` on `/leads`. Rejected because `allow list` enforces `resource.data.ownerUid == request.auth.uid || isBootstrappedAdmin()`.
4. **Shadow Field Injection on Property Update**: Broker injects `isVerified: true` into property update. Rejected by `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.
5. **Privilege Escalation in User Profile**: Broker attempts to update `users/{uid}` changing `role: "admin"` or `tenantId: "ivy-oliveira"`. Rejected because `role` and `tenantId` are immutable for non-admins.
6. **Email Spoofing Without Verification**: User with `email: "jonasweb2rj@gmail.com"` but `email_verified: false` attempts admin write. Rejected because `isBootstrappedAdmin()` mandates `email_verified == true`.
7. **ID Poisoning**: Attacker attempts to create document with 500-character ID or invalid characters (`../admin`). Rejected by `isValidId(id)` (`<= 128` and `^[a-zA-Z0-9_-]+$`).
8. **Resource Exhaustion (1MB String)**: Attacker attempts to submit a Lead with a 50,000-character `message`. Rejected by `data.message.size() <= 2000`.
9. **Lead Consent Bypass**: Public visitor submits Lead with `lgpdConsent: false` or `status: "converted"`. Rejected because public lead create mandates `lgpdConsent == true` and `status == 'new'`.
10. **Lead Cross-Tenant Poisoning**: Public visitor submits Lead for `tenantId: "ivy-oliveira"` while setting `ownerUid: "attacker"`. Rejected because `incoming().ownerUid == get(/tenants/ivy-oliveira).data.ownerUid` is enforced.
11. **Timestamp Forgery**: Authenticated user sets `createdAt` to a backdated client timestamp instead of `serverTimestamp()`. Rejected by `incoming().createdAt == request.time`.
12. **Audit Log Tampering**: Authenticated user attempts `update` or `delete` on `/auditLogs/{logId}`. Rejected by `allow update, delete: if false;`.
