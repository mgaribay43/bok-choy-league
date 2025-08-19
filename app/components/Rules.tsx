'use client';

import React, { useState } from 'react';
import './Rules.module.css';

const rulesData = `League Commissioner: Mike Garibay
Format
* 10 Team
* ½ PPR
League Dues
* $50/person - $500 total
* All dues paid to Mike Garibay directly before the draft
* Mike Garibay will pay out prizes for 1st, 2nd, and 3rd place at the end of year banquet ceremony.
Prize Pool
* Teams that finish in the top 3 will receive cash prizes
   * 1st place        $350        or 70% of the prize pool
   * 2nd Place        $100        or 20% of the prize pool
   * 3rd Place        $50        or 10% of the prize pool
* Trophy
   * 1st place team will claim ownership of the league trophy until the conclusion of the next season
   * A new plaque will be ordered from the 1st place team’s winnings and adorned to the trophy during the trophy ceremony at the annual league banquet
Roster
* 1 QB | 2 RB | 2 WR | 1 TE | 1 Kick | 1 DEF | 1 W/R Flex |          6 Bench | 1 IR
Trades
* Deadline - TBD
* All trades are subject to commissioner review
   * Trades will be vetoed with a majority league vote
* If a trade is not vetoed by other league members within 6 hours of acceptance, it may be manually pushed through by the commissioner as opposed to waiting for the trade to process automatically. This is to ensure the players involved in the trade can be used immediately
Keepers
* 1 Keeper per team
* A keeper is defined as any player taken in the previous year’s draft that is on a roster at year’s end.
* If a player is dropped they are still eligible to be kept so long as they are on a roster by year’s end
* You are not required to choose a keeper
* Cannot keep a player drafted in the 1st round
* In the next year a keeper is locked in one round earlier than drafted.
   * e.g: I draft A.J Brown in the 3 round this year. In year 2 if I chose to keep Brown then I must draft him in the 2nd round. Year 3 I can take A.J brown in the 1st.
   * e.g I draft Kamara in the 2nd round this year. Year 2 I draft him in the 1st round, but I cannot draft him again in year 3 since I took him in 1st round in year 2.
* A player can only be kept for 2 years after initial draft (3 years total) regardless of what team possesses the player
* Trading a player has no effect on where a keeper is taken in the draft
   * e.g: A player drafted in the 4th round by team A is traded to Team B. Team B can keep this player the next year in the 3rd round
   * Keeper selection is due 1 week prior to draft
Playoffs
* Week 15, 16 and 17
* Highest seeds play lowest seeds
* 6 teams make playoffs; Top 2 teams receive 1st round byes
* Tie-breaker: Best regular season record vs opponent’s wins
Waivers
* Continual rolling list
Draft
* Snake draft
* OLD - Draft Order Determination Method:
   * Teams that finish 7th-10th will be randomized to determine picks 1-4
   * Teams that finish 1st-6th will be randomizes to determine picks 5-10
* New Method with Keepers: Starting 2024-2025 season; draft order will be inverse of final standings
   * 10th place will have 1st overall pick and 1st place will have 10th overall pick
Smirnoff Ice Rule
* If a player(s) scores zero(0) points or less in a starting position on any team, the owner of that team must chug a 12 oz smirnoff Ice. (fig. 1) within 24 hours of the score being finalized. One Ice per player that scores zero(0) points or less.
   * If you do not complete the chug within 24 hours you must chug the 24 oz version
   * Other flavors are permissible so long as they fall under the Smirnoff Ice branding
* In the event that a manager leaves a spot on their roster empty, they shall be required to consume an 11.2oz Smirnoff Ice™ within 24 hours of the end of the final game of the week.

fig. 1

Special Situations
* Game Cancellations
   * From the precedent set in the 2022-2023 season if a game is suspended and canceled, canceled outright, or otherwise not played, the results will stand and no measures will be taken to amend results. e.g: If Damar Hamlin fucking dies on the field and the game does not continue, final scores will stand and no changes will be made nor any special measures taken. Regardless of whether or not the game is made up. This does not apply if the game is made up before the start of the next week.
   * COVID rule: If a game is suspended and resumed in the same week, those scores will count

Scoring
Offense
	Values
	Passing Yards
	25 yards per point
	Passing Touchdowns
	4
	Interceptions
	-1
	Rushing Yards
	10 yards per point
	Rushing Touchdowns
	6
	Receptions
	.5
	Receiving Yards
	10 yards per point
	Receiving Touchdowns
	6
	Return Touchdowns
	6
	2-Point Conversions
	2
	Fumbles Lost
	-2
	Offensive Fumble Return TD
	6
	Kickers
	League Value
	Field Goals 0-19 Yards
	3
	Field Goals 20-29 Yards
	3
	Field Goals 30-39 Yards
	3
	Field Goals 40-49 Yards
	4
	Field Goals 50+ Yards
	5
	Point After Attempt Made
	1
	Defense/Special Teams
	League Value
	Sack
	1
	Interception
	2
	Fumble Recovery
	2
	Touchdown
	6
	Safety
	2
	Block Kick
	2
	Kickoff and Punt Return Touchdowns
	6
	Points Allowed 0 points
	10
	Points Allowed 1-6 points
	7
	Points Allowed 7-13 points
	4
	Points Allowed 14-20 points
	1
	Points Allowed 21-27 points
	0
	Points Allowed 28-34 points
	-1
	Points Allowed 35+ points
	-4
	Extra Point Returned
	2

**All rules are subject to change**`;

const headers = [
  'Format',
  'League Dues',
  'Prize Pool',
  'Roster',
  'Trades',
  'Keepers',
  'Playoffs',
  'Waivers',
  'Draft',
  'Smirnoff Ice Rule',
  'Special Situations',
  'Scoring',
];

interface Section {
  id: number;
  title: string;
  content: string;
}

const Rules = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const toggleSection = (section: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const sections: Section[] = headers.map((header, index) => {
    const startIndex = rulesData.indexOf(header);
    const endIndex = index < headers.length - 1 ? rulesData.indexOf(headers[index + 1]) : rulesData.length;
    const content = rulesData.slice(startIndex + header.length, endIndex).trim();

    return {
      id: index,
      title: header,
      content,
    };
  });

  const filteredSections = sections.filter((section) =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">The Bok Choy League™ Official League Rules</h1>
        <input
          type="text"
          placeholder="Search rules..."
          value={searchTerm}
          onChange={handleSearch}
          className="border border-gray-300 rounded-lg p-3 mb-6 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div>
          {filteredSections.map((section) => (
            <div key={section.id} className="mb-6">
              <button
                onClick={() => toggleSection(section.id)}
                className="text-xl font-semibold text-blue-600 hover:underline focus:outline-none"
              >
                {section.title}
              </button>
              {expandedSections[section.id] && (
                <div className="mt-4 whitespace-pre-wrap border border-gray-300 rounded-lg p-4 bg-gray-50">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Rules;