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

function getDayFromTimeLabel(time: string) {
  const abbr = time.split(" ")[0];
  return abbr || "";
}

const SPLIT_LINE_COLOR = "rgba(148, 163, 184, 0.45)";

// Helper: returns a single array of {x, y, color} where y is above 50 if team1 is ahead, below 50 if team2 is ahead,
// and color changes exactly at the 50% crossing (by interpolating a point at the crossing).
function getDominantWinProbLineWithExactColorChange(
  points: WinProbPoint[],
  team1: { name: string },
  team2: { name: string }
) {
  if (!points || points.length === 0) return [];
  const result: {
    x: number;
    y: number;
    color: string;
    team: string;
    pct: number;
    label: string;
  }[] = [];

  let prev = points[0];
  let prevTeam1Higher = prev.team1Pct >= prev.team2Pct;
  let prevY =
    prevTeam1Higher
      ? 50 + (prev.team1Pct - 0.5) * 100
      : 50 - (prev.team2Pct - 0.5) * 100;
  let prevColor = prevTeam1Higher ? "#3b82f6" : "#f87171";
  let prevTeam = prevTeam1Higher ? team1.name : team2.name;
  let prevPct = prevTeam1Higher ? prev.team1Pct : prev.team2Pct;
  let prevLabel = getDayFromTimeLabel(prev.time);

  result.push({
    x: 0,
    y: prevY,
    color: prevColor,
    team: prevTeam,
    pct: prevPct,
    label: prevLabel,
  });

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const currTeam1Higher = curr.team1Pct >= curr.team2Pct;
    let currY =
      currTeam1Higher
        ? 50 + (curr.team1Pct - 0.5) * 100
        : 50 - (curr.team2Pct - 0.5) * 100;
    let currColor = currTeam1Higher ? "#3b82f6" : "#f87171";
    let currTeam = currTeam1Higher ? team1.name : team2.name;
    let currPct = currTeam1Higher ? curr.team1Pct : curr.team2Pct;
    let currLabel = getDayFromTimeLabel(curr.time);

    // If the dominant team switches, interpolate a point at the 50% crossing
    if (currTeam1Higher !== prevTeam1Higher) {
      // Find t where the two lines cross (team1Pct == team2Pct)
      // That is, find t in [0,1] such that:
      // prev.team1Pct + t*(curr.team1Pct - prev.team1Pct) = prev.team2Pct + t*(curr.team2Pct - prev.team2Pct)
      // => t = (prev.team2Pct - prev.team1Pct) / ((curr.team1Pct - prev.team1Pct) - (curr.team2Pct - prev.team2Pct))
      const denom =
        (curr.team1Pct - prev.team1Pct) - (curr.team2Pct - prev.team2Pct);
      let t = 0.5;
      if (denom !== 0) {
        t = (prev.team2Pct - prev.team1Pct) / denom;
      }
      t = Math.max(0, Math.min(1, t));
      // Interpolate x, pct, etc.
      const crossX = (i - 1) + t;
      const crossTeam1Pct = prev.team1Pct + t * (curr.team1Pct - prev.team1Pct);
      const crossTeam2Pct = prev.team2Pct + t * (curr.team2Pct - prev.team2Pct);
      // At crossing, both are equal
      const crossY = 50;
      // The color before crossing is prevColor, after is currColor
      // Add the crossing point with prevColor (end of previous segment)
      result.push({
        x: crossX,
        y: crossY,
        color: prevColor,
        team: prevTeam,
        pct: crossTeam1Pct, // or crossTeam2Pct, they're equal
        label: prevLabel,
      });
      // Add the crossing point again with currColor (start of new segment)
      result.push({
        x: crossX,
        y: crossY,
        color: currColor,
        team: currTeam,
        pct: crossTeam1Pct,
        label: currLabel,
      });
    }
    result.push({
      x: i,
      y: currY,
      color: currColor,
      team: currTeam,
      pct: currPct,
      label: currLabel,
    });
    prev = curr;
    prevTeam1Higher = currTeam1Higher;
    prevY = currY;
    prevColor = currColor;
    prevTeam = currTeam;
    prevPct = currPct;
    prevLabel = currLabel;
  }
  return result;
}

function buildDaySplitAnnotations(points: WinProbPoint[]) {
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
}

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
  regions.forEach((r) => {
    const center = Math.floor((r.start + r.end) / 2);
    labels[center] = r.day;
  });
  return labels;
}

