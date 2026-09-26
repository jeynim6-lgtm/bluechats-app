/**
 * OPTIONAL Firebase Cloud Functions for Blue Chats.
 *
 * The Express server already assigns the CEO claim on first verified sign-in (POST /api/admin/verify),
 * so these functions are not required. Deploy them only if you want claims assigned the moment an
 * account is created, without the user visiting the dashboard:
 *
 *   cd functions && npm install && cd ..
 *   echo "CEO_PHONE_NUMBERS=+27820000000" > functions/.env
 *   npx firebase-tools deploy --only functions      (requires the Blaze plan)
 *
 * Designated accounts come from CEO_PHONE_NUMBERS / CEO_EMAILS (comma-separated) in functions/.env.
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

const list = (value) =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const CEO_PHONES = new Set(list(process.env.CEO_PHONE_NUMBERS).map((p) => p.replace(/[^\d+]/g, '')));
const CEO_EMAILS = new Set(list(process.env.CEO_EMAILS).map((e) => e.toLowerCase()));

function isDesignated(user) {
  if (user.phoneNumber && CEO_PHONES.has(user.phoneNumber)) return true;
  return Boolean(user.email && user.emailVerified && CEO_EMAILS.has(user.email.toLowerCase()));
}

/** Attaches { role: 'ceo', admin: true, ceo: true } to designated accounts when they are created. */
exports.assignCeoClaimsOnCreate = functions.auth.user().onCreate(async (user) => {
  if (!isDesignated(user)) return null;
  await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role: 'ceo', admin: true, ceo: true });
  functions.logger.info(`CEO claims assigned to ${user.uid}`);
  return null;
});
