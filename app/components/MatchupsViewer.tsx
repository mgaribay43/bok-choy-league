"use client";

import React, { useEffect, useRef, useState } from "react";
import Marquee from "react-fast-marquee";
import { getCurrentWeek } from "./globalUtils/getCurrentWeek";
import { WinProbChartModal, type WinProbChartSelection } from "./WinProbabilityTracker";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { EyeSlashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import IceTracker from "./ices/IceTracker";

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

// NFL Game interface for ESPN data
interface NFLGame {
  id: string;
  name: string;
  shortName: string;
  dateUTC: string;
  dateEST: string;
  status: string;
  statusDetail: string;
  week: number;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score: string;
    record: string;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score: string;
    record: string;
  };
  broadcast: string;
  venue: {
    name: string;
    city: string;
    state: string;
  };
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

// NFL team logos mapping
const NFL_TEAM_LOGOS: Record<string, string> = {
  "Arizona Cardinals": "https://a.espncdn.com/i/teamlogos/nfl/500/ari.png",
  "Atlanta Falcons": "https://a.espncdn.com/i/teamlogos/nfl/500/atl.png",
  "Baltimore Ravens": "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png",
  "Buffalo Bills": "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
  "Carolina Panthers": "https://a.espncdn.com/i/teamlogos/nfl/500/car.png",
  "Chicago Bears": "https://a.espncdn.com/i/teamlogos/nfl/500/chi.png",
  "Cincinnati Bengals": "https://a.espncdn.com/i/teamlogos/nfl/500/cin.png",
  "Cleveland Browns": "https://a.espncdn.com/i/teamlogos/nfl/500/cle.png",
  "Dallas Cowboys": "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png",
  "Denver Broncos": "https://a.espncdn.com/i/teamlogos/nfl/500/den.png",
  "Detroit Lions": "https://a.espncdn.com/i/teamlogos/nfl/500/det.png",
  "Green Bay Packers": "https://a.espncdn.com/i/teamlogos/nfl/500/gb.png",
  "Houston Texans": "https://a.espncdn.com/i/teamlogos/nfl/500/hou.png",
  "Indianapolis Colts": "https://a.espncdn.com/i/teamlogos/nfl/500/ind.png",
  "Jacksonville Jaguars": "https://a.espncdn.com/i/teamlogos/nfl/500/jax.png",
  "Kansas City Chiefs": "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
  "Las Vegas Raiders": "https://a.espncdn.com/i/teamlogos/nfl/500/lv.png",
  "Los Angeles Chargers": "https://a.espncdn.com/i/teamlogos/nfl/500/lac.png",
  "Los Angeles Rams": "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png",
  "Miami Dolphins": "https://a.espncdn.com/i/teamlogos/nfl/500/mia.png",
  "Minnesota Vikings": "https://a.espncdn.com/i/teamlogos/nfl/500/min.png",
  "New England Patriots": "https://a.espncdn.com/i/teamlogos/nfl/500/ne.png",
  "New Orleans Saints": "https://a.espncdn.com/i/teamlogos/nfl/500/no.png",
  "New York Giants": "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png",
  "New York Jets": "https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png",
  "Philadelphia Eagles": "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png",
  "Pittsburgh Steelers": "https://a.espncdn.com/i/teamlogos/nfl/500/pit.png",
  "San Francisco 49ers": "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png",
  "Seattle Seahawks": "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png",
  "Tampa Bay Buccaneers": "https://a.espncdn.com/i/teamlogos/nfl/500/tb.png",
  "Tennessee Titans": "https://a.espncdn.com/i/teamlogos/nfl/500/ten.png",
  "Washington Commanders": "https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png",
};

const getNFLLogo = (teamName: string) =>
  NFL_TEAM_LOGOS[teamName] || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// Auto-shrink text to fit one line without truncation
const AutoFitText: React.FC<{
  text: string;
  max: number;
  min: number;
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
      fontSize: "clamp(20px, 6.5vw, 36px)",
      color:
        highlight === "win"
          ? "#22c55e"
          : highlight === "lose"
            ? "#dc2626"
            : "#e5e7eb",
      minWidth: "clamp(52px, 16vw, 84px)",
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

const AvatarBox = ({
  src,
  alt,
  record,
}: {
  src?: string;
  alt: string;
  record: string;
}) => {
  const cleanRecord = (record || "").replace(/[()]/g, "");
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
          whiteSpace: "nowrap",
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

const isGameCompleted = (game: NFLGame): boolean => {
  return game.status === "Final" || game.status.includes("Final");
};

const isGameLiveOrUpcoming = (game: NFLGame): boolean => {
  return !isGameCompleted(game);
};

const NFLGameCard = ({ game }: { game: NFLGame }) => {
  const awayScore = parseInt(game.awayTeam.score) || 0;
  const homeScore = parseInt(game.homeTeam.score) || 0;

  const awayWin = awayScore > homeScore && game.status !== "Scheduled";
  const homeWin = homeScore > awayScore && game.status !== "Scheduled";

  const isLive = game.status === "In Progress" || game.status.includes("Quarter");
  const isFinished = game.status === "Final";

  const espnGameUrl = `https://www.espn.com/nfl/game/_/gameId/${game.id}`;

  return (
    <a
      href={espnGameUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-transform hover:scale-[1.02] active:scale-[0.98]"
      aria-label={`View ${game.shortName} on ESPN`}
    >
      <div
        style={{
          background: "#23252b",
          borderRadius: 16,
          margin: "16px auto",
          padding: 0,
          boxShadow: "0 2px 12px 0 #000",
          border: "2px solid #232323",
          maxWidth: 540,
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            background: isLive ? "#dc2626" : isFinished ? "#059669" : "#6b7280",
            color: "white",
            textAlign: "center",
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.5,
            position: "relative",
          }}
        >
          {game.status} {game.broadcast && `• ${game.broadcast}`}

          <div
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.7,
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            ESPN ↗
          </div>
        </div>

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
            <AutoFitText text={game.awayTeam.name} max={22} min={13} color="#e5e7eb" align="left" />
          </div>
          <div style={{ width: 12 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <AutoFitText text={game.homeTeam.name} max={22} min={13} color="#e5e7eb" align="right" />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 18px 0 18px",
            marginTop: 6,
            marginBottom: 8,
            gap: 8,
          }}
        >
          <AvatarBox
            src={getNFLLogo(game.awayTeam.name)}
            alt={game.awayTeam.name}
            record={game.awayTeam.record}
          />
          <ScoreBox
            value={game.awayTeam.score}
            highlight={awayWin ? "win" : homeWin ? "lose" : "tie"}
            align="right"
          />
          <div style={{ fontWeight: 700, fontSize: "clamp(20px, 5.5vw, 28px)", color: "#6b7280", margin: "0 2px" }}>
            @
          </div>
          <ScoreBox
            value={game.homeTeam.score}
            highlight={homeWin ? "win" : awayWin ? "lose" : "tie"}
            align="left"
          />
          <AvatarBox
            src={getNFLLogo(game.homeTeam.name)}
            alt={game.homeTeam.name}
            record={game.homeTeam.record}
          />
        </div>

        <div
          style={{
            background: "#1f2024",
            padding: "10px 18px",
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
            color: "#a7a7a7",
          }}
        >
          <span>{game.dateEST}</span>
          <span>{game.venue.city}, {game.venue.state}</span>
        </div>
      </div>
    </a>
  );
};

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
        margin: "16px auto",
        padding: 0,
        boxShadow: "0 2px 12px 0 #000",
        border: "2px solid #232323",
        maxWidth: 540,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {(showChartIcon || showRecapButton) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 10px 0 10px",
          }}
        >
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

const pollingRef = { current: null as null | NodeJS.Timeout };
const nflPollingRef = { current: null as null | NodeJS.Timeout };

const Matchups: React.FC<MatchupsViewerProps> = ({ Marquee: useMarquee = false }) => {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [nflGames, setNflGames] = useState<NFLGame[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [maxWeek, setMaxWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [nflLoading, setNflLoading] = useState(true);
  const [isMatchupStarted, setIsMatchupStarted] = useState(false);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const weekDropdownRef = useRef<HTMLDivElement>(null);
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartSel, setChartSel] = useState<WinProbChartSelection | null>(null);
  const [wpAvailableKeys, setWpAvailableKeys] = useState<Set<string>>(new Set());
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();

  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false
  );
  const [showNFL, setShowNFL] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false
  );
  const [hideCompletedGames, setHideCompletedGames] = useState(true);

  // Ice Tracker dropdown state (mirror behavior in Ices.tsx)
  const [iceTrackerOpen, setIceTrackerOpen] = useState(false);
  // ensure IceTracker is mounted even when collapsed (so it can poll)
  const [iceTrackerMounted, setIceTrackerMounted] = useState(false);
  useEffect(() => setIceTrackerMounted(true), []);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) {
        setShowNFL(true);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchNFLGames = async (weekOverride?: number, updateOnly = false) => {
    if (!updateOnly) setNflLoading(true);
    try {
      const weekParam = typeof weekOverride === "number" ? weekOverride : (viewWeek !== null ? viewWeek : currentWeek);

      const response = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/nflMatchups?week=${weekParam}&year=2025`
      );

      if (!response.ok) {
        console.error("NFL API error:", response.status);
        if (!updateOnly) setNflGames([]);
        return;
      }

      const data = await response.json();
      const games = data?.data?.games || [];

      if (updateOnly) {
        setNflGames(prevGames => {
          if (!prevGames.length) return games;
          return prevGames.map((old, i) => {
            const fresh = games[i];
            if (!fresh) return old;
            const changed =
              old.homeTeam.score !== fresh.homeTeam.score ||
              old.awayTeam.score !== fresh.awayTeam.score ||
              old.status !== fresh.status;
            return changed ? fresh : old;
          });
        });
      } else {
        setNflGames(games);
      }
    } catch (error) {
      console.error("Error fetching NFL games:", error);
      if (!updateOnly) setNflGames([]);
    } finally {
      if (!updateOnly) setNflLoading(false);
    }
  };

  const fetchMatchups = async (
    weekOverride?: number,
    updateOnlyScores = false,
    useViewWeek = false
  ) => {
    if (!updateOnlyScores) setLoading(true);
    try {
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
          data?.fantasy_content?.league?.[1]?.settings?.[0]?.stat_categories?.[0]?.stat_categories?.[0]?.stat_position_types?.[0]?.stat_position_type?.[1]?.max_week
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
          if (!prevMatchups.length) return formattedMatchups;
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

  useEffect(() => {
    async function fetchInitialWeek() {
      try {
        const season = new Date().getFullYear().toString();
        const week = await getCurrentWeek(season);
        setCurrentWeek(week);
        localStorage.setItem("currentWeek", String(week));
        await fetchMatchups(week);
        await fetchNFLGames(week);
      } catch {
        await fetchMatchups(1);
        await fetchNFLGames(1);
      } finally {
        setInitializing(false);
      }
    }
    fetchInitialWeek();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchMatchups(viewWeek !== null ? viewWeek : currentWeek, true, !!viewWeek);
    }, 15000);

    nflPollingRef.current = setInterval(() => {
      fetchNFLGames(viewWeek !== null ? viewWeek : currentWeek, true);
    }, 30000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (nflPollingRef.current) {
        clearInterval(nflPollingRef.current);
        nflPollingRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, [viewWeek, currentWeek]);

  const handlePrevWeek = () => {
    const week = (viewWeek !== null ? viewWeek : currentWeek) - 1;
    if (week >= 1) {
      setViewWeek(week);
      fetchMatchups(week, false, true);
      fetchNFLGames(week, false);
    }
  };

  const handleNextWeek = () => {
    const week = (viewWeek !== null ? viewWeek : currentWeek) + 1;
    if (week <= maxWeek) {
      setViewWeek(week);
      fetchMatchups(week, false, true);
      fetchNFLGames(week, false);
    }
  };

  const handleWeekDropdown = (w: number) => {
    setWeekDropdownOpen(false);
    setViewWeek(w);
    fetchMatchups(w, false, true);
    fetchNFLGames(w, false);
  };

  useEffect(() => {
    if (!weekDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        weekDropdownRef.current &&
        !weekDropdownRef.current.contains(e.target as Node)
      ) {
        setWeekDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [weekDropdownOpen]);

  const pairKeyById = (id1: string | number | undefined, id2: string | number | undefined) => {
    if (!id1 || !id2) return null;
    return [String(id1), String(id2)].sort().join(" | ");
  };

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, "WinProbabilities"));
        const seasonYear = String(new Date().getFullYear());
        const set = new Set<string>();
        snap.forEach((docSnap) => {
          const d: any = docSnap.data();
          const hasPoints = Array.isArray(d.points) && d.points.length > 0;
          const wk = Number(d.week);
          const seasonOk = String(d.season) === seasonYear;
          if (!seasonOk || wk !== (viewWeek !== null ? viewWeek : currentWeek) || !hasPoints) return;
          
          if (d.team1?.id && d.team2?.id) {
            const key = pairKeyById(d.team1.id, d.team2.id);
            if (key) set.add(key);
          }
        });
        setWpAvailableKeys(set);
      } catch {
        setWpAvailableKeys(new Set());
      }
    };
    fetchAvailability();
    // eslint-disable-next-line
  }, [currentWeek, viewWeek]);

  const filteredNFLGames = hideCompletedGames
    ? nflGames.filter(isGameLiveOrUpcoming)
    : nflGames;

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
            const keyById = pairKeyById(m.team1Id, m.team2Id);
            const hasChart = Boolean(keyById && wpAvailableKeys.has(keyById));
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
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 pt-0">
        <header className="text-center mb-6">
          <h1 className="text-5xl font-extrabold text-emerald-200 mb-2 tracking-tight">
            Matchups
          </h1>
        </header>

        {/* Controls Bar */}
        {!initializing && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 p-4 bg-gray-900/50 rounded-xl border border-gray-700">
            {/* Week Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevWeek}
                disabled={weekToShow <= 1}
                className="p-2 rounded-lg bg-gray-800 border border-gray-600 text-emerald-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous Week"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="relative" ref={weekDropdownRef}>
                <button
                  onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
                  className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-emerald-300 font-semibold hover:bg-gray-700 transition-colors min-w-[100px]"
                  aria-haspopup="listbox"
                  aria-expanded={weekDropdownOpen}
                >
                  Week {weekToShow}
                </button>

                {weekDropdownOpen && (
                  <div className="absolute top-full mt-1 left-0 bg-gray-800 border border-gray-600 rounded-lg min-w-[100px] max-h-60 overflow-y-auto shadow-xl z-30">
                    {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
                      <button
                        key={w}
                        onClick={() => w !== weekToShow && handleWeekDropdown(w)}
                        className={`w-full px-4 py-2 text-left transition-colors ${
                          w === weekToShow
                            ? "bg-emerald-600 text-white"
                            : "text-white hover:bg-gray-700"
                        }`}
                      >
                        Week {w}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleNextWeek}
                disabled={weekToShow >= maxWeek}
                className="p-2 rounded-lg bg-gray-800 border border-gray-600 text-emerald-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next Week"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-3">
              {!isDesktop && (
                <button
                  onClick={() => setShowNFL((prev) => !prev)}
                  className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                    showNFL
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  NFL Games
                </button>
              )}
              {showNFL && (
                <button
                  onClick={() => setHideCompletedGames((prev) => !prev)}
                  className={`px-4 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 ${
                    hideCompletedGames
                      ? "bg-orange-600 border-orange-500 text-white"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                  }`}
                  style={{ lineHeight: 1, height: 40, minHeight: 40 }}
                >
                  <span className="flex items-center justify-center" style={{ height: 20, width: 20 }}>
                    <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  Hide Final
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ice Tracker (centered below the header and above the controls/matchups) */}
      <div className="mb-6">
        <div className="flex justify-center">
          <div className="w-full max-w-3xl mx-auto mt-0 mb-6 px-2 sm:px-0">
            <button
              className="w-full sm:w-auto flex items-center justify-between bg-[#181818] border border-[#22d3ee] rounded-xl px-6 py-4 font-extrabold text-emerald-200 text-2xl shadow-md transition hover:bg-[#1a1a1a] focus:outline-none mx-auto"
              onClick={() => setIceTrackerOpen((open) => !open)}
              aria-expanded={iceTrackerOpen}
              aria-controls="ice-tracker-panel"
              style={{ minWidth: 280 }}
            >
              <span>Ice Tracker</span>
              <span style={{ fontSize: 20 }}>{iceTrackerOpen ? "▲" : "▼"}</span>
            </button>
            <div
              id="ice-tracker-panel"
              className={`transition-all duration-300 overflow-hidden ${iceTrackerOpen ? "max-h-[2000px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}
              aria-hidden={!iceTrackerOpen}
            >
              {iceTrackerMounted && (
                <div className={`w-full ${iceTrackerOpen ? "" : "pointer-events-none select-none"} mx-auto`}>
                  <IceTracker />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Grid Layout */}
      <div className="max-w-7xl mx-auto px- pb-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* NFL Games Column */}
          {showNFL && (
            <div className="space-y-4 xl:max-h-[80vh] xl:overflow-y-auto xl:pr-2">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#0f0f0f] z-10 xl:pt-4">
                <h2 className="text-2xl font-bold text-blue-300">
                  NFL Games
                </h2>
                <div className="text-sm text-gray-400">
                  {filteredNFLGames.length} of {nflGames.length} games
                  {hideCompletedGames && " (active only)"}
                </div>
              </div>
              {nflLoading ? (
                <div className="text-center py-8 text-emerald-300">
                  <div className="animate-spin w-8 h-8 border-2 border-emerald-300 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Loading NFL games...
                </div>
              ) : filteredNFLGames.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {hideCompletedGames && nflGames.length > 0
                    ? "No active NFL games"
                    : `No NFL games found for Week ${weekToShow}`}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredNFLGames.map((game) => (
                    <NFLGameCard key={game.id} game={game} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fantasy Matchups Column */}
          <div className="space-y-4 xl:max-h-[80vh] xl:overflow-y-auto xl:pr-2">
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#0f0f0f] z-10 xl:pt-4">
              <h2 className="text-2xl font-bold text-emerald-300">
                Fantasy Matchups
              </h2>
              <div className="text-sm text-gray-400">
                {matchups.length} matchups
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-emerald-300">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-300 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading matchups...
              </div>
            ) : matchups.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No matchups found for Week {weekToShow}
              </div>
            ) : (
              <div className="space-y-4">
                {matchups.map((m, idx) => {
                  const keyById = pairKeyById(m.team1Id, m.team2Id);
                  const hasChart = Boolean(keyById && wpAvailableKeys.has(keyById));
                  return (
                    <MatchupCard
                      key={idx}
                      m={m}
                      showNames
                      hasChart={hasChart}
                      showRecapButton
                      week={weekToShow}
                      onOpenChart={(mm) => {
                        if (!hasChart) return;
                        setChartSel({
                          team1: { 
                            name: mm.team1, 
                            logo: mm.avatar1 || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                            id: mm.team1Id
                          },
                          team2: { 
                            name: mm.team2, 
                            logo: mm.avatar2 || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                            id: mm.team2Id
                          },
                        });
                        setChartOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Win Probability Chart Modal */}
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