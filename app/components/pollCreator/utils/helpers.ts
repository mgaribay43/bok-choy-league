// ===== Helpers & Utilities =====
export const getTotalVotes = (poll: any) =>
  Array.isArray(poll.voters) ? poll.voters.length : 0;

export const getVotePercentage = (votes: number, totalVotes: number) =>
  totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);

// Function to calculate and sort options by points (same logic as original)
export function getSortedOptionsByPoints(poll: any) {
  const optionPoints: { [optionId: number]: number } = {};
  poll.options.forEach((option: any) => {
    optionPoints[option.id] = 0;
  });

  if (poll.rankedVoting && poll.maxSelections > 1 && poll.responses) {
    Object.values(poll.responses).forEach((response: any) => {
      if (Array.isArray(response.rankings)) {
        response.rankings.forEach((optionId: number, idx: number) => {
          if (Object.prototype.hasOwnProperty.call(optionPoints, optionId)) {
            const scoreToAdd = Math.max(poll.maxSelections - idx, 1);
            optionPoints[optionId] += scoreToAdd;
          }
        });
      }
    });
  } else if (poll.maxSelections > 1 && poll.responses) {
    Object.values(poll.responses).forEach((response: any) => {
      if (Array.isArray(response.selectedOptions)) {
        response.selectedOptions.forEach((optionId: number) => {
          if (Object.prototype.hasOwnProperty.call(optionPoints, optionId)) {
            optionPoints[optionId] += 1;
          }
        });
      }
    });
  } else if (poll.responses) {
    Object.values(poll.responses).forEach((response: any) => {
      if (typeof (response as any).optionText === 'string') {
        const option = poll.options.find((opt: any) => opt.text === (response as any).optionText);
        if (option) {
          optionPoints[option.id] += 1;
        }
      }
    });
  }

  return [...poll.options].map((option: any) => ({
    ...option,
    calculatedPoints: optionPoints[option.id] || 0,
  })).sort((a: any, b: any) => b.calculatedPoints - a.calculatedPoints);
}

// ===== Body scroll lock hook =====
import { useEffect } from "react";

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;
    const scrollY = window.scrollY;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      const topVal = document.body.style.top;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      const y = Math.abs(parseInt(topVal || "0", 10)) || scrollY;
      window.scrollTo(0, y);
    };
  }, [isLocked]);
}