import * as admin from 'firebase-admin';

//const client = new SecretManagerServiceClient();

admin.initializeApp();
const db = admin.firestore();

export async function saveTokensForUser(
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number
): Promise<void> {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  await db.collection('tokens').doc('master').set({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    updated_at: Date.now(),
  });
}

export async function getTokensForUser() {
  const doc = await db.collection('tokens').doc('master').get();
  return doc.exists ? doc.data() : null;
}
