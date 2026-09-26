/**
 * Grants (or revokes) the CEO/admin custom claim { role: 'ceo', admin: true, ceo: true }.
 *
 * Requires Firebase Admin credentials for your project, via either:
 *   - FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'  (raw or base64 JSON), or
 *   - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 * and FIREBASE_PROJECT_ID.
 *
 * Usage:
 *   npm run grant-ceo-claims -- +27821234567          # by phone (the SMS sign-in number)
 *   npm run grant-ceo-claims -- someone@example.com   # by email
 *   npm run grant-ceo-claims -- --uid <firebase-uid>
 *   npm run grant-ceo-claims -- +27821234567 --revoke
 *
 * With no arguments, every entry in CEO_PHONE_NUMBERS and CEO_EMAILS is processed.
 * The user must sign out and back in (or wait up to an hour) for the new claim to reach their ID token.
 */
import 'dotenv/config';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { env } from '../server/env.ts';
import { getAdminApp, canWriteAuth } from '../server/firebaseAdmin.ts';

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const uidIndex = args.indexOf('--uid');
  const targets = args.filter((a, i) => !a.startsWith('--') && i !== uidIndex + 1);

  const app = getAdminApp();
  if (!app) throw new Error('FIREBASE_PROJECT_ID is not set.');
  if (!canWriteAuth()) {
    throw new Error('No admin credentials. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.');
  }
  const auth = getAuth(app);

  const lookups: Array<() => Promise<UserRecord>> = [];
  if (uidIndex >= 0 && args[uidIndex + 1]) lookups.push(() => auth.getUser(args[uidIndex + 1]));
  const identifiers = targets.length || uidIndex >= 0 ? targets : [...env.ceoPhoneNumbers, ...env.ceoEmails];
  for (const id of identifiers) {
    lookups.push(() => (id.includes('@') ? auth.getUserByEmail(id) : auth.getUserByPhoneNumber(id.replace(/[^\d+]/g, ''))));
  }
  if (!lookups.length) {
    throw new Error('No targets. Pass a phone/email/--uid, or set CEO_PHONE_NUMBERS / CEO_EMAILS.');
  }

  let failures = 0;
  for (const lookup of lookups) {
    try {
      const user = await lookup();
      const claims = { ...(user.customClaims || {}) };
      if (revoke) {
        delete claims.role;
        delete claims.admin;
        delete claims.ceo;
      } else {
        Object.assign(claims, { role: 'ceo', admin: true, ceo: true });
      }
      await auth.setCustomUserClaims(user.uid, claims);
      console.log(`✅ ${revoke ? 'Revoked' : 'Granted'} CEO claims: ${user.phoneNumber || user.email} (uid ${user.uid})`);
    } catch (err) {
      failures++;
      console.error(`❌ ${(err as Error).message}`);
    }
  }
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