// iOS detection helper
function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || (navigator as any).vendor || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return iOS || iPadOS;
}

// iOS popup receiver for image download
function openIOSReceiverPopup(filename: string) {
  const popup = window.open("about:blank", "_blank");
  if (!popup) return null;
  const html =
    `<!doctype html><title>Preparing…</title>
     <meta name="viewport" content="width=device-width, initial-scale=1" />
     <body style="margin:0;background:#0f1115;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;font:16px system-ui">
       <div id="wrap" style="max-width:100%;text-align:center">
         <div id="status" style="margin-bottom:12px;color:#9ca3af">Preparing image…</div>
         <img id="img" alt="chart" style="max-width:100%;height:auto;display:none;border-radius:8px" />
         <div id="hint" style="display:none;margin-top:10px;color:#9ca3af">Tap and hold the image to Save</div>
       </div>
       <script>
         window.addEventListener('message', function(e) {
           try {
             var d = e.data || {};
             if (d.type === 'img' && d.url) {
               var img = document.getElementById('img');
               img.src = d.url;
               img.style.display = 'block';
               document.getElementById('status').textContent = '';
               document.getElementById('hint').style.display = 'block';
               if (d.filename) document.title = d.filename;
             }
           } catch (err) {}
         }, false);
       </script>
     </body>`;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return popup;
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
          setResolved(selected);
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

  useEffect(() => {
    if (!isOpen || !resolved || !resolved.points?.length || !chartRef.current) return;

    const labels = buildCenteredDayLabels(resolved.points);
    const line = getDominantWinProbLineWithExactColorChange(resolved.points, resolved.team1, resolved.team2);
    const daySplits = buildDaySplitAnnotations(resolved.points);

    // Chart.js expects data sorted by x
    const sortedLine = [...line].sort((a, b) => a.x - b.x);

    const dataset = {
      label: "Dominant Team Win Probability (Above/Below 50%)",
      data: sortedLine.map((d) => ({ x: d.x, y: d.y })),
      borderColor: (ctx: any) => {
        const idx = ctx.p0DataIndex ?? ctx.p0?.parsed?.x ?? 0;
        return sortedLine[idx]?.color || "#fff";
      },
      backgroundColor: "transparent",
      fill: false,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 3,
      segment: {
        borderColor: (ctx: any) => {
          const idx = ctx.p0DataIndex ?? ctx.p0?.parsed?.x ?? 0;
          return sortedLine[idx]?.color || "#fff";
        },
      },
      order: 1,
      showLine: true,
    };

    if (chartInstance.current) {
      chartInstance.current.data.labels = labels;
      chartInstance.current.data.datasets = [dataset];
      (chartInstance.current.options.plugins as any).annotation = { annotations: daySplits };
      chartInstance.current.update();
      return;
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [dataset],
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
                const d = sortedLine[idx];
                if (!d) return "";
                return `${d.team}: ${(d.pct * 100).toFixed(1)}%`;
              },
              labelColor: (context) => {
                const idx = context.dataIndex;
                const d = sortedLine[idx];
                return {
                  borderColor: d?.color || "#fff",
                  backgroundColor: d?.color || "#fff",
                };
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
            min: 0,
            max: 100,
            ticks: {
              color: "#fff",
              callback: function (tickValue: string | number) {
                if (tickValue === 100) return "100%";
                if (tickValue === 75) return "75%";
                if (tickValue === 50) return "50%";
                if (tickValue === 25) return "25%";
                if (tickValue === 0) return "0%";
                return "";
              },
            },
            grid: {
              color: (ctx: { tick: { value: number } }) =>
                ctx.tick.value === 50 ? "#888" : "transparent",
              lineWidth: (ctx: { tick: { value: number } }) =>
                ctx.tick.value === 50 ? 2 : 0,
              drawTicks: false,
            },
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

  // Store scroll position for scroll lock workaround
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      // Save scroll position
      scrollYRef.current = window.scrollY;

      // Lock scroll for all devices using only overflow: hidden (no position: fixed)
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      // Restore styles
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";

      // Restore scroll position
      window.scrollTo(0, scrollYRef.current);
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      // Restore scroll position if modal was open
      if (isOpen) window.scrollTo(0, scrollYRef.current);
    };
  }, [isOpen]);

  // Download handler with iOS support
  const handleDownload = async () => {
    if (!chartRef.current || !resolved) return;

    const filename = `${resolved.team1.name}_vs_${resolved.team2.name}_winprob.png`;
    const isIOS = isIOSDevice();
    let popup: Window | null = null;
    if (isIOS) {
      popup = openIOSReceiverPopup(filename);
    }

    const canvasChart = chartRef.current;
    const exportWidth =
      canvasChart.width ||
      Math.round(canvasChart.getBoundingClientRect().width * (window.devicePixelRatio || 1));
    const chartHeight =
      canvasChart.height ||
      Math.round(canvasChart.getBoundingClientRect().height * (window.devicePixelRatio || 1));

    const pad = 24;
    const titleSize = 30;
    const metaSize = 20;
    const logoSize = 112; // Increased from 64 to 112
    const headerHeight = Math.max(logoSize + pad * 1.5, pad + titleSize + 6 + metaSize + pad);
    const footerHeight = logoSize + pad * 1.5;
    const exportHeight = headerHeight + chartHeight + footerHeight;

    const out = document.createElement("canvas");
    out.width = exportWidth;
    out.height = exportHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    const bg = "#0f1115";
    const titleColor = "#ffffff";
    const metaColor = "#34d399";
    const fallback1 = "#60a5fa";
    const fallback2 = "#f87171";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    // Remove the "Win Probability" header in the download image
    // Make the Week and year text larger and bold
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = metaColor;
    ctx.font = `bold 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`; // Larger and bold
    ctx.fillText(`Week ${week}, ${season}`, exportWidth / 2, pad);
    ctx.restore();

    // Logos (safe load to avoid taint)
    const [topLogo, bottomLogo] = await Promise.all([
      safeLoadImage(resolved.team1.logo),
      safeLoadImage(resolved.team2.logo),
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

    // Export logic
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
      className="bg-[#181818] rounded-lg w-full max-w-[92vw] md:max-w-6xl lg:max-w-7xl mx-auto mt-6 md:mt-10 p-6 md:p-10 outline-none max-h-[95vh] overflow-y-auto overscroll-contain relative"
      overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 overscroll-none"
      ariaHideApp={false}
      shouldCloseOnOverlayClick={true}
    >
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        {/* Download button first */}
        {resolved?.points?.length ? (
          <button
            onClick={handleDownload}
            aria-label="Download chart"
            title="Download chart as image"
            className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-black/40 text-emerald-300 hover:bg-black/60 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
        {/* Close button second */}
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-black/40 text-emerald-300 hover:bg-black/60 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12" />
            <path d="M18 6l-12 12" />
          </svg>
        </button>
      </div>
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
              // Prevent modal and background scroll while dragging on chart (mobile/desktop)
              onPointerDown={e => {
                // Prevent scroll on pointer down (touch or mouse)
                document.body.style.overflow = "hidden";
                document.documentElement.style.overscrollBehavior = "none";
              }}
              onPointerUp={() => {
                document.body.style.overflow = "";
                document.documentElement.style.overscrollBehavior = "";
              }}
              onPointerCancel={() => {
                document.body.style.overflow = "";
                document.documentElement.style.overscrollBehavior = "";
              }}
              onPointerLeave={() => {
                document.body.style.overflow = "";
                document.documentElement.style.overscrollBehavior = "";
              }}
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
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-300">No matchup selected.</div>
      )}
    </Modal>
  );
};

const WinProbabilityTracker: React.FC = () => {
  const [season, setSeason] = useState<string>("");
  const [week, setWeek] = useState<number>(1);
  const [matchups, setMatchups] = useState<MatchupWinProb[]>([]);
  const [selected, setSelected] = useState<MatchupWinProb | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function fetchMeta() {
      const s = await getCurrentSeason();
      setSeason(s);
      const w = await getCurrentWeek(s);
      setWeek(w);
    }
    fetchMeta();
  }, []);

  useEffect(() => {
    if (!season || !week) return;
    const db = getFirestore();
    const colRef = collection(db, "WinProbabilities");

    const pollFirestore = () => {
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
      <WinProbChartModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selected={selected}
        season={season}
        week={week}
      />
    </div>
  );
};

export default WinProbabilityTracker;

function safeLoadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.src = src;
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}