"use client";

import React, { useEffect, useState, useRef } from "react";
import Marquee from "react-fast-marquee";
import { useRouter } from "next/navigation";
import { getCurrentWeek } from "./globalUtils/getCurrentWeek";
import { WinProbChartModal, type WinProbChartSelection } from "./WinProbabilityTracker";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Helper to build Yahoo Fantasy matchup link for the app/browser
function getYahooMatchupLink({
  leagueId,
  week,
  mid1,
  mid2,
}: {
  leagueId: string | number;
  week: string | number;
  mid1: string | number;
  mid2: string | number;
}) {
  return `https://football.fantasysports.yahoo.com/f1/${leagueId}/matchup?week=${week}&mid1=${mid1}&mid2=${mid2}`;
}

// Update Matchup type to include team IDs if available
interface Matchup {
  team1: string;
  team2: string;
  displayValue1: string;
  displayValue2: string;
  record1: string;
  record2: string;
  avatar1?: string;
  avatar2?: string;
  winnerOnTop?: boolean;
  winPct1?: number;
  winPct2?: number;
  projected1?: string;
  projected2?: string;
  recapUrl?: string;
  recapAvailable?: boolean;
  team1Id?: string | number;
  team2Id?: string | number;
  week?: number | string;
}

const TEAM_AVATARS: Record<string, string> = {};
const getAvatar = (teamName: string) =>
  TEAM_AVATARS[teamName] ||
  "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// Auto-shrink text to fit one line without truncation
const AutoFitText: React.FC<{
  text: string;
  max: number; // max font size in px
  min: number; // min font size in px
  weight?: number;
  color?: string;
  align?: "left" | "right" | "center";
}> = ({ text, max, min, weight = 600, color = "#e5e7eb", align = "left" }) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(max);

  useEffect(() => {
    const el = spanRef.current;
    const parent = containerRef.current;
    if (!el || !parent) return;
    let s = max;
    el.style.fontSize = `${s}px`;
    el.style.whiteSpace = "nowrap";

    // Shrink until it fits or we hit min
    while (s > min && el.scrollWidth > parent.clientWidth) {
      s -= 1;
      el.style.fontSize = `${s}px`;
    }
    setSize(s);
  }, [text, max, min]);

  return (
    <div ref={containerRef} style={{ width: "100%", minWidth: 0 }}>
      <span
        ref={spanRef}
        style={{
          display: "block",
          fontWeight: weight,
          fontSize: size,
          color,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          textAlign: align,
        }}
      >
        {text}
      </span>
    </div>
  );
};

const ScoreBox = ({
  value,
  projected,
  highlight,
  align = "right",
}: {
  value: string;
  projected?: string;
  highlight: "win" | "lose" | "tie";
  align?: "right" | "left";
}) => (
  <div
    style={{
      fontWeight: 800,
      fontSize: "clamp(20px, 6.5vw, 36px)", // responsive, smaller on narrow screens
      color:
        highlight === "win"
          ? "#22c55e"
          : highlight === "lose"
            ? "#dc2626"
            : "#e5e7eb",
      minWidth: "clamp(52px, 16vw, 84px)", // reserve width for scores
      textAlign: align,
      display: "flex",
      flexDirection: "column",
      alignItems: align === "right" ? "flex-end" : "flex-start",
      lineHeight: 1.05,
    }}
  >
    {value}
    {projected && (
      <span
        style={{
          fontWeight: 400,
          fontSize: "clamp(11px, 3.2vw, 13px)",
          color: "#a7a7a7",
          marginTop: 2,
          whiteSpace: "nowrap",
        }}
      >
        proj: {Number(projected).toFixed(2)}
      </span>
    )}
  </div>
);

