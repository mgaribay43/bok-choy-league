import { getFirestore, doc, getDoc } from "firebase/firestore";

/**
 * Returns the Yahoo league key for a given year (YYYY) from Firestore.
 * @param year string | number (e.g. "2025")
 * @returns Promise<string | undefined>
 */
export async function getLeagueKey(year: string | number): Promise<string | undefined> {
  const db = getFirestore();
  const ref = doc(db, "League_Keys", "leagueKeysByYear");
  const snap = await getDoc(ref);
  if (!snap.exists()) return undefined;
  const data = snap.data();
  // Firestore stores keys as string values
  return data?.[String(year)];
}