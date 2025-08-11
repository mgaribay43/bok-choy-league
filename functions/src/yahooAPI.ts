import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getTokensForUser } from "./utils/tokenStorage";

/* 
This is an all-purpose function that can be used to call the Yahoo FantasyAPI to get data such as:
- Team
- Scoreboard
- Standings
- Draft Results
- Players
- Stats
*/

const leagueKeysByYear: Record<string, string> = {
    "2017": "371.l.912608",
    "2018": "380.l.727261",
    "2019": "390.l.701331",
    "2020": "399.l.635829",
    "2021": "406.l.11184",
    "2022": "414.l.548584",
    "2023": "423.l.397633",
    "2024": "449.l.111890",
    "2025": "461.l.128797",
};

if (!admin.apps.length) {
    admin.initializeApp();
}

export const yahooAPI = functions.https.onRequest(
    {
        region: "us-central1",
        cors: true,
        timeoutSeconds: 60,
        memory: "256MiB",
    },
    async (req, res) => {
        const type = req.query.type as string;
        const year = (req.query.year as string) || "2025"; // default to 2025
        const weekParam = req.query.week as string | undefined;
        const week = weekParam && weekParam.trim() !== "" ? `;week=${weekParam}` : "";
        const playerKeys = (req.query.playerKeys as string) || ""; // optional playerKeys param


        if (!type) {
            res.status(400).json({ error: "Missing 'type' parameter" });
            return;
        }

        if (!leagueKeysByYear[year]) {
            res.status(400).json({ error: "Invalid or unsupported 'year' parameter" });
            return;
        }

        try {
            const tokens = await getTokensForUser();

            if (!tokens || !tokens.access_token) {
                res.status(401).json({ error: "Access token not found" });
                return;
            }

            const accessToken = tokens.access_token;
            const leagueKey = leagueKeysByYear[year];
            let endpoint = "";

            switch (type) {
                // API URL Builders
                case "teams":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
                    break;
                case "standings":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;
                    break;
                case "scoreboard":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard${week}?format=json`;
                    break;
                case "draftresults":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/draftresults?format=json`;
                    break;
                // type can be season, or date;date=2011-07-06
                // case "stats":
                //     endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/stats;type=season?format=json`;
                //     break;
                case "players":
                    if (playerKeys.trim() === "") {
                        // If no playerKeys provided, get all players in league (single call)
                        endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/players?format=json`;
                        const yahooResponse = await fetch(endpoint, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                Accept: "application/json",
                            },
                        });
                        const text = await yahooResponse.text();
                        const json = JSON.parse(text.replace(/^callback\((.*)\)$/, "$1"));
                        res.status(200).json(json);
                        return;
                    } else {
                        // Batch playerKeys in groups of 25 (yahoo Limits each call to max of 25 player objs)
                        const keysArray = playerKeys.split(",");
                        const batchSize = 25;
                        const batchedResponses = [];

                        for (let i = 0; i < keysArray.length; i += batchSize) {
                            const batchKeys = keysArray.slice(i, i + batchSize).join(",");
                            const batchEndpoint = `https://fantasysports.yahooapis.com/fantasy/v2/players;player_keys=${batchKeys}?format=json`;

                            console.log(`Fetching batch: ${batchKeys}`);
                            const batchResponse = await fetch(batchEndpoint, {
                                headers: {
                                    Authorization: `Bearer ${accessToken}`,
                                    Accept: "application/json",
                                },
                            });

                            const batchText = await batchResponse.text();
                            const batchJson = JSON.parse(batchText.replace(/^callback\((.*)\)$/, "$1"));

                            batchedResponses.push(batchJson);
                        }

                        // Combine batchedResponses into one response structure
                        // Yahoo's response structure nests players inside fantasy_content.league[1].players
                        // We'll merge all players objects

                        const combinedPlayers: Record<string, any> = {};
                        for (const response of batchedResponses) {
                            const playersObj = response.fantasy_content?.players || {};
                            Object.entries(playersObj).forEach(([key, value]) => {
                                if (key !== "count") {
                                    combinedPlayers[key] = value;
                                }
                            });
                        }

                        // Compose a combined JSON response similar to the original Yahoo format
                        const combinedResponse = {
                            fantasy_content: {
                                ...batchedResponses[0]?.fantasy_content,
                                league: [
                                    batchedResponses[0]?.fantasy_content?.league?.[0], // league info
                                    {
                                        players: combinedPlayers,
                                    },
                                ],
                            },
                        };
                        res.status(200).json(combinedResponse);
                        return;
                    }

                case "roster": {
                    const teamId = (req.query.teamId as string) || "1";
                    const validTeam = /^[1-9]$|^10$/.test(teamId);
                    if (!validTeam) {
                        res.status(400).json({ error: "Invalid teamId (must be 1–10)" });
                        return;
                    }
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/team/${leagueKey}.t.${teamId}/roster${week}?format=json`;
                    break;
                }
                case "playerstats": {
                    if (playerKeys.trim() === "") {
                        res.status(400).json({ error: "Missing playerKeys parameter for playerstats" });
                        return;
                    }

                    // batch player keys in groups of 25 max
                    const keysArray = playerKeys.split(",");
                    const batchSize = 25;
                    const batchedResponses = [];

                    for (let i = 0; i < keysArray.length; i += batchSize) {
                        const batchKeys = keysArray.slice(i, i + batchSize).join(",");
                        console.log("League Key = " + leagueKey + " year =" + year);
                        const batchEndpoint = `https://fantasysports.yahooapis.com/fantasy/v2/players;player_keys=${batchKeys}/stats;type=week${week}?format=json`;

                        console.log(`Fetching player stats batch: ${batchKeys}`);
                        const batchResponse = await fetch(batchEndpoint, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                Accept: "application/json",
                            },
                        });

                        const batchText = await batchResponse.text();
                        const batchJson = JSON.parse(batchText.replace(/^callback\((.*)\)$/, "$1"));
                        batchedResponses.push(batchJson);
                    }

                    // Merge batched player stats just like you do for players
                    const combinedPlayers: Record<string, any> = {};
                    for (const response of batchedResponses) {
                        const playersObj = response.fantasy_content?.players || {};
                        Object.entries(playersObj).forEach(([key, value]) => {
                            if (key !== "count") {
                                combinedPlayers[key] = value;
                            }
                        });
                    }

                    const combinedResponse = {
                        fantasy_content: {
                            ...batchedResponses[0]?.fantasy_content,
                            league: [
                                batchedResponses[0]?.fantasy_content?.league?.[0], // league info
                                {
                                    players: combinedPlayers,
                                },
                            ],
                        },
                    };

                    res.status(200).json(combinedResponse);
                    return;
                }

                case "settings": {
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/settings?format=json`;
                    break;
                }

                default:
                    res.status(400).json({ error: "Invalid 'type' parameter" });
                    return;

            }

            const yahooResponse = await fetch(endpoint, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                },
            });

            const text = await yahooResponse.text();
            const json = JSON.parse(text.replace(/^callback\((.*)\)$/, "$1")); // Clean Yahoo's callback wrapper

            res.status(200).json(json);
            return;
        } catch (error) {
            console.error("Error fetching from Yahoo API:", error);
            res.status(500).json({ error: "Failed to fetch data from Yahoo" });
            return;
        }
    }
);

export { };