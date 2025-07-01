import * as admin from 'firebase-admin';

//const client = new SecretManagerServiceClient();

admin.initializeApp();
const db = admin.firestore();

export async function saveTokensForUser(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number
): Promise<void> {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  await db.collection('tokens').doc(userId).set({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    updated_at: Date.now(),
  });
}

export async function getTokensForUser(userId: string) {
  const doc = await db.collection('tokens').doc(userId).get();
  return doc.exists ? doc.data() : null;
}
