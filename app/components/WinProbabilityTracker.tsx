'use client';

import React, { useEffect, useRef, useState } from "react";
import { getCurrentWeek } from "./globalUtils/getCurrentWeek";
import { getCurrentSeason } from "./globalUtils/getCurrentSeason";
import { getDocs } from "firebase/firestore";
import Chart from "chart.js/auto";
import Modal from "react-modal";
import { getFirestore, collection } from "firebase/firestore";
import annotationPlugin from "chartjs-plugin-annotation";

Chart.register(annotationPlugin);

// Add these shared types and helpers near the top (before they are referenced)
type WinProbPoint = {
  time: string;
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

// Day label helper
function getDayFromTimeLabel(time: string) {
  const abbr = time.split(" ")[0]; // e.g., "Thu 07:38:02 PM"
  return abbr || "";
}

// Dull gray for vertical split lines
const SPLIT_LINE_COLOR = "rgba(148, 163, 184, 0.45)";

// Safe image loader (avoid canvas taint)
async function safeLoadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(src, { mode: "cors", cache: "no-store" });
    if (!res.ok) throw new Error("bad status");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

function isIOSDevice() {
  const ua = navigator.userAgent || navigator.vendor;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = /Macintosh/.test(ua) && "ontouchend" in document;
  return iOS || iPadOS;
}

export type WinProbChartSelection = {
  matchupId?: string;
  team1: { name: string; logo: string };
  team2: { name: string; logo: string };
  points?: WinProbPoint[];
  final?: boolean;
};

type WinProbChartModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selected: WinProbChartSelection | null;
  season: string;
  week: number;
};

