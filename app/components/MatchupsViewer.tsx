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
  "https://cdn-icons-png.flaticon.com/512/149/149071.png"; // fallback avatar

function getGreenShade(pct: number) {
  // pct: 0-100
  // 0% = #bbf7d0 (light), 100% = #22c55e (dark)
  const light = [187, 247, 208]; // #bbf7d0
  const dark = [34, 197, 94];   // #22c55e
  const t = Math.max(0, Math.min(1, pct / 100));
  const r = Math.round(light[0] + (dark[0] - light[0]) * t);
  const g = Math.round(light[1] + (dark[1] - light[1]) * t);
  const b = Math.round(light[2] + (dark[2] - light[2]) * t);
  return `rgb(${r},${g},${b})`;
}

interface MatchupsViewerProps {
  Marquee?: boolean;
}

const Matchups: React.FC<MatchupsViewerProps> = ({ Marquee: useMarquee = false }) => {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [maxWeek, setMaxWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [isMatchupStarted, setIsMatchupStarted] = useState(false);
  const [isWeekFinished, setIsWeekFinished] = useState(false);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Helper for EST Wednesday 10am
  function isAfterWednesday10amEST() {
    const now = new Date();
    const estNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    return estNow.getDay() > 3 || (estNow.getDay() === 3 && estNow.getHours() >= 10);
  }

  // Fetch matchups and standings
  const fetchMatchups = async (weekOverride?: number, updateOnlyScores = false) => {
    if (!updateOnlyScores) setLoading(true);
    try {
      let weekParam = weekOverride ?? currentWeek;
      if (!updateOnlyScores) setCurrentWeek(weekParam);

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

      // --- Week status logic ---
      // Use status from scoreboard for polling, and week_end for completion
      const status = scoreboard?.status;
      const weekEndStr = scoreboard?.week_end; // e.g. "2025-09-15"
      let weekIsOver = false;
      if (weekEndStr) {
        const now = new Date();
        const weekEnd = new Date(weekEndStr + "T23:59:59-05:00"); // Yahoo times are EST/EDT
        weekIsOver = now > weekEnd;
      }
      setIsWeekFinished(weekIsOver);

      // Only poll for scoring updates if status is "midevent"
      setIsMatchupStarted(status === "midevent");

      // --- Default to next week if previous week is over and it's the initial load ---
      if (
        !updateOnlyScores &&
        initialLoad &&
        status === "postevent" &&
        weekParam < maxW
      ) {
        setInitialLoad(false);
        setCurrentWeek(weekParam + 1);
        // Refetch for next week, but don't setInitialLoad again
        fetchMatchups(weekParam + 1, false);
        return;
      }
      setInitialLoad(false);

      const matchupsData = scoreboard?.matchups;
      if (!matchupsData) {
        if (!updateOnlyScores) setMatchups([]);
        setLoading(false);
        return;
      }

      // Standings for records (only needed for full reload, not polling)
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

      // Transform the data into the Matchup format
      const formattedMatchups = Object.values(matchupsData)
        .filter(
          (matchup: any) =>
            matchup &&
            matchup.matchup &&
            matchup.matchup["0"] &&
            matchup.matchup["0"].teams
        )
        .map((matchup: any, idx: number) => {
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

          // Extract team logo URLs from team_logos array
          const team1Logo =
            team1?.[0]?.find((item: any) => item.team_logos)?.team_logos?.[0]
              ?.team_logo?.url ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png";
          const team2Logo =
            team2?.[0]?.find((item: any) => item.team_logos)?.team_logos?.[0]
              ?.team_logo?.url ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png";

          // Winner on top if week is finished and scores are available
          const isFinished =
            scoreboard?.is_finished === 1;
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
          // Do NOT round the win percentages for the bar
          const team1WinPct =
            typeof team1WinProbRaw === "number"
              ? team1WinProbRaw * 100
              : 0;
          const team2WinPct =
            typeof team2WinProbRaw === "number"
              ? team2WinProbRaw * 100
              : 0;

          // Always show projected points, even if week hasn't started
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

      // Only update scores, win percentages, projections, and winnerOnTop if changed (for polling)
      if (updateOnlyScores) {
        setMatchups((prevMatchups) => {
          if (!prevMatchups.length) return formattedMatchups;

          // Always create a new array to ensure React detects the change
          const updated = formattedMatchups.map((fresh, i) => {
            const old = prevMatchups[i];
            if (!old) return fresh; // Handle case where lengths differ

            // Update only the fields that can change during polling
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

          return updated;
        });
      } else {
        setMatchups(formattedMatchups);
      }
    } catch (error) {
      if (!updateOnlyScores) setMatchups([]);
    } finally {
      if (!updateOnlyScores) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchups();
    // eslint-disable-next-line
  }, []);

  // Polling logic (background, only update scores)
  useEffect(() => {
    if (isMatchupStarted) {
      pollingRef.current = setInterval(() => fetchMatchups(currentWeek, true), 15000);
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

  // Week navigation
  const handlePrevWeek = () => {
    if (currentWeek > 1) fetchMatchups(currentWeek - 1);
  };
  const handleNextWeek = () => {
    if (currentWeek < maxWeek) fetchMatchups(currentWeek + 1);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!weekDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".week-dropdown")) setWeekDropdownOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [weekDropdownOpen]);

  if (useMarquee) {
    // Dynamically determine the max card width based on the longest card content
    // We'll use the length of the score/projection/record strings for both teams
    const getCardContentLength = (m: Matchup) => {
      // Only count the visible content in the marquee: avatars, scores, projections, win % bar
      // We'll use the length of displayValue1/2, projected1/2, record1/2
      return (
        (m.displayValue1?.length || 0) +
        (m.displayValue2?.length || 0) +
        (m.projected1?.length || 0) +
        (m.projected2?.length || 0) +
        (m.record1?.length || 0) +
        (m.record2?.length || 0)
      );
    };

    const maxContentLength = matchups.reduce(
      (max, m) => Math.max(max, getCardContentLength(m)),
      0
    );

    // Set a base width and add extra width per character over a threshold
    const baseWidth = 300;
    const widthPerChar = 8;
    const cardWidth = baseWidth + Math.max(0, maxContentLength - 20) * widthPerChar;

    // Repeat the matchups array to fill the marquee and avoid flashing
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
              style={{
                background: "#23252b",
                borderRadius: 16,
                margin: "24px 20px",
                padding: "0",
                boxShadow: "0 2px 12px 0 #000",
                border: "2px solid #232323",
                width: cardWidth,
                minWidth: cardWidth,
                maxWidth: cardWidth,
                position: "relative",
                overflow: "hidden",
                display: "inline-block",
                verticalAlign: "top",
              }}
            >
              {/* Middle row: Avatars and scores (NO TEAM NAMES) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "22px 18px 0 18px",
                  marginTop: 0,
                  marginBottom: 8,
                }}
              >
                {/* Team 1 Avatar and Record */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <img
                    src={m.avatar1}
                    alt={m.team1}
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
                    {m.record1}
                  </span>
                </div>
                {/* Team 1 Score */}
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 36,
                    color:
                      Number(m.displayValue1) > Number(m.displayValue2)
                        ? "#22c55e"
                        : Number(m.displayValue1) < Number(m.displayValue2)
                            ? "#dc2626"
                            : "#e5e7eb", // default color if tied
                    minWidth: 60,
                    textAlign: "right",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                  }}
                >
                  {m.displayValue1}
                  {m.projected1 && (
                    <span
                      style={{
                        fontWeight: 400,
                        fontSize: 13,
                        color: "#a7a7a7",
                        marginTop: 2,
                      }}
                    >
                      proj: {Number(m.projected1).toFixed(2)}
                    </span>
                  )}
                </div>
                {/* Divider */}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 28,
                    color: "#6b7280",
                    margin: "0 4px",
                  }}
                >
                  /
                </div>
                {/* Team 2 Score */}
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 36,
                    color:
                      Number(m.displayValue2) > Number(m.displayValue1)
                        ? "#22c55e"
                        : Number(m.displayValue2) < Number(m.displayValue1)
                            ? "#dc2626"
                            : "#e5e7eb", // default color if tied
                    minWidth: 60,
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                  }}
                >
                  {m.displayValue2}
                  {m.projected2 && (
                    <span
                      style={{
                        fontWeight: 400,
                        fontSize: 13,
                        color: "#a7a7a7",
                        marginTop: 2,
                      }}
                    >
                      proj: {Number(m.projected2).toFixed(2)}
                    </span>
                  )}
                </div>
                {/* Team 2 Avatar and Record */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <img
                    src={m.avatar2}
                    alt={m.team2}
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
                    {m.record2}
                  </span>
                </div>
              </div>
              {/* Bottom row: Win % bar and numbers */}
              <div
                style={{
                  background: "#23252b",
                  padding: "0 0 0 0",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#dc2626",
                    padding: "0 22px",
                  }}
                >
                  <span style={{ color: (m.winPct1 ?? 0) >= (m.winPct2 ?? 0) ? "#22c55e" : "#dc2626" }}>{Math.round(m.winPct1 ?? 0)}%</span>
                  <span
                    style={{
                      color: "#a7a7a7",
                      fontWeight: 600,
                      fontSize: 15,
                      letterSpacing: 1,
                    }}
                  >
                    Win %
                  </span>
                  <span style={{ color: (m.winPct2 ?? 0) > (m.winPct1 ?? 0) ? "#22c55e" : "#dc2626" }}>{Math.round(m.winPct2 ?? 0)}%</span>
                </div>
                {/* Win % Bar */}
                <div
                  style={{
                    position: "relative",
                    height: 8,
                    background: "#18191b",
                    borderRadius: 8,
                    margin: "10px 0 0 0",
                  }}
                >
                  {/* Team 1 (left, purple) */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${m.winPct1}%`,
                      background: "#6f49e0ff",
                      borderTopLeftRadius: 8,
                      borderBottomLeftRadius: 8,
                      transition: "width 0.4s",
                    }}
                  />
                  {/* Team 2 (right, blue) */}
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      height: "100%",
                      width: `${m.winPct2}%`,
                      background: "#8b96f1ff",
                      borderTopRightRadius: 8,
                      borderBottomRightRadius: 8,
                      transition: "width 0.4s",
                    }}
                  />
                  {/* Divider marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${m.winPct1}%`,
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
            </div>
          ))}
        </Marquee>
      </div>
    );
  }

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", color: "#fff" }}>
      <div className="max-w-3xl mx-auto px-4 pt-0">
        <header className="text-center mb-8 mt-8">
          <h1 className="text-5xl font-extrabold text-emerald-200 mb-2 tracking-tight">
            All Matchups
          </h1>
          <div className="text-base text-emerald-400">
            The Bok Choy League &bull; Week {currentWeek}
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
            disabled={currentWeek <= 1}
            style={{
              background: "none",
              border: "none",
              color: "#a7f3d0",
              fontSize: 28,
              cursor: currentWeek > 1 ? "pointer" : "not-allowed",
              marginRight: 12,
              opacity: currentWeek > 1 ? 1 : 0.5,
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
              Week {currentWeek}
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
                      color: w === currentWeek ? "#22c55e" : "#fff",
                      background: w === currentWeek ? "#166534" : "transparent",
                      fontWeight: w === currentWeek ? 700 : 400,
                      fontSize: 17,
                      cursor: w === currentWeek ? "default" : "pointer",
                      borderRadius: 8,
                      margin: "2px 4px",
                      transition: "background 0.15s",
                    }}
                    onClick={() => {
                      if (w !== currentWeek) {
                        setWeekDropdownOpen(false);
                        fetchMatchups(w);
                      }
                    }}
                    tabIndex={0}
                    role="option"
                    aria-selected={w === currentWeek}
                  >
                    Week {w}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleNextWeek}
            disabled={currentWeek >= maxWeek}
            style={{
              background: "none",
              border: "none",
              color: "#a7f3d0",
              fontSize: 28,
              cursor: currentWeek < maxWeek ? "pointer" : "not-allowed",
              marginLeft: 12,
              opacity: currentWeek < maxWeek ? 1 : 0.5,
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
          matchups.map((m, idx) => {
            // Responsive: use window width or a media query hook for production
            // For this example, use CSS classes for mobile/desktop
            const win1 = Number(m.displayValue1) > Number(m.displayValue2);
            const win2 = Number(m.displayValue2) > Number(m.displayValue1);

            return (
              <div
                key={idx}
                style={{
                  background: "#23252b",
                  borderRadius: 16,
                  margin: "24px auto",
                  padding: "0",
                  boxShadow: "0 2px 12px 0 #000",
                  border: "2px solid #232323",
                  maxWidth: 540,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Top row: Team names */}
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
                {/* Middle row: Avatars and scores */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 18px 0 18px",
                    marginTop: 10,
                    marginBottom: 8,
                  }}
                >
                  {/* Team 1 Avatar */}
                  <img
                    src={m.avatar1}
                    alt={m.team1}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "none",
                      background: "#18191b",
                    }}
                  />
                  {/* Team 1 Score */}
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 36,
                      color:
                        Number(m.displayValue1) > Number(m.displayValue2)
                          ? "#22c55e"
                          : Number(m.displayValue1) < Number(m.displayValue2)
                              ? "#dc2626"
                              : "#e5e7eb",
                      minWidth: 60,
                      textAlign: "right",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                    }}
                  >
                    {m.displayValue1}
                    {m.projected1 && (
                      <span
                        style={{
                          fontWeight: 400,
                          fontSize: 13,
                          color: "#a7a7a7",
                          marginTop: 2,
                        }}
                      >
                        proj: {Number(m.projected1).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* Divider */}
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 28,
                      color: "#6b7280",
                      margin: "0 4px",
                    }}
                  >
                    /
                  </div>
                  {/* Team 2 Score */}
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 36,
                      color:
                        Number(m.displayValue2) > Number(m.displayValue1)
                          ? "#22c55e"
                          : Number(m.displayValue2) < Number(m.displayValue1)
                            ? "#dc2626"
                            : "#e5e7eb", // default color if tied
                      minWidth: 60,
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    {m.displayValue2}
                    {m.projected2 && (
                      <span
                        style={{
                          fontWeight: 400,
                          fontSize: 13,
                          color: "#a7a7a7",
                          marginTop: 2,
                        }}
                      >
                        proj: {Number(m.projected2).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* Team 2 Avatar */}
                  <img
                    src={m.avatar2}
                    alt={m.team2}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "none",
                      background: "#18191b",
                    }}
                  />
                </div>
                {/* Bottom row: Win % bar and numbers */}
                <div
                  style={{
                    background: "#23252b",
                    padding: "0 0 0 0",
                    marginTop: 8,
                    marginBottom: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      fontSize: 16,
                      color: "#dc2626",
                      padding: "0 22px",
                    }}
                  >
                    <span style={{ color: (m.winPct1 ?? 0) >= (m.winPct2 ?? 0) ? "#22c55e" : "#dc2626" }}>{Math.round(m.winPct1 ?? 0)}%</span>
                    <span
                      style={{
                        color: "#a7a7a7",
                        fontWeight: 600,
                        fontSize: 15,
                        letterSpacing: 1,
                      }}
                    >
                      Win %
                    </span>
                    <span style={{ color: (m.winPct2 ?? 0) > (m.winPct1 ?? 0) ? "#22c55e" : "#dc2626" }}>{Math.round(m.winPct2 ?? 0)}%</span>
                  </div>
                  {/* Win % Bar */}
                  <div
                    style={{
                      position: "relative",
                      height: 8,
                      background: "#18191b",
                      borderRadius: 8,
                      margin: "10px 0 0 0",
                    }}
                  >
                    {/* Team 1 (left, purple) */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: "100%",
                        width: `${m.winPct1}%`,
                        background: "#6f49e0ff",
                        borderTopLeftRadius: 8,
                        borderBottomLeftRadius: 8,
                        transition: "width 0.4s",
                      }}
                    />
                    {/* Team 2 (right, blue) */}
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        height: "100%",
                        width: `${m.winPct2}%`,
                        background: "#8b96f1ff",
                        borderTopRightRadius: 8,
                        borderBottomRightRadius: 8,
                        transition: "width 0.4s",
                      }}
                    />
                    {/* Divider marker */}
                    <div
                      style={{
                        position: "absolute",
                        left: `${m.winPct1}%`,
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Matchups;