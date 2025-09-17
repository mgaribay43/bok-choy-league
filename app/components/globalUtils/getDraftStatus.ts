/**
 * Fetches the Yahoo league settings for a given year and returns the draft_status.
 * Possible values include: "predraft", "postdraft", "inseason" (and Yahoo may vary).
 * Returns "unknown" on error.
 */
export async function getDraftStatus(year: number | string): Promise<string> {
  const y = typeof year === "number" ? year : parseInt(year, 10);
  const url = `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${y}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Try common locations for draft_status in the Yahoo settings payload
    const status =
      data?.fantasy_content?.league?.[1]?.settings?.[0]?.draft_status ??
      data?.fantasy_content?.league?.[0]?.draft_status ??
      data?.fantasy_content?.league?.[0]?.status ??
      "unknown";

    return String(status).toLowerCase();
  } catch (err) {
    console.error("getDraftStatus error:", err);
    return "unknown";
  }
}

/**
 * Convenience helper: true if the given season is postdraft.
 */
export async function isPostdraft(year: number | string): Promise<boolean> {
  const status = await getDraftStatus(year);
  return status === "postdraft";
}