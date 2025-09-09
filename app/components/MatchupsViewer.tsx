"use client";

import React, { useEffect, useState, useRef } from "react";
import Marquee from "react-fast-marquee";
import { useRouter } from "next/navigation";

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
}

const TEAM_AVATARS: Record<string, string> = {};
const getAvatar = (teamName: string) =>
  TEAM_AVATARS[teamName] ||
  "https://cdn-icons-png.flaticon.com/512/149/149071.png";

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
      fontSize: 36,
      color:
        highlight === "win"
          ? "#22c55e"
          : highlight === "lose"
          ? "#dc2626"
          : "#e5e7eb",
      minWidth: 60,
      textAlign: align,
      display: "flex",
      flexDirection: "column",
      alignItems: align === "right" ? "flex-end" : "flex-start",
    }}
  >
    {value}
    {projected && (
      <span
        style={{
          fontWeight: 400,
          fontSize: 13,
          color: "#a7a7a7",
          marginTop: 2,
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
}) => (
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
      }}
    >
      {record}
    </span>
  </div>
);

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

const MatchupCard = ({
  m,
  showNames = false,
  style = {},
}: {
  m: Matchup;
  showNames?: boolean;
  style?: React.CSSProperties;
}) => {
  const win1 = Number(m.displayValue1) > Number(m.displayValue2);
  const win2 = Number(m.displayValue2) > Number(m.displayValue1);
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
      {showNames && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "22px 18px 0 18px",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 18,
              color: "#e5e7eb",
              textAlign: "left",
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              maxWidth: "48%",
            }}
          >
            {m.team1}
          </div>
          <div style={{ width: 18 }} />
          <div
            style={{
              fontWeight: 600,
              fontSize: 18,
              color: "#e5e7eb",
              textAlign: "right",
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              maxWidth: "48%",
            }}
          >
            {m.team2}
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: showNames ? "0 18px 0 18px" : "22px 18px 0 18px",
          marginTop: showNames ? 10 : 0,
          marginBottom: 8,
        }}
      >
        <AvatarBox src={m.avatar1} alt={m.team1} record={m.record1} />
        <ScoreBox
          value={m.displayValue1}
          projected={m.projected1}
          highlight={win1 ? "win" : win2 ? "lose" : "tie"}
          align="right"
        />
        <div style={{ fontWeight: 700, fontSize: 28, color: "#6b7280", margin: "0 4px" }}>/</div>
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
  const [currentWeek, setCurrentWeek] = useState<number>(() => {
    const savedWeek = localStorage.getItem("currentWeek");
    return savedWeek ? Number(savedWeek) : 1;
  });
  const [maxWeek, setMaxWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [isMatchupStarted, setIsMatchupStarted] = useState(false);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [viewWeek, setViewWeek] = useState<number | null>(null); // <-- add viewWeek state
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
          };
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

  // On mount, always load the correct week (for both main and marquee)
  useEffect(() => {
    fetchMatchups();
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
          {repeatedMatchups.map((m, idx) => (
            <div
              key={`${m.team1}-${m.team2}-${idx}`}
              style={{ display: "inline-block", marginRight: 32 }}
            >
              <MatchupCard
                m={m}
                style={{
                  width: cardWidth,
                  minWidth: cardWidth,
                  maxWidth: cardWidth,
                  display: "inline-block",
                  verticalAlign: "top",
                }}
              />
            </div>
          ))}
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
          <div className="text-base text-emerald-400">
            The Bok Choy League &bull; Week {weekToShow}
          </div>
        </header>
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
      </div>
      <div style={{ padding: "0 0 32px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", marginTop: 40, color: "#a7f3d0" }}>
            Loading matchups...
          </div>
        ) : (
          matchups.map((m, idx) => <MatchupCard key={idx} m={m} showNames />)
        )}
      </div>
    </div>
  );
};

export default Matchups;