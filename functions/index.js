/**
 * Firebase Cloud Functions for Blue Chats
 *
 * Implements server-side Firebase Custom Claims assignment and verification.
 * Restricted CEO/Admin roles are managed strictly in this secure Cloud Function environment,
 * never exposed to the client, and never stored as readable database fields.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Designated CEO/Admin emails kept strictly within the server-side Cloud Function environment.
 * These are never sent to the client or stored in readable client collections.
 */
const DESIGNATED_CEO_ACCOUNTS = new Set([
  'jeynim6@gmail.com',
  'bleushorts@gmail.com',
]);

/**
 * Cloud Function: onUserCreated (Auth Trigger)
 * Automatically marks designated accounts with Firebase Custom Claims upon account creation.
 */
exports.assignCeoCustomClaimsOnCreate = functions.auth.user().onCreate(async (user) => {
  const email = (user.email || '').toLowerCase().trim();

  if (DESIGNATED_CEO_ACCOUNTS.has(email)) {
    try {
      // Set Firebase Custom Claims: { role: 'ceo', admin: true, ceo: true }
      await admin.auth().setCustomUserClaims(user.uid, {
        role: 'ceo',
        admin: true,
        ceo: true,
      });

      console.log(`[Cloud Function] Custom claims assigned to user uid: ${user.uid}`);
      return { success: true, uid: user.uid };
    } catch (error) {
      console.error(`[Cloud Function] Error assigning claims to uid: ${user.uid}`, error);
      throw error;
    }
  }

  // Standard user: set default role claim
  await admin.auth().setCustomUserClaims(user.uid, {
    role: 'user',
    admin: false,
    ceo: false,
  });

  return { success: true, uid: user.uid };
});

/**
 * Cloud Function: verifyCeoClaims (Callable HTTPS Function)
 * Cryptographically verifies that the caller possesses the verified 'ceo' custom claim.
 * The client CEO dashboard route queries this function before rendering.
 */
exports.verifyCeoClaims = functions.https.onCall(async (data, context) => {
  // 1. Ensure user is authenticated with Firebase Auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { uid, token } = context.auth;

  // 2. If claims are already attached in the decoded token
  if (token.role === 'ceo' || token.admin === true || token.ceo === true) {
    return {
      authorized: true,
      role: 'ceo',
      claims: {
        role: 'ceo',
        admin: true,
        ceo: true,
      },
    };
  }

  // 3. Check and refresh user record directly via Firebase Admin Auth
  try {
    const userRecord = await admin.auth().getUser(uid);
    const email = (userRecord.email || '').toLowerCase().trim();

    // If designated account, attach custom claims now if not yet attached
    if (DESIGNATED_CEO_ACCOUNTS.has(email)) {
      const claims = { role: 'ceo', admin: true, ceo: true };
      await admin.auth().setCustomUserClaims(uid, claims);

      return {
        authorized: true,
        role: 'ceo',
        claims,
        refreshed: true,
      };
    }

    // Otherwise, access is denied
    throw new functions.https.HttpsError(
      'permission-denied',
      'Access denied: Account lacks required CEO custom claims.'
    );
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      'Failed to verify security claims.'
    );
  }
});