// Records: remove parentheses and force one line
const AvatarBox = ({
  src,
  alt,
  record,
}: {
  src?: string;
  alt: string;
  record: string;
}) => {
  const cleanRecord = (record || "").replace(/[()]/g, ""); // no parentheses
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <img
        src={src}
        alt={alt}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          objectFit: "cover",
          border: "none",
          background: "#18191b",
        }}
      />
      <span
        style={{
          fontSize: 13,
          color: "#a7a7a7",
          fontWeight: 600,
          marginTop: 2,
          letterSpacing: 0.5,
          whiteSpace: "nowrap",         // always one line
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {cleanRecord}
      </span>
    </div>
  );
};

const WinBar = ({
  pct1,
  pct2,
}: {
  pct1?: number;
  pct2?: number;
}) => (
  <div style={{ background: "#23252b", marginTop: 8 }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontWeight: 700,
        fontSize: 16,
        padding: "0 22px",
      }}
    >
      <span style={{ color: (pct1 ?? 0) >= (pct2 ?? 0) ? "#22c55e" : "#dc2626" }}>
        {Math.round(pct1 ?? 0)}%
      </span>
      <span style={{ color: "#a7a7a7", fontWeight: 600, fontSize: 15, letterSpacing: 1 }}>
        Win %
      </span>
      <span style={{ color: (pct2 ?? 0) > (pct1 ?? 0) ? "#22c55e" : "#dc2626" }}>
        {Math.round(pct2 ?? 0)}%
      </span>
    </div>
    <div
      style={{
        position: "relative",
        height: 8,
        background: "#18191b",
        borderRadius: 8,
        margin: "10px 0 0 0",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: `${pct1}%`,
          background: (pct1 ?? 0) >= (pct2 ?? 0) ? "#6f49e0ff" : "#8b96f1ff",
          borderTopLeftRadius: 8,
          borderBottomLeftRadius: 8,
          transition: "width 0.4s",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: `${pct2}%`,
          background: (pct2 ?? 0) > (pct1 ?? 0) ? "#6f49e0ff" : "#8b96f1ff",
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
          transition: "width 0.4s",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${pct1}%`,
          top: -1,
          height: "calc(100% + 2px)",
          width: 3,
          background: "#23252b",
          borderRadius: 2,
          zIndex: 2,
          transform: "translateX(-1.5px)",
        }}
      />
    </div>
  </div>
);

type MatchupCardProps = {
  m: Matchup;
  showNames?: boolean;
  style?: React.CSSProperties;
  onOpenChart?: (m: Matchup) => void;
  hasChart?: boolean;
  showChartIcon?: boolean;
  showRecapButton?: boolean;
};

const MatchupCard = ({
  m,
  showNames = false,
  style = {},
  onOpenChart,
  hasChart = true,
  showChartIcon = true,
  showRecapButton = false,
  week,
}: MatchupCardProps & { week: number | string }) => {
  const win1 = Number(m.displayValue1) > Number(m.displayValue2);
  const win2 = Number(m.displayValue2) > Number(m.displayValue1);

  const leagueId = "128797";
  const matchupUrl = getYahooMatchupLink({
    leagueId,
    week,
    mid1: m.team1Id ?? 1,
    mid2: m.team2Id ?? 2,
  });

  return (
    <div
      style={{
        background: "#23252b",
        borderRadius: 16,
        margin: "24px auto",
        padding: 0,
        boxShadow: "0 2px 12px 0 #000",
        border: "2px solid #232323",
        maxWidth: 540,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Top bar: recap (left) and chart (right). Buttons are confined to their own area */}
      {(showChartIcon || showRecapButton) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 10px 0 10px",
          }}
        >
          {/* Week Recap left */}
          <button
            disabled={!m.recapUrl}
            onClick={() => {
              if (m.recapUrl) window.open(m.recapUrl, "_blank", "noopener,noreferrer");
            }}
            style={{
              background: "#0f1117",
              border: "1px solid #3a3d45",
              color: m.recapUrl ? "#e5e7eb" : "#6b7280",
              borderRadius: 10,
              padding: "8px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textDecoration: "none",
              pointerEvents: "auto",
              fontSize: 13,
              fontWeight: 600,
              cursor: m.recapUrl ? "pointer" : "not-allowed",
              opacity: m.recapUrl ? 1 : 0.5,
            }}
            aria-label="Open week recap"
            title={m.recapUrl ? "Open week recap" : "Recap not available yet"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16v16H4z" />
              <path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
            <span>Week Recap</span>
          </button>

          {/* Chart button right */}
          {showChartIcon && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                hasChart && onOpenChart?.(m);
              }}
              aria-label={hasChart ? "Open win probability chart" : "No chart data yet"}
              title={hasChart ? "Open win probability chart" : "No chart data yet"}
              disabled={!hasChart}
              style={{
                background: "#0f1117",
                border: "1px solid #3a3d45",
                color: hasChart ? "#e5e7eb" : "#6b7280",
                borderRadius: 10,
                padding: "8px 10px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: hasChart ? "pointer" : "not-allowed",
                pointerEvents: "auto",
                opacity: hasChart ? 1 : 0.45,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M19 9l-5 5-4-4-4 4" />
                <circle cx="19" cy="9" r="1.5" />
                <circle cx="14" cy="14" r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="6" cy="14" r="1.5" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Make the card itself link to Yahoo matchup */}
      <a
        href={matchupUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          textDecoration: "none",
          display: "block",
        }}
        aria-label={`Open matchup in Yahoo Fantasy`}
      >
        {showNames && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              padding: "10px 18px 0 18px",
              gap: 8,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <AutoFitText text={m.team1} max={22} min={13} color="#e5e7eb" align="left" />
            </div>
            <div style={{ width: 12 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <AutoFitText text={m.team2} max={22} min={13} color="#e5e7eb" align="right" />
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: showNames ? "4px 18px 0 18px" : "18px 18px 0 18px",
            marginTop: showNames ? 6 : 0,
            marginBottom: 8,
            gap: 8,
          }}
        >
          <AvatarBox src={m.avatar1} alt={m.team1} record={m.record1} />
          <ScoreBox
            value={m.displayValue1}
            projected={m.projected1}
            highlight={win1 ? "win" : win2 ? "lose" : "tie"}
            align="right"
          />
          <div style={{ fontWeight: 700, fontSize: "clamp(20px, 5.5vw, 28px)", color: "#6b7280", margin: "0 2px" }}>/</div>
          <ScoreBox
            value={m.displayValue2}
            projected={m.projected2}
            highlight={win2 ? "win" : win1 ? "lose" : "tie"}
            align="left"
          />
          <AvatarBox src={m.avatar2} alt={m.team2} record={m.record2} />
        </div>

        <WinBar pct1={m.winPct1} pct2={m.winPct2} />
      </a>
    </div>
  );
};

interface MatchupsViewerProps {
  Marquee?: boolean;
}

const Matchups: React.FC<MatchupsViewerProps> = ({ Marquee: useMarquee = false }) => {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [maxWeek, setMaxWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [isMatchupStarted, setIsMatchupStarted] = useState(false);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartSel, setChartSel] = useState<WinProbChartSelection | null>(null);
  const [wpAvailableKeys, setWpAvailableKeys] = useState<Set<string>>(new Set());
  const [initializing, setInitializing] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Track last status to detect change to 'postevent'
  const lastStatusRef = useRef<string | null>(null);

  // Helper to fetch and handle week advancement
  const fetchMatchups = async (
    weekOverride?: number,
    updateOnlyScores = false,
    useViewWeek = false
  ) => {
    if (!updateOnlyScores) setLoading(true);
    try {
      // Always use weekOverride if provided, otherwise fall back to currentWeek
      const weekParam = typeof weekOverride === "number"
        ? weekOverride
        : currentWeek;

      if (!updateOnlyScores && !useViewWeek) setCurrentWeek(weekParam);

      const response = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=2025&week=${weekParam}`
      );
      const data = await response.json();
      const scoreboard = data?.fantasy_content?.league?.[1]?.scoreboard?.["0"];
      const maxW =
        Number(
          data?.fantasy_content?.league?.[1]?.settings?.[0]?.stat_categories?.[0]?.max_week
        ) || 17;
      setMaxWeek(maxW);

      const status = scoreboard?.status;
      setIsMatchupStarted(status === "midevent");

      const matchupsData = scoreboard?.matchups;
      if (!matchupsData) {
        if (!updateOnlyScores) setMatchups([]);
        setLoading(false);
        return;
      }

      let records: Record<string, string> = {};
      if (!updateOnlyScores) {
        const standingsRes = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=standings&year=2025`
        );
        const standingsJson = await standingsRes.json();
        const teamsObj =
          standingsJson?.fantasy_content?.league?.[1]?.standings?.[0]?.teams || {};
        Object.values(teamsObj).forEach((teamObj: any) => {
          const teamArr = teamObj?.team;
          if (!teamArr) return;
          const teamMeta = teamArr[0];
          const teamNameObj = teamMeta?.find((item: any) => item.name);
          const teamName = teamNameObj?.name ?? "";
          const teamStandings = teamArr[2]?.team_standings;
          const outcome = teamStandings?.outcome_totals || {};
          const wins = outcome.wins ?? 0;
          const losses = outcome.losses ?? 0;
          const ties = outcome.ties ?? 0;
          records[teamName] = `(${wins}-${losses}-${ties})`;
        });
      }

      const formattedMatchups = Object.values(matchupsData)
        .filter(
          (matchup: any) =>
            matchup &&
            matchup.matchup &&
            matchup.matchup["0"] &&
            matchup.matchup["0"].teams
        )
        .map((matchup: any) => {
          const teams = matchup.matchup["0"].teams;
          const team1 = teams["0"].team;
          const team2 = teams["1"].team;
          const started = matchup.matchup.status !== "preevent";
          const recapAvailable =
            matchup.matchup.is_matchup_recap_available === 1 ||
            matchup.matchup.is_matchup_recap_available === "1";
          const recapUrl = recapAvailable ? matchup.matchup.matchup_recap_url : undefined;

          const team1Name =
            team1?.[0]?.find((item: any) => item.name)?.name || "Unknown Team 1";
          const team2Name =
            team2?.[0]?.find((item: any) => item.name)?.name || "Unknown Team 2";
          const team1Score = started
            ? parseFloat(team1?.[1]?.team_points?.total || "0")
            : 0;
          const team2Score = started
            ? parseFloat(team2?.[1]?.team_points?.total || "0")
            : 0;
          const team1Logo =
            team1?.[0]?.find((item: any) => item.team_logos)?.team_logos?.[0]
              ?.team_logo?.url ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png";
          const team2Logo =
            team2?.[0]?.find((item: any) => item.team_logos)?.team_logos?.[0]
              ?.team_logo?.url ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png";
          const isFinished = scoreboard?.is_finished === 1;
          let winnerOnTop = false;
          let t1 = team1Name,
            t2 = team2Name,
            s1 = team1Score,
            s2 = team2Score,
            r1 = records[team1Name],
            r2 = records[team2Name],
            a1 = team1Logo,
            a2 = team2Logo;
          if (isFinished && started && team1Score !== team2Score) {
            if (team2Score > team1Score) {
              [t1, t2, s1, s2, r1, r2, a1, a2] = [
                t2,
                t1,
                s2,
                s1,
                r2,
                r1,
                a2,
                a1,
              ];
            }
            winnerOnTop = true;
          }
          const team1WinProbRaw = team1?.[1]?.win_probability;
          const team2WinProbRaw = team2?.[1]?.win_probability;
          const team1WinPct =
            typeof team1WinProbRaw === "number"
              ? team1WinProbRaw * 100
              : 0;
          const team2WinPct =
            typeof team2WinProbRaw === "number"
              ? team2WinProbRaw * 100
              : 0;
          const team1Proj = team1?.[1]?.team_projected_points?.total || "";
          const team2Proj = team2?.[1]?.team_projected_points?.total || "";
          const team1Id = team1?.[0]?.find((item: any) => item.team_id)?.team_id ?? 1;
          const team2Id = team2?.[0]?.find((item: any) => item.team_id)?.team_id ?? 2;
          const weekNum = scoreboard?.week ?? currentWeek;
          return {
            team1: t1,
            team2: t2,
            displayValue1: s1.toFixed(2),
            displayValue2: s2.toFixed(2),
            record1: r1,
            record2: r2,
            avatar1: a1,
            avatar2: a2,
            winnerOnTop,
            winPct1: team1WinPct,
            winPct2: team2WinPct,
            projected1: team1Proj,
            projected2: team2Proj,
            recapUrl,
            recapAvailable,
            team1Id,
            team2Id,
            week: weekNum,
          };
        });

      if (updateOnlyScores) {
        setMatchups((prevMatchups) => {
          // If no previous matchups, set all
          if (!prevMatchups.length) return formattedMatchups;
          // Only update scores, projected scores, and win probabilities if changed
          return prevMatchups.map((old, i) => {
            const fresh = formattedMatchups[i];
            if (!fresh) return old;
            const changed =
              old.displayValue1 !== fresh.displayValue1 ||
              old.displayValue2 !== fresh.displayValue2 ||
              old.projected1 !== fresh.projected1 ||
              old.projected2 !== fresh.projected2 ||
              old.winPct1 !== fresh.winPct1 ||
              old.winPct2 !== fresh.winPct2 ||
              old.winnerOnTop !== fresh.winnerOnTop;
            if (changed) {
              return {
                ...old,
                displayValue1: fresh.displayValue1,
                displayValue2: fresh.displayValue2,
                projected1: fresh.projected1,
                projected2: fresh.projected2,
                winPct1: fresh.winPct1,
                winPct2: fresh.winPct2,
                winnerOnTop: fresh.winnerOnTop,
              };
            }
            return old;
          });
        });
      } else {
        setMatchups(formattedMatchups);
      }
    } catch {
      if (!updateOnlyScores) setMatchups([]);
    } finally {
      if (!updateOnlyScores) setLoading(false);
    }
  };

  // On mount, fetch the current week from the global util
  useEffect(() => {
    async function fetchInitialWeek() {
      try {
        const season = new Date().getFullYear().toString();
        const week = await getCurrentWeek(season);
        setCurrentWeek(week);
        localStorage.setItem("currentWeek", String(week));
        await fetchMatchups(week);        // await initial load
      } catch {
        await fetchMatchups(1);           // await fallback
      } finally {
        setInitializing(false);           // show controls after first load
      }
    }
    fetchInitialWeek();
    // eslint-disable-next-line
  }, []);

  // POLLING LOGIC
  useEffect(() => {
    // Always poll every 15 seconds, regardless of matchup status
    pollingRef.current = setInterval(() => {
      fetchMatchups(viewWeek !== null ? viewWeek : currentWeek, true, !!viewWeek);
    }, 15000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // Only rerun when week changes
    // eslint-disable-next-line
  }, [viewWeek, currentWeek]);

  const handlePrevWeek = () => {
    const week = (viewWeek !== null ? viewWeek : currentWeek) - 1;
    if (week >= 1) {
      setViewWeek(week);
      fetchMatchups(week, false, true);
    }
  };

  const handleNextWeek = () => {
    const week = (viewWeek !== null ? viewWeek : currentWeek) + 1;
    if (week <= maxWeek) {
      setViewWeek(week);
      fetchMatchups(week, false, true);
    }
  };

  const handleWeekDropdown = (w: number) => {
    setWeekDropdownOpen(false);
    setViewWeek(w);
    fetchMatchups(w, false, true);
  };

  // If user navigates away from week navigation, reset viewWeek to null (show currentWeek)
  useEffect(() => {
    if (!weekDropdownOpen && viewWeek !== null) {
      // Optionally, you can reset viewWeek to null when dropdown closes
      // setViewWeek(null);
    }
  }, [weekDropdownOpen, viewWeek]);

  // Normalize a matchup key (order-independent)
  const pairKey = (a: string, b: string) =>
    [a?.toLowerCase().trim(), b?.toLowerCase().trim()].sort().join(" | ");

  // Fetch which matchups have WinProbabilities in Firestore for the current season/week
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, "WinProbabilities"));
        const seasonYear = String(new Date().getFullYear());
        const set = new Set<string>();
        snap.forEach((docSnap) => {
          const d: any = docSnap.data();
          // Guard against missing fields
          const hasPoints = Array.isArray(d.points) && d.points.length > 0;
          const wk = Number(d.week);
          const seasonOk = String(d.season) === seasonYear;
          if (!seasonOk || wk !== (viewWeek !== null ? viewWeek : currentWeek) || !hasPoints) return;
          const t1 = d.team1?.name ?? d.team1;
          const t2 = d.team2?.name ?? d.team2;
          if (t1 && t2) set.add(pairKey(t1, t2));
        });
        setWpAvailableKeys(set);
      } catch {
        setWpAvailableKeys(new Set());
      }
    };
    fetchAvailability();
    // eslint-disable-next-line
  }, [currentWeek, viewWeek]);

  if (useMarquee) {
    const getCardContentLength = (m: Matchup) =>
      (m.displayValue1?.length || 0) +
      (m.displayValue2?.length || 0) +
      (m.projected1?.length || 0) +
      (m.projected2?.length || 0) +
      (m.record1?.length || 0) +
      (m.record2?.length || 0);

    const maxContentLength = matchups.reduce(
      (max, m) => Math.max(max, getCardContentLength(m)),
      0
    );
    const baseWidth = 300;
    const widthPerChar = 8;
    const cardWidth = baseWidth + Math.max(0, maxContentLength - 20) * widthPerChar;
    const repeatedMatchups = [...matchups, ...matchups, ...matchups];

    return (
      <div
        style={{ background: "#0f0f0f", padding: "8px", cursor: "pointer" }}
        onClick={() => router.push("/matchups")}
        tabIndex={0}
        role="button"
        aria-label="Go to matchups"
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") router.push("/matchups");
        }}
      >
        <Marquee gradient={false} speed={60} pauseOnHover pauseOnClick>
          {repeatedMatchups.map((m, idx) => {
            const hasChart = wpAvailableKeys.has(pairKey(m.team1, m.team2));
            return (
              <div
                key={`${m.team1}-${m.team2}-${idx}`}
                style={{ display: "inline-block", marginRight: 32 }}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push("/matchups");
                }}
                tabIndex={0}
                role="button"
                aria-label="Go to matchups"
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") router.push("/matchups");
                }}
              >
                <MatchupCard
                  m={m}
                  style={{
                    width: cardWidth,
                    minWidth: cardWidth,
                    maxWidth: cardWidth,
                    display: "inline-block",
                    verticalAlign: "top"
                  }}
                  hasChart={hasChart}
                  showChartIcon={false}
                  week={""}
                />
              </div>
            );
          })}
        </Marquee>
      </div>
    );
  }

  const weekToShow = viewWeek !== null ? viewWeek : currentWeek;

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", color: "#fff" }}>
      <div className="max-w-3xl mx-auto px-4 pt-0">
        <header className="text-center mb-8 mt-8">
          <h1 className="text-5xl font-extrabold text-emerald-200 mb-2 tracking-tight">
            All Matchups
          </h1>
        </header>

        {/* Hide week selector while initializing (first load) */}
        {!initializing && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              position: "relative",
            }}
          >
            <button
              onClick={handlePrevWeek}
              disabled={weekToShow <= 1}
              style={{
                background: "none",
                border: "none",
                color: "#a7f3d0",
                fontSize: 28,
                cursor: weekToShow > 1 ? "pointer" : "not-allowed",
                marginRight: 12,
                opacity: weekToShow > 1 ? 1 : 0.5,
              }}
              aria-label="Previous Week"
            >
              &#60;
            </button>
            <div
              className="week-dropdown"
              style={{
                position: "relative",
                display: "inline-block",
                margin: "0 8px",
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  background: "#232323",
                  borderRadius: 12,
                  padding: "4px 18px",
                  color: "#a7f3d0",
                  border: "1px solid #444",
                  cursor: "pointer",
                  userSelect: "none",
                  display: "inline-block",
                }}
                onClick={() => setWeekDropdownOpen((open) => !open)}
                tabIndex={0}
                aria-haspopup="listbox"
                aria-expanded={weekDropdownOpen}
              >
                Week {weekToShow}
              </span>
              {weekDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "110%",
                    background: "#232323",
                    border: "1px solid #444",
                    borderRadius: 10,
                    zIndex: 10,
                    minWidth: 120,
                    boxShadow: "0 2px 8px #000a",
                    padding: "4px 0",
                    maxHeight: 260,
                    overflowY: "auto",
                  }}
                >
                  {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => {
                    // Weeks 15-17 grayed out until currentWeek >= 15
                    const isPlayoffWeek = w >= 15;
                    const isLocked = isPlayoffWeek && currentWeek < 15;
                    return (
                      <div
                        key={w}
                        style={{
                          padding: "8px 18px",
                          color: w === weekToShow
                            ? "#22c55e"
                            : isLocked
                              ? "#6b7280"
                              : "#fff",
                          background: w === weekToShow
                            ? "#166534"
                            : "transparent",
                          fontWeight: w === weekToShow ? 700 : 400,
                          fontSize: 17,
                          cursor: w === weekToShow || isLocked ? "default" : "pointer",
                          borderRadius: 8,
                          margin: "2px 4px",
                          transition: "background 0.15s",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                        onClick={() => {
                          if (!isLocked && w !== weekToShow) handleWeekDropdown(w);
                        }}
                        tabIndex={isLocked ? -1 : 0}
                        role="option"
                        aria-selected={w === weekToShow}
                        aria-disabled={isLocked}
                      >
                        Week {w}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={handleNextWeek}
              disabled={weekToShow >= maxWeek}
              style={{
                background: "none",
                border: "none",
                color: "#a7f3d0",
                fontSize: 28,
                cursor: weekToShow < maxWeek ? "pointer" : "not-allowed",
                marginLeft: 12,
                opacity: weekToShow < maxWeek ? 1 : 0.5,
              }}
              aria-label="Next Week"
            >
              &#62;
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: "0 0 32px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", marginTop: 40, color: "#a7f3d0" }}>
            Loading matchups...
          </div>
        ) : (
          matchups.map((m, idx) => {
            const hasChart = wpAvailableKeys.has(pairKey(m.team1, m.team2));
            return (
              <MatchupCard
                key={idx}
                m={m}
                showNames
                hasChart={hasChart}
                showRecapButton
                week={weekToShow} // <-- pass week from dropdown!
                onOpenChart={(mm) => {
                  if (!hasChart) return;
                  setChartSel({
                    team1: { name: mm.team1, logo: mm.avatar1 || "https://cdn-icons-png.flaticon.com/512/149/149071.png" },
                    team2: { name: mm.team2, logo: mm.avatar2 || "https://cdn-icons-png.flaticon.com/512/149/149071.png" },
                  });
                  setChartOpen(true);
                }}
              />
            );
          })
        )}
      </div>
      {chartOpen && chartSel && (
        <WinProbChartModal
          isOpen={chartOpen}
          onClose={() => setChartOpen(false)}
          selected={chartSel}
          season={String(new Date().getFullYear())}
          week={viewWeek !== null ? viewWeek : currentWeek}
        />
      )}
    </div>
  );
};

export default Matchups;