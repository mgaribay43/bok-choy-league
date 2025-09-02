'use client';

import React, { useRef } from "react";
import ReactDOM from "react-dom";
import { Listbox } from "@headlessui/react";
import { IceVideo } from "../hooks/hooks";
import { getUnique, getYear, splitPlayers, handleFullReset } from "../utils/helpers";

export default function FiltersSection({
  filters,
  selectedManager,
  setSelectedManager,
  selectedSeason,
  setSelectedSeason,
  selectedPlayer,
  setSelectedPlayer,
  selectedWeek,
  setSelectedWeek,
  selectedFlavor,
  setSelectedFlavor,
  showPenaltyOnly,
  setShowPenaltyOnly,
  handleResetFilters,
  filtersExpanded,
  videos,
}: {
  filters: any;
  selectedManager: string;
  setSelectedManager: (v: string) => void;
  selectedSeason: string;
  setSelectedSeason: (v: string) => void;
  selectedPlayer: string;
  setSelectedPlayer: (v: string) => void;
  selectedWeek: string;
  setSelectedWeek: (v: string) => void;
  selectedFlavor: string;
  setSelectedFlavor: (v: string) => void;
  showPenaltyOnly: boolean;
  setShowPenaltyOnly: (v: boolean) => void;
  handleResetFilters: () => void;
  filtersExpanded: boolean;
  videos: IceVideo[];
}) {
  // --- Mobile Reset Button ---
  const ResetBtn = ({ onClick }: { onClick: () => void }) => (
    <button
      type="button"
      className="sm:hidden ml-2 mt-0 px-3 py-1 rounded-lg text-xs bg-[#333] text-emerald-200 hover:bg-[#444] border border-[#333] flex items-center"
      onClick={onClick}
      aria-label="Reset"
      title="Reset"
      style={{ minHeight: '35px' }}
    >
      ⟲
    </button>
  );

  // --- Dynamic Week Options ---
  let weekOptions: string[] = [];
  if (selectedSeason !== "All") {
    let filtered = videos.filter(v => (v.season ?? getYear(v.date)) === selectedSeason);
    if (selectedManager !== "All") {
      filtered = filtered.filter(v => v.manager?.trim() === selectedManager);
    }
    if (selectedPlayer !== "All") {
      filtered = filtered.filter(v => splitPlayers(v.player).includes(selectedPlayer));
    }
    weekOptions = getUnique(filtered.map(v => v.week?.trim()).filter((w): w is string => !!w)).sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
      const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
      return numA - numB;
    });
  }

  // --- Dynamic Player Options ---
  let playerOptions: string[] = [];
  let filteredForPlayers = videos;
  if (selectedSeason !== "All") {
    filteredForPlayers = filteredForPlayers.filter(v => (v.season ?? getYear(v.date)) === selectedSeason);
  }
  if (selectedManager !== "All") {
    filteredForPlayers = filteredForPlayers.filter(v => v.manager?.trim() === selectedManager);
  }
  if (selectedWeek !== "All") {
    filteredForPlayers = filteredForPlayers.filter(v => v.week?.trim() === selectedWeek);
  }
  playerOptions = getUnique(filteredForPlayers.flatMap(v => splitPlayers(v.player))).sort();

  // --- Dynamic Manager Options ---
  let managerOptions: string[] = [];
  if (selectedPlayer !== "All") {
    managerOptions = getUnique(
      videos
        .filter(v => splitPlayers(v.player).includes(selectedPlayer))
        .map(v => v.manager?.trim())
        .filter(Boolean)
    ).sort();
  } else {
    managerOptions = filters.managers;
  }

  // --- Dynamic Flavor Options ---
  const flavorOptions = getUnique(videos.map(v => v.flavor).filter(Boolean)).sort();

  // --- Listbox Option Render Helper ---
  const renderOptions = (options: string[]) =>
    options.map(option => (
      <Listbox.Option
        key={option}
        value={option}
        className={({ active }) =>
          `cursor-pointer select-none px-3 py-2 ${active ? "bg-emerald-100 text-emerald-700" : "text-emerald-200"}`
        }
      >
        {option}
      </Listbox.Option>
    ));

  // --- Dropdown Wrapper ---
  const Dropdown = ({
    label,
    value,
    onChange,
    options,
    disabled = false,
    grayOut = false,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
    disabled?: boolean;
    grayOut?: boolean;
  }) => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
      <div className="flex flex-col sm:mr-6 items-start mb-2 ml-2 sm:mb-0 sm:w-48">
        {/* --- Dropdown label --- */}
        <label
          className={`block text-xs font-semibold mb-1 sm:mb-0 ${grayOut ? "text-emerald-300" : "text-emerald-200"}`}
        >
          {label}
        </label>
        <div className="flex flex-row items-center w-full">
          <div className="flex-1 relative">
            <Listbox value={value} onChange={onChange} disabled={disabled} as="div">
              {({ open }) => (
                <>
                  <Listbox.Button
                    ref={buttonRef}
                    className={`w-full px-3 py-2 rounded-lg border border-[#333] bg-[#0f0f0f] text-emerald-400 text-left ${grayOut ? "bg-gray-800 text-emerald-300 cursor-not-allowed" : ""
                      }`}
                    style={{ minHeight: '40px' }}
                  >
                    {value}
                  </Listbox.Button>
                  {open &&
                    ReactDOM.createPortal(
                      <Listbox.Options
                        className="absolute w-48 bg-[#0f0f0f] border border-[#333] rounded-lg shadow-lg z-[99999] max-h-60 overflow-y-auto"
                        style={{
                          left: buttonRef.current
                            ? buttonRef.current.getBoundingClientRect().left
                            : undefined,
                          top: buttonRef.current
                            ? buttonRef.current.getBoundingClientRect().bottom + window.scrollY
                            : undefined,
                          position: "absolute",
                        }}
                      >
                        {renderOptions(options)}
                      </Listbox.Options>,
                      document.body
                    )
                  }
                </>
              )}
            </Listbox>
          </div>
          <ResetBtn onClick={() => onChange("All")} />
        </div>
      </div>
    );
  };

  // --- Render Filter Dropdowns ---
  return (
    <div className={`overflow-hidden transition-all duration-500 ease-in-out w-full justify-center mb-2 gap-3
      ${filtersExpanded ? "max-h[600px] opacity-100" : "max-h-0 opacity-0"}
      sm:max-h-none sm:opacity-100 sm:flex sm:flex-row flex-col`}
      style={{ transitionProperty: "max-height, opacity" }}
    >
      <Dropdown
        label="Manager"
        value={selectedManager}
        onChange={setSelectedManager}
        options={["All", ...managerOptions]}
      />
      <Dropdown
        label="Season"
        value={selectedSeason}
        onChange={setSelectedSeason}
        options={["All", ...filters.seasons]}
      />
      <Dropdown
        label="Week"
        value={selectedWeek}
        onChange={setSelectedWeek}
        options={["All", ...(selectedSeason !== "All" ? weekOptions : [])]}
        disabled={selectedSeason === "All"}
        grayOut={selectedSeason === "All"}
      />
      <Dropdown
        label="Player"
        value={selectedPlayer}
        onChange={setSelectedPlayer}
        options={["All", ...playerOptions]}
      />
      <Dropdown
        label="Flavor"
        value={selectedFlavor}
        onChange={setSelectedFlavor}
        options={["All", ...flavorOptions.filter((f): f is string => typeof f === "string")]}
      />
      {/* Penalty filter */}
      <div className="w-full sm:w-auto flex justify-center sm:items-end mt-2 sm:mt-0 mb-3">
        <div className="flex flex-row sm:flex-row items-center justify-center">
          <input type="checkbox" id="penalty-filter" checked={showPenaltyOnly} onChange={e => setShowPenaltyOnly(e.target.checked)} className="accent-red-600" />
          <label htmlFor="penalty-filter" className="text-xs font-semibold text-red-700 ml-1">Penalty Ices</label>
        </div>
      </div>
      {/* Reset filters button */}
      <div className="sm:w-auto flex justify-center sm:items-end mt-2 mb-1.5 sm:mt-0">
        <div className="sm:flex-row items-center justify-center">
          <button
            className="bg-[#333] text-emerald-200 px-3 py-2.5 rounded text-xs hover:bg-[#444] whitespace-nowrap border border-[#333]"
            onClick={() => handleFullReset(
              setSelectedManager,
              setSelectedSeason,
              setSelectedPlayer,
              setSelectedWeek,
              setSelectedFlavor,
              setShowPenaltyOnly
            )}
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}