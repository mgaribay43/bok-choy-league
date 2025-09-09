'use client';

import React, { useEffect, useRef, useState } from "react";
import { getCurrentWeek } from "./globalUtils/getCurrentWeek";
import { getCurrentSeason } from "./globalUtils/getCurrentSeason";
import { getDocs } from "firebase/firestore";
import Chart from "chart.js/auto";
import Modal from "react-modal";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from "firebase/firestore";

type WinProbPoint = {
  time: string; // e.g. "End 1st", "Halftime", "End 3rd", or timestamp
  team1Pct: number;
  team2Pct: number;
};

type MatchupWinProb = {
  matchupId: string;
  team1: { name: string; logo: string };
  team2: { name: string; logo: string };
  points: WinProbPoint[];
  final: boolean;
};

const WinProbabilityTracker: React.FC = () => {
  const [season, setSeason] = useState<string>("");
  const [week, setWeek] = useState<number>(1);
  const [matchups, setMatchups] = useState<MatchupWinProb[]>([]);
  const [selected, setSelected] = useState<MatchupWinProb | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  // Fetch current season and week on mount
  useEffect(() => {
    async function fetchMeta() {
      const s = await getCurrentSeason();
      setSeason(s);
      const w = await getCurrentWeek(s);
      setWeek(w);
    }
    fetchMeta();
  }, []);

  // Poll Firestore for all matchups with points (remove YahooAPI polling)
  useEffect(() => {
    if (!season || !week) return;
    const db = getFirestore();
    const colRef = collection(db, "WinProbabilities");

    // Poll Firestore every 10 seconds for live updates
    const pollFirestore = () => {
      // Query all matchups for this season/week that have points
      getDocs(colRef).then((snapshot) => {
        const data: MatchupWinProb[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (
            d.season === season &&
            d.week === week &&
            Array.isArray(d.points) &&
            d.points.length > 0
          ) {
            data.push({
              matchupId: d.matchupId,
              team1: d.team1,
              team2: d.team2,
              points: d.points,
              final: !!d.final,
            });
          }
        });
        setMatchups(data);
      });
    };

    pollFirestore();
    const interval = setInterval(pollFirestore, 10000);

    return () => clearInterval(interval);
  }, [season, week]);

  // Draw chart when modal opens and a matchup is selected, and update live if points change
  useEffect(() => {
    if (!modalOpen || !selected) return;

    // Helper to draw or update the chart
    const drawChart = () => {
      if (!chartRef.current) return;

      // If chart exists, update data instead of recreating
      if (chartInstance.current) {
        const labels = selected.points.map((p, idx) => p.time || `T${idx + 1}`);
        const winProbLine = selected.points.map(
          (p) => ((p.team1Pct * 100) - (p.team2Pct * 100))
        );
        chartInstance.current.data.labels = labels;
        chartInstance.current.data.datasets[0].data = winProbLine;
        chartInstance.current.update();
        return;
      }

      // Otherwise, create the chart
      const labels = selected.points.map((p, idx) => p.time || `T${idx + 1}`);
      const winProbLine = selected.points.map(
        (p) => ((p.team1Pct * 100) - (p.team2Pct * 100))
      );

      chartInstance.current = new Chart(chartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Win Probability",
              data: winProbLine,
              borderColor: "#f87171", // fallback
              backgroundColor: "#f87171",
              fill: false,
              tension: 0.3,
              pointRadius: 0,
              segment: {
                borderColor: (ctx) => {
                  const v = ctx.p0.parsed.y;
                  return v >= 0 ? "#3b82f6" : "#f87171"; // blue if above, red if below
                },
              },
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: "Win Probability",
              color: "#fff",
              font: { size: 18, weight: "bold" },
            },
            tooltip: {
              mode: "index",
              intersect: false,
              yAlign: "top", // <-- Add this line
              callbacks: {
                label: (context) => {
                  const idx = context.dataIndex;
                  const point = selected.points[idx];
                  if (!point) return "";
                  if (point.team1Pct >= point.team2Pct) {
                    return `${selected.team1.name}: ${(point.team1Pct * 100).toFixed(1)}%`;
                  } else {
                    return `${selected.team2.name}: ${(point.team2Pct * 100).toFixed(1)}%`;
                  }
                },
                labelColor: (context) => {
                  const idx = context.dataIndex;
                  const point = selected.points[idx];
                  if (!point) return { borderColor: "#fff", backgroundColor: "#fff" };
                  if (point.team1Pct >= point.team2Pct) {
                    return { borderColor: "#3b82f6", backgroundColor: "#3b82f6" }; // blue
                  } else {
                    return { borderColor: "#f87171", backgroundColor: "#f87171" }; // red
                  }
                },
              },
              backgroundColor: "#222",
              titleColor: "#fff",
              bodyColor: "#fff",
              borderColor: "#3b82f6",
              borderWidth: 1,
            },
          },
          scales: {
            y: {
              min: -100,
              max: 100,
              ticks: {
                color: "#fff",
                callback: function (tickValue: string | number) {
                  if (tickValue === 100) return "100%";
                  if (tickValue === 0) return "50%";
                  if (tickValue === -100) return "100%";
                  return "";
                },
              },
              grid: { color: "#444" },
            },
            x: {
              ticks: { color: "#fff" },
              grid: { color: "#444" },
            },
          },
        },
      });
    };

    // Initial draw
    const timeout = setTimeout(drawChart, 50);

    return () => {
      clearTimeout(timeout);
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [modalOpen, selected]);

  // Update chart live if selected matchup's points change while modal is open
  useEffect(() => {
    if (!modalOpen || !selected || !chartInstance.current) return;
    const labels = selected.points.map((p, idx) => p.time || `T${idx + 1}`);
    const winProbLine = selected.points.map(
      (p) => ((p.team1Pct * 100) - (p.team2Pct * 100))
    );
    chartInstance.current.data.labels = labels;
    chartInstance.current.data.datasets[0].data = winProbLine;
    chartInstance.current.update();
  }, [selected?.points, modalOpen]);

  // Keep selected matchup in sync with live matchups data
  useEffect(() => {
    if (!modalOpen || !selected) return;
    const updated = matchups.find(m => m.matchupId === selected.matchupId);
    if (updated && updated.points.length !== selected.points.length) {
      setSelected(updated);
    }
  }, [matchups, modalOpen, selected]);

  // Lock background scroll when modal is open (like PlayerViewer)
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-emerald-300 mb-4">Win Probability Charts</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {matchups.map((m) => (
          <div
            key={m.matchupId}
            className="bg-[#181818] rounded-lg p-4 cursor-pointer hover:ring-2 ring-emerald-400"
            onClick={() => {
              setSelected(m);
              setModalOpen(true);
            }}
          >
            <div className="flex items-center gap-4 mb-2">
              <img src={m.team1.logo} alt={m.team1.name} className="w-10 h-10 rounded-full" />
              <span className="font-bold text-blue-300">{m.team1.name}</span>
              <span className="mx-2 text-emerald-400">vs</span>
              <img src={m.team2.logo} alt={m.team2.name} className="w-10 h-10 rounded-full" />
              <span className="font-bold text-red-300">{m.team2.name}</span>
            </div>
            <div className="text-xs text-gray-400">
              {m.points.length} win probability points tracked
            </div>
          </div>
        ))}
      </div>
      <Modal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        contentLabel="Win Probability Chart"
        className="bg-[#181818] rounded-lg p-6 max-w-lg mx-auto mt-20 outline-none max-h-[90vh] overflow-y-auto relative"
        overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
        ariaHideApp={false}
        shouldCloseOnOverlayClick={true}
      >
        {/* Top-right close button */}
        <button
          className="absolute top-2 right-4 text-2xl text-emerald-300"
          onClick={() => setModalOpen(false)}
          aria-label="Close"
        >
          &times;
        </button>
        {selected && (
          <div>
            {/* Chart heading */}
            <h3 className="text-xl font-bold text-center text-white mb-2 mt-2">
              Win Probability
            </h3>
            <div className="text-center text-emerald-300 font-semibold mb-6">
              Week {week}, {season}
            </div>
            <div className="relative flex flex-col items-center mb-4" style={{ minHeight: 440 }}>
              {/* Top team logo and name */}
              <div className="flex flex-col items-center" style={{ marginBottom: 8 }}>
                <img
                  src={selected.team1.logo}
                  alt={selected.team1.name}
                  className="w-12 h-12 rounded-full mb-1"
                  style={{ objectFit: "cover" }}
                />
                <span className="font-bold text-blue-300">{selected.team1.name}</span>
              </div>
              {/* Chart */}
              <div style={{ width: "100%", height: 320, position: "relative", zIndex: 1 }}>
                <canvas ref={chartRef} width={400} height={320} />
              </div>
              {/* Bottom team logo and name */}
              <div className="flex flex-col items-center mt-2">
                <img
                  src={selected.team2.logo}
                  alt={selected.team2.name}
                  className="w-12 h-12 rounded-full mb-1"
                  style={{ objectFit: "cover" }}
                />
                <span className="font-bold text-red-300">{selected.team2.name}</span>
              </div>
              {/* Download button */}
              <button
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow"
                onClick={async () => {
                  if (chartRef.current && selected) {
                    const chartCanvas = chartRef.current;
                    const chartCtx = chartCanvas.getContext("2d");
                    if (!chartCtx) return;

                    // iOS Safari workaround: open window synchronously
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
                    let win: Window | null = null;
                    if (isIOS) {
                      win = window.open();
                    }

                    // --- Layout constants (smaller logos and names) ---
                    const exportWidth = chartCanvas.width;
                    const chartAreaHeight = chartCanvas.height;
                    const logoSize = 40; // smaller logo
                    const nameFontSize = 24; // smaller name
                    const metaFontSize = 18; // for week/season
                    const nameHeight = nameFontSize + 8;
                    const metaHeight = metaFontSize + 8;
                    const topSectionHeight = 10 + logoSize + 8 + nameHeight + 4 + metaHeight + 10;
                    const bottomSectionHeight = logoSize + 8 + nameFontSize + 16;
                    const exportHeight = topSectionHeight + chartAreaHeight + bottomSectionHeight;

                    // --- Create a new canvas for export ---
                    const exportCanvas = document.createElement("canvas");
                    exportCanvas.width = exportWidth;
                    exportCanvas.height = exportHeight;
                    const ctx = exportCanvas.getContext("2d");
                    if (!ctx) return;

                    // Fill background
                    ctx.fillStyle = "#181818";
                    ctx.fillRect(0, 0, exportWidth, exportHeight);

                    // --- Draw top team logo ---
                    const team1Logo = new window.Image();
                    team1Logo.crossOrigin = "anonymous";
                    team1Logo.src = selected.team1.logo;
                    await new Promise((res) => {
                      team1Logo.onload = res;
                      team1Logo.onerror = res;
                    });
                    const topLogoY = 10;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(exportWidth / 2, topLogoY + logoSize / 2, logoSize / 2, 0, 2 * Math.PI);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(team1Logo, exportWidth / 2 - logoSize / 2, topLogoY, logoSize, logoSize);
                    ctx.restore();

                    // --- Draw top team name (smaller, blue) ---
                    ctx.font = `bold ${nameFontSize}px sans-serif`;
                    ctx.fillStyle = "#3b82f6";
                    ctx.textAlign = "center";
                    const topNameY = topLogoY + logoSize + 8 + nameFontSize;
                    ctx.fillText(selected.team1.name, exportWidth / 2, topNameY);

                    // --- Draw week and season below team name ---
                    ctx.font = `bold ${metaFontSize}px sans-serif`;
                    ctx.fillStyle = "#34d399"; // emerald-300
                    const metaY = topNameY + 4 + metaFontSize;
                    ctx.fillText(`Week ${week}, ${season}`, exportWidth / 2, metaY);

                    // --- Draw chart image ---
                    const chartY = topSectionHeight;
                    ctx.drawImage(chartCanvas, 0, chartY);

                    // --- Draw bottom team logo ---
                    const team2Logo = new window.Image();
                    team2Logo.crossOrigin = "anonymous";
                    team2Logo.src = selected.team2.logo;
                    await new Promise((res) => {
                      team2Logo.onload = res;
                      team2Logo.onerror = res;
                    });
                    const bottomLogoY = chartY + chartAreaHeight + 8;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(exportWidth / 2, bottomLogoY + logoSize / 2, logoSize / 2, 0, 2 * Math.PI);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(team2Logo, exportWidth / 2 - logoSize / 2, bottomLogoY, logoSize, logoSize);
                    ctx.restore();

                    // --- Draw bottom team name (smaller, red) ---
                    ctx.font = `bold ${nameFontSize}px sans-serif`;
                    ctx.fillStyle = "#f87171";
                    ctx.textAlign = "center";
                    const bottomNameY = bottomLogoY + logoSize + 8 + nameFontSize;
                    ctx.fillText(selected.team2.name, exportWidth / 2, bottomNameY);

                    // --- Download the composed image (iOS compatible) ---
                    const url = exportCanvas.toDataURL("image/png");

                    if (isIOS) {
                      if (win) {
                        win.document.write(
                          `<html><head><title>Chart</title></head><body style="margin:0;background:#181818;"><img src="${url}" style="width:100%;height:auto;display:block;"/></body></html>`
                        );
                      } else {
                        alert("Popup blocked. Please allow popups to download the image.");
                      }
                    } else {
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${selected.team1.name}_vs_${selected.team2.name}_winprob.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }
                }}
              >
                Download Chart
              </button>
            </div>
            {/* Bottom close button */}
            <div className="flex justify-center mt-6">
              <button
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded shadow"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WinProbabilityTracker;