export const WinProbChartModal: React.FC<WinProbChartModalProps> = ({
  isOpen,
  onClose,
  selected,
  season,
  week,
}) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  // build split lines
  const buildDaySplitAnnotations = (points: WinProbPoint[]) => {
    const regions: { day: string; start: number; end: number }[] = [];
    let currentDay = "";
    let regionStart = 0;
    points.forEach((p, idx) => {
      const day = getDayFromTimeLabel(p.time);
      if (day !== currentDay) {
        if (currentDay) regions.push({ day: currentDay, start: regionStart, end: idx - 1 });
        currentDay = day;
        regionStart = idx;
      }
      if (idx === points.length - 1) regions.push({ day, start: regionStart, end: idx });
    });
    return regions.slice(1).map((r) => ({
      type: "line",
      xMin: r.start - 0.5,
      xMax: r.start - 0.5,
      borderColor: SPLIT_LINE_COLOR,
      borderWidth: 1,
      drawTime: "beforeDatasetsDraw",
    }));
  };

  const buildCenteredDayLabels = (points: WinProbPoint[]) => {
    const regions: { day: string; start: number; end: number }[] = [];
    let currentDay = "";
    let regionStart = 0;
    points.forEach((p, idx) => {
      const day = getDayFromTimeLabel(p.time);
      if (day !== currentDay) {
        if (currentDay) regions.push({ day: currentDay, start: regionStart, end: idx - 1 });
        currentDay = day;
        regionStart = idx;
      }
      if (idx === points.length - 1) regions.push({ day, start: regionStart, end: idx });
    });
    const labels = points.map(() => "");
    regions.forEach((r) => {
      const center = Math.floor((r.start + r.end) / 2);
      labels[center] = r.day;
    });
    return labels;
  };

  // Pull points from Firestore if not provided
  const [resolved, setResolved] = useState<WinProbChartSelection | null>(selected);
  useEffect(() => {
    let mounted = true;
    const fetchIfNeeded = async () => {
      if (!isOpen || !selected) return;
      if (selected.points?.length) {
        setResolved(selected);
        return;
      }
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, "WinProbabilities"));
        let match: any = null;
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          if (
            d.season === season &&
            d.week === week &&
            d.points?.length &&
            (
              (d.team1?.name === selected.team1.name && d.team2?.name === selected.team2.name) ||
              (d.team1?.name === selected.team2.name && d.team2?.name === selected.team1.name)
            )
          ) {
            match = d;
          }
        });
        if (!mounted) return;
        if (match) {
          setResolved({
            matchupId: match.matchupId,
            team1: match.team1,
            team2: match.team2,
            points: match.points,
            final: !!match.final,
          });
        } else {
          setResolved(selected); // no points found, still open the modal gracefully
        }
      } catch {
        setResolved(selected);
      }
    };
    fetchIfNeeded();
    return () => {
      mounted = false;
    };
  }, [isOpen, selected, season, week]);

  // Draw/Update chart
  useEffect(() => {
    if (!isOpen || !resolved || !resolved.points?.length || !chartRef.current) return;

    const labels = buildCenteredDayLabels(resolved.points);
    const series = resolved.points.map((p) => (p.team1Pct * 100) - (p.team2Pct * 100));
    const daySplits = buildDaySplitAnnotations(resolved.points);

    if (chartInstance.current) {
      chartInstance.current.data.labels = labels;
      chartInstance.current.data.datasets[0].data = series;
      (chartInstance.current.options.plugins as any).annotation = { annotations: daySplits };
      chartInstance.current.update();
      return;
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Win Probability",
            data: series,
            borderColor: "#f87171",
            backgroundColor: "#f87171",
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            segment: {
              borderColor: (ctx) => (ctx.p0.parsed.y >= 0 ? "#3b82f6" : "#f87171"),
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
            yAlign: "top",
            callbacks: {
              label: (context) => {
                const idx = context.dataIndex;
                const point = resolved.points?.[idx];
                if (!point) return "";
                return point.team1Pct >= point.team2Pct
                  ? `${resolved.team1.name}: ${(point.team1Pct * 100).toFixed(1)}%`
                  : `${resolved.team2.name}: ${(point.team2Pct * 100).toFixed(1)}%`;
              },
              labelColor: (context) => {
                const idx = context.dataIndex;
                const point = resolved.points?.[idx];
                if (!point) return { borderColor: "#fff", backgroundColor: "#fff" };
                return point.team1Pct >= point.team2Pct
                  ? { borderColor: "#3b82f6", backgroundColor: "#3b82f6" }
                  : { borderColor: "#f87171", backgroundColor: "#f87171" };
              },
            },
            backgroundColor: "#222",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: "#3b82f6",
            borderWidth: 1,
          },
          annotation: { annotations: daySplits } as any,
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
            grid: {
              // keep only the midline visible
              color: (ctx: { tick: { value: number } }) =>
                ctx.tick.value === 0 ? "#888" : "transparent",
              lineWidth: (ctx: { tick: { value: number } }) =>
                ctx.tick.value === 0 ? 2 : 0,
              drawTicks: false,
            },
            // v4: axis border config lives here
            border: {
              display: true,
              color: "rgba(148,163,184,0.7)",
              width: 1,
            },
          },
          x: {
            ticks: {
              display: true,
              autoSkip: false,
              color: "#fff",
              maxRotation: 0,
              minRotation: 0,
            },
            grid: {
              color: "transparent",
              drawTicks: false,
            },
            // v4: axis border config
            border: {
              display: true,
              color: "rgba(148,163,184,0.7)",
              width: 1,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [isOpen, resolved]);

  // Simple download (same-domain canvas; iOS users can long-press after open in new tab)
  const handleDownload = async () => {
    if (!chartRef.current || !selected) return;

    // Open popup immediately on iOS (before any await) to keep user-gesture context
    const isIOS = isIOSDevice();
    let popup: Window | null = null;
    if (isIOS) {
      popup = window.open("", "_blank");
      if (popup) {
        popup.document.write(
          `<!doctype html><title>Preparing...</title>
           <body style="margin:0;background:#0f1115;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font:16px system-ui">
             Preparing image…
           </body>`
        );
      }
    }

    const canvasChart = chartRef.current;

    // Use device-pixel size for a crisp export
    const exportWidth =
      canvasChart.width ||
      Math.round(canvasChart.getBoundingClientRect().width * (window.devicePixelRatio || 1));
    const chartHeight =
      canvasChart.height ||
      Math.round(canvasChart.getBoundingClientRect().height * (window.devicePixelRatio || 1));

    // Layout
    const pad = 24;
    const titleSize = 30;
    const metaSize = 20;
    const logoSize = 64;
    const headerHeight = Math.max(logoSize + pad * 1.5, pad + titleSize + 6 + metaSize + pad);
    const footerHeight = logoSize + pad * 1.5;
    const exportHeight = headerHeight + chartHeight + footerHeight;

    // Export canvas
    const out = document.createElement("canvas");
    out.width = exportWidth;
    out.height = exportHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    // Theme
    const bg = "#0f1115";
    const titleColor = "#ffffff";
    const metaColor = "#34d399";
    const fallback1 = "#60a5fa";
    const fallback2 = "#f87171";

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    // Header text (center)
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${titleSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillText("Win Probability", exportWidth / 2, pad);
    ctx.fillStyle = metaColor;
    ctx.font = `600 ${metaSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillText(`Week ${week}, ${season}`, exportWidth / 2, pad + titleSize + 6);
    ctx.restore();

    // Logos (safe load to avoid taint)
    const [topLogo, bottomLogo] = await Promise.all([
      safeLoadImage(selected.team1.logo),
      safeLoadImage(selected.team2.logo),
    ]);

    const circleAvatar = (
      img: HTMLImageElement | null,
      x: number,
      y: number,
      size: number,
      fallback: string
    ) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (img) ctx.drawImage(img, x, y, size, size);
      else {
        ctx.fillStyle = fallback;
        ctx.fillRect(x, y, size, size);
      }
      ctx.restore();
    };

    // Top-left logo
    circleAvatar(topLogo, pad, pad, logoSize, fallback1);
    // Chart image
    ctx.drawImage(canvasChart, 0, headerHeight, exportWidth, chartHeight);
    // Bottom-left logo
    circleAvatar(bottomLogo, pad, headerHeight + chartHeight + pad / 2, logoSize, fallback2);

    const filename = `${selected.team1.name}_vs_${selected.team2.name}_winprob.png`;

    const toBlobAsync = () =>
      new Promise<Blob | null>((resolve) => {
        if (out.toBlob) out.toBlob((b) => resolve(b), "image/png");
        else {
          const data = out.toDataURL("image/png");
          const byte = atob(data.split(",")[1]);
          const mime = data.split(",")[0].split(":")[1].split(";")[0];
          const ab = new ArrayBuffer(byte.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byte.length; i++) ia[i] = byte.charCodeAt(i);
          resolve(new Blob([ab], { type: mime }));
        }
      });

    // iOS: prefer Web Share; fallback to popup with image (long-press to save)
    if (isIOS) {
      if ("share" in navigator && "canShare" in navigator) {
        const blob = await toBlobAsync();
        if (blob) {
          const file = new File([blob], filename, { type: "image/png" });
          // @ts-ignore
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              // @ts-ignore
              await navigator.share({ files: [file], title: "Win Probability Chart" });
              if (popup) popup.close();
              return;
            } catch {
              /* fall through */
            }
          }
          const url = URL.createObjectURL(blob);
          if (popup) {
            popup.document.open();
            popup.document.write(
              `<!doctype html><title>${filename}</title>
               <body style="margin:0;background:#0f1115;display:flex;align-items:center;justify-content:center;">
                 <img src="${url}" alt="chart" style="max-width:100%;height:auto;display:block" />
                 <div style="position:fixed;bottom:10px;left:0;right:0;text-align:center;color:#fff;font:14px system-ui">
                   Tap and hold the image to Save
                 </div>
               </body>`
            );
            popup.document.close();
          }
          return;
        }
      }
      // Final iOS fallback: dataURL into the already opened popup
      const dataUrl = out.toDataURL("image/png");
      if (popup) {
        popup.document.open();
        popup.document.write(
          `<!doctype html><title>${filename}</title>
           <body style="margin:0;background:#0f1115;display:flex;align-items:center;justify-content:center;">
             <img src="${dataUrl}" alt="chart" style="max-width:100%;height:auto;display:block" />
             <div style="position:fixed;bottom:10px;left:0;right:0;text-align:center;color:#fff;font:14px system-ui">
               Tap and hold the image to Save
             </div>
           </body>`
        );
        popup.document.close();
      }
      return;
    }

    // Desktop/others: direct download
    const href = out.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Win Probability Chart"
      className="bg-[#181818] rounded-lg w-full max-w-[92vw] md:max-w-6xl lg:max-w-7xl mx-auto mt-6 md:mt-10 p-6 md:p-10 outline-none max-h-[95vh] overflow-y-auto relative"
      overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
      ariaHideApp={false}
      shouldCloseOnOverlayClick={true}
    >
      <button
        className="absolute top-2 right-4 text-2xl text-emerald-300"
        onClick={onClose}
        aria-label="Close"
      >
        &times;
      </button>

      {resolved ? (
        <div>
          <h3 className="text-xl font-bold text-center text-emerald-300 mb-2 mt-2">Week {week}, {season}</h3>

          <div className="relative flex flex-col items-center mb-4" style={{ minHeight: "320px" }}>
            <div className="flex flex-col items-center" style={{ marginBottom: 8 }}>
              <img
                src={resolved.team1.logo}
                alt={resolved.team1.name}
                className="w-12 h-12 rounded-full mb-1"
                style={{ objectFit: "cover" }}
              />
              <span className="font-bold text-blue-300">{resolved.team1.name}</span>
            </div>

            <div
              className="w-full max-w-[900px] md:max-w-[1000px] lg:max-w-[1200px] xl:max-w-[1400px] md:h-[560px] lg:h-[640px] xl:h-[720px]"
              style={{ width: "100%", height: "320px", position: "relative", zIndex: 1 }}
            >
              <canvas ref={chartRef} style={{ width: "100%", height: "100%" }} />
            </div>

            <div className="flex flex-col items-center mt-2">
              <img
                src={resolved.team2.logo}
                alt={resolved.team2.name}
                className="w-12 h-12 rounded-full mb-1"
                style={{ objectFit: "cover" }}
              />
              <span className="font-bold text-red-300">{resolved.team2.name}</span>
            </div>

            <button
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow"
              onClick={handleDownload}
            >
              Download Chart
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-300">No matchup selected.</div>
      )}
    </Modal>
  );
};

// WinProbabilityTracker component
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
          const d = docSnap.data() as any;
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

  // Build vertical split lines for day boundaries
  const buildDaySplitAnnotations = (points: WinProbPoint[]) => {
    const regions: { day: string; start: number; end: number }[] = [];
    let currentDay = "";
    let regionStart = 0;
    points.forEach((p, idx) => {
      const day = getDayFromTimeLabel(p.time);
      if (day !== currentDay) {
        if (currentDay) regions.push({ day: currentDay, start: regionStart, end: idx - 1 });
        currentDay = day;
        regionStart = idx;
      }
      if (idx === points.length - 1) {
        regions.push({ day, start: regionStart, end: idx });
      }
    });

    // Draw a thin dull-gray vertical line at the start of each region (except the first)
    const splits = regions.slice(1).map((r) => ({
      type: "line",
      xMin: r.start - 0.5,
      xMax: r.start - 0.5,
      borderColor: SPLIT_LINE_COLOR, // changed from white to dull gray
      borderWidth: 1,
      // drawTime keeps it beneath the line but above background
      drawTime: "beforeDatasetsDraw",
    }));
    return splits;
  };

  // Add this helper to center one label per day region
  function buildCenteredDayLabels(points: WinProbPoint[]) {
    const regions: { day: string; start: number; end: number }[] = [];
    let currentDay = "";
    let regionStart = 0;
    points.forEach((p, idx) => {
      const day = getDayFromTimeLabel(p.time);
      if (day !== currentDay) {
        if (currentDay) regions.push({ day: currentDay, start: regionStart, end: idx - 1 });
        currentDay = day;
        regionStart = idx;
      }
      if (idx === points.length - 1) regions.push({ day, start: regionStart, end: idx });
    });

    const labels = points.map(() => "");
    regions.forEach(r => {
      const center = Math.floor((r.start + r.end) / 2);
      labels[center] = r.day; // e.g., "Thu", "Sun"
    });
    return labels;
  }

  // Draw chart when modal opens / selected changes
  useEffect(() => {
    if (!modalOpen || !selected) return;

    const drawChart = () => {
      if (!chartRef.current) return;

      const labels = buildCenteredDayLabels(selected.points);  // <-- centered day labels
      const series = selected.points.map((p) => (p.team1Pct * 100) - (p.team2Pct * 100));
      const daySplits = buildDaySplitAnnotations(selected.points);

      if (chartInstance.current) {
        chartInstance.current.data.labels = labels;
        chartInstance.current.data.datasets[0].data = series;
        (chartInstance.current.options.plugins as any).annotation = { annotations: daySplits };
        chartInstance.current.update();
        return;
      }

      chartInstance.current = new Chart(chartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Win Probability",
              data: series,
              borderColor: "#f87171",
              backgroundColor: "#f87171",
              fill: false,
              tension: 0.3,
              pointRadius: 0,
              segment: {
                borderColor: (ctx) => (ctx.p0.parsed.y >= 0 ? "#3b82f6" : "#f87171"),
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
              yAlign: "top",
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
                  return point.team1Pct >= point.team2Pct
                    ? { borderColor: "#3b82f6", backgroundColor: "#3b82f6" }
                    : { borderColor: "#f87171", backgroundColor: "#f87171" };
                },
              },
              backgroundColor: "#222",
              titleColor: "#fff",
              bodyColor: "#fff",
              borderColor: "#3b82f6",
              borderWidth: 1,
            },
            // Vertical day split lines (no colored backgrounds)
            annotation: { annotations: daySplits } as any,
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
              grid: {
                // keep only the midline visible
                color: (ctx: { tick: { value: number } }) =>
                  ctx.tick.value === 0 ? "#888" : "transparent",
                lineWidth: (ctx: { tick: { value: number } }) =>
                  ctx.tick.value === 0 ? 2 : 0,
                drawTicks: false,
              },
              // v4: axis border config lives here
              border: {
                display: true,
                color: "rgba(148,163,184,0.7)",
                width: 1,
              },
            },
            x: {
              ticks: {
                display: true,
                autoSkip: false,
                color: "#fff",
                maxRotation: 0,
                minRotation: 0,
              },
              grid: {
                color: "transparent",
                drawTicks: false,
              },
              // v4: axis border config
              border: {
                display: true,
                color: "rgba(148,163,184,0.7)",
                width: 1,
              },
            },
          },
        },
      });
    };

    const timeout = setTimeout(drawChart, 50);
    return () => {
      clearTimeout(timeout);
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [modalOpen, selected]);

  // Live updates while modal is open
  useEffect(() => {
    if (!modalOpen || !selected || !chartInstance.current) return;
    const labels = buildCenteredDayLabels(selected.points);   // <-- keep centered labels in sync
    const series = selected.points.map((p) => (p.team1Pct * 100) - (p.team2Pct * 100));
    const daySplits = buildDaySplitAnnotations(selected.points);
    chartInstance.current.data.labels = labels;
    chartInstance.current.data.datasets[0].data = series;
    (chartInstance.current.options.plugins as any).annotation = { annotations: daySplits };
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

  // Simple chart download handler (PNG) — iOS-safe
  const handleDownload = async () => {
    if (!chartRef.current || !selected) return;

    // Open popup immediately on iOS (before any await) to keep user-gesture context
    const isIOS = isIOSDevice();
    let popup: Window | null = null;
    if (isIOS) {
      popup = window.open("", "_blank");
      if (popup) {
        popup.document.write(
          `<!doctype html><title>Preparing...</title>
           <body style="margin:0;background:#0f1115;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font:16px system-ui">
             Preparing image…
           </body>`
        );
      }
    }

    const canvasChart = chartRef.current;

    // Use device-pixel size for a crisp export
    const exportWidth =
      canvasChart.width ||
      Math.round(canvasChart.getBoundingClientRect().width * (window.devicePixelRatio || 1));
    const chartHeight =
      canvasChart.height ||
      Math.round(canvasChart.getBoundingClientRect().height * (window.devicePixelRatio || 1));

    // Layout
    const pad = 24;
    const titleSize = 30;
    const metaSize = 20;
    const logoSize = 64;
    const headerHeight = Math.max(logoSize + pad * 1.5, pad + titleSize + 6 + metaSize + pad);
    const footerHeight = logoSize + pad * 1.5;
    const exportHeight = headerHeight + chartHeight + footerHeight;

    // Export canvas
    const out = document.createElement("canvas");
    out.width = exportWidth;
    out.height = exportHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    // Theme
    const bg = "#0f1115";
    const titleColor = "#ffffff";
    const metaColor = "#34d399";
    const fallback1 = "#60a5fa";
    const fallback2 = "#f87171";

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    // Header text (center)
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${titleSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillText("Win Probability", exportWidth / 2, pad);
    ctx.fillStyle = metaColor;
    ctx.font = `600 ${metaSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillText(`Week ${week}, ${season}`, exportWidth / 2, pad + titleSize + 6);
    ctx.restore();

    // Logos (safe load to avoid taint)
    const [topLogo, bottomLogo] = await Promise.all([
      safeLoadImage(selected.team1.logo),
      safeLoadImage(selected.team2.logo),
    ]);

    const circleAvatar = (
      img: HTMLImageElement | null,
      x: number,
      y: number,
      size: number,
      fallback: string
    ) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (img) ctx.drawImage(img, x, y, size, size);
      else {
        ctx.fillStyle = fallback;
        ctx.fillRect(x, y, size, size);
      }
      ctx.restore();
    };

    // Top-left logo
    circleAvatar(topLogo, pad, pad, logoSize, fallback1);
    // Chart image
    ctx.drawImage(canvasChart, 0, headerHeight, exportWidth, chartHeight);
    // Bottom-left logo
    circleAvatar(bottomLogo, pad, headerHeight + chartHeight + pad / 2, logoSize, fallback2);

    const filename = `${selected.team1.name}_vs_${selected.team2.name}_winprob.png`;

    const toBlobAsync = () =>
      new Promise<Blob | null>((resolve) => {
        if (out.toBlob) out.toBlob((b) => resolve(b), "image/png");
        else {
          const data = out.toDataURL("image/png");
          const byte = atob(data.split(",")[1]);
          const mime = data.split(",")[0].split(":")[1].split(";")[0];
          const ab = new ArrayBuffer(byte.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byte.length; i++) ia[i] = byte.charCodeAt(i);
          resolve(new Blob([ab], { type: mime }));
        }
      });

    // iOS: prefer Web Share; fallback to popup with image (long-press to save)
    if (isIOS) {
      if ("share" in navigator && "canShare" in navigator) {
        const blob = await toBlobAsync();
        if (blob) {
          const file = new File([blob], filename, { type: "image/png" });
          // @ts-ignore
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              // @ts-ignore
              await navigator.share({ files: [file], title: "Win Probability Chart" });
              if (popup) popup.close();
              return;
            } catch {
              /* fall through */
            }
          }
          const url = URL.createObjectURL(blob);
          if (popup) {
            popup.document.open();
            popup.document.write(
              `<!doctype html><title>${filename}</title>
               <body style="margin:0;background:#0f1115;display:flex;align-items:center;justify-content:center;">
                 <img src="${url}" alt="chart" style="max-width:100%;height:auto;display:block" />
                 <div style="position:fixed;bottom:10px;left:0;right:0;text-align:center;color:#fff;font:14px system-ui">
                   Tap and hold the image to Save
                 </div>
               </body>`
            );
            popup.document.close();
          }
          return;
        }
      }
      // Final iOS fallback: dataURL into the already opened popup
      const dataUrl = out.toDataURL("image/png");
      if (popup) {
        popup.document.open();
        popup.document.write(
          `<!doctype html><title>${filename}</title>
           <body style="margin:0;background:#0f1115;display:flex;align-items:center;justify-content:center;">
             <img src="${dataUrl}" alt="chart" style="max-width:100%;height:auto;display:block" />
             <div style="position:fixed;bottom:10px;left:0;right:0;text-align:center;color:#fff;font:14px system-ui">
               Tap and hold the image to Save
             </div>
           </body>`
        );
        popup.document.close();
      }
      return;
    }

    // Desktop/others: direct download
    const href = out.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

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
        className="bg-[#181818] rounded-lg w-full max-w-[92vw] md:max-w-6xl lg:max-w-7xl mx-auto mt-6 md:mt-10 p-6 md:p-10 outline-none max-h-[95vh] overflow-y-auto relative"
        overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
        ariaHideApp={false}
        shouldCloseOnOverlayClick={true}
      >
        <button
          className="absolute top-2 right-4 text-2xl text-emerald-300"
          onClick={() => setModalOpen(false)}
          aria-label="Close"
        >
          &times;
        </button>

        {selected && (
          <div>
            <h3 className="text-xl font-bold text-center text-white mb-2 mt-2">Win Probability</h3>
            <div className="text-center text-emerald-300 font-semibold mb-6">
              Week {week}, {season}
            </div>

            <div className="relative flex flex-col items-center mb-4" style={{ minHeight: "320px" }}>
              <div className="flex flex-col items-center" style={{ marginBottom: 8 }}>
                <img
                  src={selected.team1.logo}
                  alt={selected.team1.name}
                  className="w-12 h-12 rounded-full mb-1"
                  style={{ objectFit: "cover" }}
                />
                <span className="font-bold text-blue-300">{selected.team1.name}</span>
              </div>

              <div
                // Mobile stays the same height; desktop grows
                className="w-full max-w-[900px] md:max-w-[1000px] lg:max-w-[1200px] xl:max-w-[1400px] md:h-[560px] lg:h-[640px] xl:h-[720px]"
                style={{
                  width: "100%",
                  height: "320px", // mobile height
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <canvas
                  ref={chartRef}
                  // Rely on CSS for responsive sizing (remove width/height attrs)
                  style={{ width: "100%", height: "100%" }}
                />
              </div>

              <div className="flex flex-col items-center mt-2">
                <img
                  src={selected.team2.logo}
                  alt={selected.team2.name}
                  className="w-12 h-12 rounded-full mb-1"
                  style={{ objectFit: "cover" }}
                />
                <span className="font-bold text-red-300">{selected.team2.name}</span>
              </div>

              <button
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow"
                onClick={handleDownload}
              >
                Download Chart
              </button>
            </div>

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