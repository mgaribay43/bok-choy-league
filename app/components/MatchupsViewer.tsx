"use client";

import React, { useEffect, useState, useRef } from "react";
import Marquee from "react-fast-marquee";
import { useRouter } from "next/navigation";
import { getCurrentWeek } from "./globalUtils/getCurrentWeek";
import { WinProbChartModal, type WinProbChartSelection } from "./WinProbabilityTracker";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import MatchupDetails from "./matchupDetails";

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
  // NEW: recap
  recapUrl?: string;
  recapAvailable?: boolean;
  // NEW: to open MatchupDetails
  teamId1?: string;
  teamId2?: string;
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
  showChartIcon?: boolean; // existing
  showRecapButton?: boolean; // NEW
  // NEW: open details modal
  onOpenDetails?: (m: Matchup) => void;
};

const MatchupCard = ({
  m,
  showNames = false,
  style = {},
  onOpenChart,
  hasChart = true,
  showChartIcon = true,
  showRecapButton = false,
  onOpenDetails,
}: MatchupCardProps) => {
  const win1 = Number(m.displayValue1) > Number(m.displayValue2);
  const win2 = Number(m.displayValue2) > Number(m.displayValue1);

  // Add router for navigation
  const router = useRouter();

  // Helper to get current week (for correct navigation)
  const currentWeek = typeof window !== "undefined"
    ? Number(localStorage.getItem("currentWeek")) || 1
    : 1;

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
      onClick={() => onOpenDetails?.(m)}
      role="button"
      tabIndex={0}
    >
      {/* Top bar: recap (left) and chart (right). Hidden on marquee via props */}
      {(showChartIcon || (showRecapButton && m.recapUrl)) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 10px 0 10px",
            pointerEvents: "none", // allow inner buttons to toggle their own pointer events
          }}
        >
          {/* Week Recap left */}
          {showRecapButton && m.recapUrl ? (
            <a
              href={m.recapUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#0f1117",
                border: "1px solid #3a3d45",
                color: "#e5e7eb",
                borderRadius: 10,
                padding: "8px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
                pointerEvents: "auto",
              }}
              aria-label="Open week recap"
              title="Open week recap"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16v16H4z" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Week Recap</span>
            </a>
          ) : (
            <span />
          )}

          {/* Chart button right */}
          {showChartIcon && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                hasChart && onOpenChart?.(m);
              }}
              aria-label={hasChart ? "Open win probability chart" : "No chart data yet"}
              title={hasChart ? "Open win probability chart" : "No chart data yet"}
              disabled={!hasChart}
              style={{
                background: "#0f1117",
                border: "1px solid #3a3d45",
                color: hasChart ? "#e7e7eb" : "#6b7280",
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

      {showNames && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "10px 18px 0 18px", // full width; no right reserve needed
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{ cursor: "pointer", color: "#38bdf8", textDecoration: "underline" }}
              onClick={e => {
                e.stopPropagation();
                router.push(`/roster?year=2025&teamId=${m.teamId1}&week=${currentWeek}`);
              }}
              tabIndex={0}
              role="link"
              aria-label={`View ${m.team1} roster`}
            >
              <AutoFitText text={m.team1} max={22} min={13} color="#e5e7eb" align="left" />
            </span>
          </div>
          <div style={{ width: 12 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{ cursor: "pointer", color: "#38bdf8", textDecoration: "underline" }}
              onClick={e => {
                e.stopPropagation();
                router.push(`/roster?year=2025&teamId=${m.teamId2}&week=${currentWeek}`);
              }}
              tabIndex={0}
              role="link"
              aria-label={`View ${m.team2} roster`}
            >
              <AutoFitText text={m.team2} max={22} min={13} color="#e5e7eb" align="right" />
            </span>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: showNames ? "4px 18px 0 18px" : "18px 18px 0 18px", // no right reserve
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
  const [initializing, setInitializing] = useState(true); // NEW: hide controls on first load
  const [detailsOpen, setDetailsOpen] = useState(false);             // NEW
  const [detailsSel, setDetailsSel] = useState<Matchup | null>(null); // NEW
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

      // Only auto-advance currentWeek if not viewing a different week
      if (
        !useViewWeek &&
        lastStatusRef.current !== null &&
        lastStatusRef.current !== "postevent" &&
        status === "postevent" &&
        weekParam < maxW
      ) {
        lastStatusRef.current = status;
        setCurrentWeek(weekParam + 1);
        localStorage.setItem("currentWeek", String(weekParam + 1));
        fetchMatchups(weekParam + 1, false, false);
        return;
      }
      lastStatusRef.current = status;

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
          // NEW: recap info
          const recapAvailable =
            matchup.matchup.is_matchup_recap_available === 1 ||
            matchup.matchup.is_matchup_recap_available === "1";
          const recapUrl = recapAvailable ? matchup.matchup.matchup_recap_url : undefined;

          const team1Name =
            team1?.[0]?.find((item: any) => item.name)?.name || "Unknown Team 1";
          const team2Name =
            team2?.[0]?.find((item: any) => item.name)?.name || "Unknown Team 2";
          const team1Id = team1?.[0]?.find((item: any) => item.team_id)?.team_id || "";
          const team2Id = team2?.[0]?.find((item: any) => item.team_id)?.team_id || "";
          const team1Score = started ? parseFloat(team1?.[1]?.team_points?.total || "0") : 0;
          const team2Score = started ? parseFloat(team2?.[1]?.team_points?.total || "0") : 0;
          const team1Logo =
            team1?.[0]?.find((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png";
          const team2Logo =
            team2?.[0]?.find((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ||
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
            a2 = team2Logo,
            i1 = String(team1Id),
            i2 = String(team2Id);

          if (isFinished && started && team1Score !== team2Score) {
            if (team2Score > team1Score) {
              [t1, t2, s1, s2, r1, r2, a1, a2, i1, i2] = [t2, t1, s2, s1, r2, r1, a2, a1, i2, i1];
            }
            winnerOnTop = true;
          }

          const team1WinProbRaw = team1?.[1]?.win_probability;
          const team2WinProbRaw = team2?.[1]?.win_probability;
          const team1WinPct = typeof team1WinProbRaw === "number" ? team1WinProbRaw * 100 : 0;
          const team2WinPct = typeof team2WinProbRaw === "number" ? team2WinProbRaw * 100 : 0;
          const team1Proj = team1?.[1]?.team_projected_points?.total || "";
          const team2Proj = team2?.[1]?.team_projected_points?.total || "";

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
            teamId1: i1,               // NEW
            teamId2: i2,               // NEW
          } as Matchup;
        });

      if (updateOnlyScores) {
        setMatchups((prevMatchups) => {
          if (!prevMatchups.length) return formattedMatchups;
          return formattedMatchups.map((fresh, i) => {
            const old = prevMatchups[i];
            if (!old) return fresh;
            return {
              ...old,
              displayValue1: fresh.displayValue1,
              displayValue2: fresh.displayValue2,
              winPct1: fresh.winPct1,
              winPct2: fresh.winPct2,
              winnerOnTop: fresh.winnerOnTop,
              projected1: fresh.projected1,
              projected2: fresh.projected2,
            };
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

  useEffect(() => {
    if (isMatchupStarted) {
      pollingRef.current = setInterval(() => fetchMatchups(undefined, true), 15000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isMatchupStarted, currentWeek]);

  // Poll for scoreboard updates every minute
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMatchups(viewWeek !== null ? viewWeek : currentWeek, true, !!viewWeek);
    }, 60000);

    return () => clearInterval(interval);
  }, [viewWeek, currentWeek]);

  // Poll for scoring updates every 30 seconds
  useEffect(() => {
    // Only poll for scoring updates if viewing the current week
    if (viewWeek !== null && viewWeek !== currentWeek) return;

    const interval = setInterval(async () => {
      try {
        // Always use the currently viewed week
        const weekParam = currentWeek;
        const response = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=2025&week=${weekParam}`
        );
        const data = await response.json();
        const scoreboard = data?.fantasy_content?.league?.[1]?.scoreboard?.["0"];
        const matchupsData = scoreboard?.matchups;

        if (!matchupsData) return;

        // Format new scores only
        const formattedScores = Object.values(matchupsData)
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
            const team1Score = started ? parseFloat(team1?.[1]?.team_points?.total || "0") : 0;
            const team2Score = started ? parseFloat(team2?.[1]?.team_points?.total || "0") : 0;
            const team1Proj = team1?.[1]?.team_projected_points?.total || "";
            const team2Proj = team2?.[1]?.team_projected_points?.total || "";
            const team1WinProbRaw = team1?.[1]?.win_probability;
            const team2WinProbRaw = team2?.[1]?.win_probability;
            const team1WinPct = typeof team1WinProbRaw === "number" ? team1WinProbRaw * 100 : 0;
            const team2WinPct = typeof team2WinProbRaw === "number" ? team2WinProbRaw * 100 : 0;
            return {
              displayValue1: team1Score.toFixed(2),
              displayValue2: team2Score.toFixed(2),
              projected1: team1Proj,
              projected2: team2Proj,
              winPct1: team1WinPct,
              winPct2: team2WinPct,
            };
          });

        // Only update changed scores
        setMatchups((prevMatchups) => {
          if (!prevMatchups.length) return prevMatchups;
          return prevMatchups.map((old, i) => {
            const fresh = formattedScores[i];
            if (!fresh) return old;
            let changed = false;
            const updated: any = { ...old };
            if (old.displayValue1 !== fresh.displayValue1) {
              updated.displayValue1 = fresh.displayValue1;
              changed = true;
            }
            if (old.displayValue2 !== fresh.displayValue2) {
              updated.displayValue2 = fresh.displayValue2;
              changed = true;
            }
            if (old.projected1 !== fresh.projected1) {
              updated.projected1 = fresh.projected1;
              changed = true;
            }
            if (old.projected2 !== fresh.projected2) {
              updated.projected2 = fresh.projected2;
              changed = true;
            }
            if (old.winPct1 !== fresh.winPct1) {
              updated.winPct1 = fresh.winPct1;
              changed = true;
            }
            if (old.winPct2 !== fresh.winPct2) {
              updated.winPct2 = fresh.winPct2;
              changed = true;
            }
            return changed ? updated : old;
          });
        });
      } catch {
        // Ignore polling errors
      }
    }, 30000);

    return () => clearInterval(interval);
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
              <div key={`${m.team1}-${m.team2}-${idx}`} style={{ display: "inline-block", marginRight: 32 }}>
                <MatchupCard
                  m={m}
                  style={{ width: cardWidth, minWidth: cardWidth, maxWidth: cardWidth, display: "inline-block", verticalAlign: "top" }}
                  hasChart={hasChart}
                  showChartIcon={false} // HIDE icon on marquee cards
                  onOpenChart={(mm) => {
                    if (!hasChart) return;
                    setChartSel({
                      team1: { name: mm.team1, logo: getAvatar(mm.team1) },
                      team2: { name: mm.team2, logo: getAvatar(mm.team2) },
                    });
                    setChartOpen(true);
                  }}
                />
              </div>
            );
          })}
        </Marquee>
      </div>
    );
  }

  const weekToShow = viewWeek !== null ? viewWeek : currentWeek;
  const seasonYear = String(new Date().getFullYear()); // for MatchupDetails

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
                  {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
                    <div
                      key={w}
                      style={{
                        padding: "8px 18px",
                        color: w === weekToShow ? "#22c55e" : "#fff",
                        background: w === weekToShow ? "#166534" : "transparent",
                        fontWeight: w === weekToShow ? 700 : 400,
                        fontSize: 17,
                        cursor: w === weekToShow ? "default" : "pointer",
                        borderRadius: 8,
                        margin: "2px 4px",
                        transition: "background 0.15s",
                      }}
                      onClick={() => handleWeekDropdown(w)}
                      tabIndex={0}
                      role="option"
                      aria-selected={w === weekToShow}
                    >
                      Week {w}
                    </div>
                  ))}
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
                onOpenChart={(mm) => {
                  if (!hasChart) return;
                  setChartSel({
                    team1: { name: mm.team1, logo: mm.avatar1 || "https://cdn-icons-png.flaticon.com/512/149/149071.png" },
                    team2: { name: mm.team2, logo: mm.avatar2 || "https://cdn-icons-png.flaticon.com/512/149/149071.png" },
                  });
                  setChartOpen(true);
                }}
                onOpenDetails={(mm) => {
                  setDetailsSel(mm);
                  setDetailsOpen(true);
                }}
              />
            );
          })
        )}
      </div>

      {/* NEW: MatchupDetails modal */}
      {detailsOpen && detailsSel && (
        <MatchupDetails
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          season={seasonYear}
          week={weekToShow}
          team1={{
            id: detailsSel.teamId1 || "",
            name: detailsSel.team1,
            logo: detailsSel.avatar1,
            record: detailsSel.record1,
            score: Number(detailsSel.displayValue1) || 0,
            projected: Number.isFinite(Number(detailsSel.projected1)) ? Number(detailsSel.projected1) : undefined,
          }}
          team2={{
            id: detailsSel.teamId2 || "",
            name: detailsSel.team2,
            logo: detailsSel.avatar2,
            record: detailsSel.record2,
            score: Number(detailsSel.displayValue2) || 0,
            projected: Number.isFinite(Number(detailsSel.projected2)) ? Number(detailsSel.projected2) : undefined,
          }}
          winPct1={detailsSel.winPct1}
          winPct2={detailsSel.winPct2}
        />
      )}

      {chartOpen && chartSel && (
        <WinProbChartModal
          isOpen={chartOpen}
          onClose={() => setChartOpen(false)}
          selected={chartSel}
          season={seasonYear}
          week={weekToShow}
        />
      )}
    </div>
  );
};

export default Matchups;