// =======================
// Helper Functions (shared)
// =======================

// Extract year from date string
export const getYear = (date: string) => date?.slice(0, 4) ?? "";

// Get unique values from array
export const getUnique = <T,>(arr: T[]) => Array.from(new Set(arr));

// Split player string into array
export const splitPlayers = (player: string) => player?.split("+").map(p => p.trim()).filter(Boolean) ?? [];

// Sort seasons descending
export const sortSeasons = (seasons: string[]) => [...seasons].sort((a, b) => b.localeCompare(a));

// Get top N from a count map
export const getTopN = (map: Record<string, number>, n: number) =>
  Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);

// Get bottom N from a count map
export const getBottomN = (map: Record<string, number>, n: number) =>
  Object.entries(map).filter(([_, count]) => count > 0).sort((a, b) => a[1] - b[1]).slice(0, n);

// Full reset helper
export function handleFullReset(
  setSelectedManager: (v: string) => void,
  setSelectedSeason: (v: string) => void,
  setSelectedPlayer: (v: string) => void,
  setSelectedWeek: (v: string) => void,
  setSelectedFlavor: (v: string) => void,
  setShowPenaltyOnly: (v: boolean) => void
) {
  setSelectedManager("All");
  setSelectedSeason("All");
  setSelectedPlayer("All");
  setSelectedWeek("All");
  setSelectedFlavor("All");
  setShowPenaltyOnly(false);
}

// Reverse lookup helper:
export function getManagerKeyFromDisplayName(displayName: string): string {
  if (displayName === "Harris") return "Jacob";
  if (displayName === "Hughes") return "jake.hughes275";
  if (displayName === "Johnny") return "johnny5david";
  if (displayName === "Zach") return "Zachary";
  if (displayName === "Mike") return "Michael";
  return displayName;
}