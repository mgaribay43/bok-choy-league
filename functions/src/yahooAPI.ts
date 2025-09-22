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
// Use current year for all logic
const CURRENT_YEAR = new Date().getFullYear();

// SportsDB API key
const API_KEY =
    process.env.THESPORTSDB_API_KEY_PREMIUM ||
    process.env.THESPORTSDB_API_KEY ||
    "307739"; // set your key in env for prod

const getLeagueKeysByYear = async (): Promise<Record<string, string>> => {
    const leagueKeysSnapshot = await admin
        .firestore()
        .collection("League_Keys")
        .doc("leagueKeysByYear")
        .get();
    if (!leagueKeysSnapshot.exists) {
        throw new Error("League keys document does not exist");
    }
    return leagueKeysSnapshot.data() as Record<string, string>;
};

if (!admin.apps.length) {
    admin.initializeApp();
}

// Helper to get current NFL week from SportsDB API
async function getCurrentNFLWeek(): Promise<number> {
    const year = CURRENT_YEAR;
    const resp = await fetch(
        `https://www.thesportsdb.com/api/v1/json/${API_KEY}/eventsseason.php?id=4391&s=${year}`
    );
    const data = (await resp.json()) as { events?: any[] };
    let currentWeek = 1;
    if (Array.isArray(data.events)) {
        const now = Date.now();
        // Find the latest event that has started or is in progress
        const sorted = data.events
            .filter(ev => ev.intRound && ev.dateEvent)
            .sort((a, b) => new Date(a.dateEvent).getTime() - new Date(b.dateEvent).getTime());
        for (const ev of sorted) {
            if (new Date(ev.dateEvent).getTime() > now) break;
            currentWeek = Number(ev.intRound) || currentWeek;
        }
    }
    return currentWeek;
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
        const year = parseInt((req.query.year as string) || String(CURRENT_YEAR), 10); // default to CURRENT_YEAR
        const weekParam = req.query.week as string | undefined;
        const week = weekParam && weekParam.trim() !== "" ? `;week=${weekParam}` : "";
        const playerKeys = (req.query.playerKeys as string) || ""; // optional playerKeys param

        // Fetch leagueKeysByYear inside the handler
        const leagueKeysByYear = await getLeagueKeysByYear();

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
                case "teams": {
                    if (year === CURRENT_YEAR) {
                        endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
                        break;
                    }
                    const cacheKey = `teams_${year}`;
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        res.status(200).json(cached);
                        return;
                    }
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
                    break;
                }
                case "standings": {
                    if (year === CURRENT_YEAR) {
                        endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;
                        break;
                    }
                    const cacheKey = `standings_${year}`;
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        res.status(200).json(cached);
                        return;
                    }
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;
                    break;
                }
                case "scoreboard": {
                    if (year === CURRENT_YEAR) {
                        endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard${week}?format=json`;
                        break;
                    }
                    const cacheKey = `scoreboard_${year}_${weekParam || ""}`;
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        res.status(200).json(cached);
                        return;
                    }
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard${week}?format=json`;
                    break;
                }
                case "draftresults": {
                    const cacheKey = `draftresults_${year}`;
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        res.status(200).json(cached);
                        return;
                    }
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/draftresults?format=json`;
                    break;
                }
                case "roster": {
                    if (year === CURRENT_YEAR) {
                        const teamId = (req.query.teamId as string) || "1";
                        endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/team/${leagueKey}.t.${teamId}/roster${week}?format=json`;
                        break;
                    }
                    const teamId = (req.query.teamId as string) || "1";
                    const validTeam = /^[1-9]$|^10$/.test(teamId);
                    if (!validTeam) {
                        res.status(400).json({ error: "Invalid teamId (must be 1–10)" });
                        return;
                    }
                    const cacheKey = `roster_${year}_${teamId}_${weekParam || ""}`;
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        res.status(200).json(cached);
                        return;
                    }
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/team/${leagueKey}.t.${teamId}/roster${week}?format=json`;
                    break;
                }
                case "players":
                    if (playerKeys.trim() === "") {
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
                        const keysArray = playerKeys.split(",");
                        const batchSize = 25;
                        const batchedResponses = [];

                        for (let i = 0; i < keysArray.length; i += batchSize) {
                            const batchKeys = keysArray.slice(i, i + batchSize).join(",");
                            const batchEndpoint = `https://fantasysports.yahooapis.com/fantasy/v2/players;player_keys=${batchKeys}?format=json`;

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
                                    batchedResponses[0]?.fantasy_content?.league?.[0],
                                    {
                                        players: combinedPlayers,
                                    },
                                ],
                            },
                        };
                        res.status(200).json(combinedResponse);
                        return;
                    }

                case "playerstats": {
                    if (playerKeys.trim() === "") {
                        res.status(400).json({ error: "Missing playerKeys parameter for playerstats" });
                        return;
                    }

                    // Use SportsDB API to get the current NFL week
                    let isLiveWeek = false;
                    try {
                        const currentWeek = await getCurrentNFLWeek();
                        isLiveWeek = !!(weekParam && Number(weekParam) === currentWeek);
                    } catch (err) {
                        isLiveWeek = false;
                    }

                    const cacheKey = `playerstats_${year}_${weekParam || ""}_${playerKeys}`;
                    // Only use cache for non-live weeks
                    if (!isLiveWeek) {
                        const cached = await getCache(cacheKey);
                        if (cached) {
                            res.status(200).json(cached);
                            return;
                        }
                    }

                    const keysArray = playerKeys.split(",");
                    const batchSize = 25;
                    const batchedResponses = [];

                    for (let i = 0; i < keysArray.length; i += batchSize) {
                        const batchKeys = keysArray.slice(i, i + batchSize).join(",");
                        const batchEndpoint = `https://fantasysports.yahooapis.com/fantasy/v2/players;player_keys=${batchKeys}/stats;type=week${week}?format=json`;

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
                                batchedResponses[0]?.fantasy_content?.league?.[0],
                                {
                                    players: combinedPlayers,
                                },
                            ],
                        },
                    };

                    // Cache only for non-live weeks
                    if (!isLiveWeek) {
                        await setCache(cacheKey, combinedResponse);
                    }

                    res.status(200).json(combinedResponse);
                    return;
                }

                case "playerstatsyear": {
                    if (playerKeys.trim() === "") {
                        res.status(400).json({ error: "Missing playerKeys parameter for playerstatsyear" });
                        return;
                    }

                    // batch player keys in groups of 25 max
                    const keysArray = playerKeys.split(",");
                    const batchSize = 25;
                    const batchedResponses = [];

                    // Fetch stats for weeks 1-17 for each batch
                    for (let i = 0; i < keysArray.length; i += batchSize) {
                        const batchKeys = keysArray.slice(i, i + batchSize).join(",");
                        let combinedWeeks: Record<string, any[]> = {};

                        for (let week = 1; week <= 18; week++) {
                            const batchEndpoint = `https://fantasysports.yahooapis.com/fantasy/v2/players;player_keys=${batchKeys}/stats;type=week;week=${week}?format=json`;

                            console.log(`Fetching player week stats batch: ${batchKeys} week: ${week}`);
                            const batchResponse = await fetch(batchEndpoint, {
                                headers: {
                                    Authorization: `Bearer ${accessToken}`,
                                    Accept: "application/json",
                                },
                            });

                            const batchText = await batchResponse.text();
                            const batchJson = JSON.parse(batchText.replace(/^callback\((.*)\)$/, "$1"));

                            // Merge week stats into combinedWeeks
                            const playersObj = batchJson.fantasy_content?.players || {};
                            Object.entries(playersObj).forEach(([key, value]) => {
                                if (key !== "count") {
                                    if (!combinedWeeks[key]) combinedWeeks[key] = [];
                                    combinedWeeks[key].push(value);
                                }
                            });
                        }

                        // Build the batch response with stats_by_week array for each player
                        const batchPlayers: Record<string, any> = {};
                        Object.entries(combinedWeeks).forEach(([key, weekStatsArr]) => {
                            batchPlayers[key] = {
                                player: [
                                    ...(weekStatsArr[0]?.player?.slice(0, 1) || []), // player_key and id
                                    {
                                        player_stats: {
                                            stats_by_week: weekStatsArr.map((weekObj: any) => {
                                                const stats = weekObj?.player?.[1]?.player_stats?.stats || [];
                                                const weekNum = weekObj?.player?.[1]?.player_stats?.["0"]?.week;
                                                const bye = weekObj?.player?.[1]?.player_stats?.bye || 0;
                                                return {
                                                    week: weekNum,
                                                    bye,
                                                    stats,
                                                };
                                            }),
                                        },
                                    },
                                ],
                            };
                        });

                        batchedResponses.push(batchPlayers);
                    }

                    // Merge all batches into one response
                    const combinedPlayers: Record<string, any> = {};
                    for (const batch of batchedResponses) {
                        Object.entries(batch).forEach(([key, value]) => {
                            combinedPlayers[key] = value;
                        });
                    }

                    const combinedResponse = {
                        fantasy_content: {
                            league: [
                                null,
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
                    if (year === CURRENT_YEAR) {
                        endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/settings?format=json`;
                        break;
                    }
                    const cacheKey = `settings_${year}`;
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        res.status(200).json(cached);
                        return;
                    }
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/settings?format=json`;
                    break;
                }
                case "transactions": {
                    const cacheKey = `transactions_${year}`;
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        res.status(200).json(cached);
                        return;
                    }
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/transactions?format=json`;
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

            // Cache after fetch for all supported types:
            if (
                ["teams", "standings", "scoreboard", "draftresults", "roster", "settings", "transactions"].includes(type)
            ) {
                let cacheKey = "";
                switch (type) {
                    case "teams": {
                        if (year === CURRENT_YEAR) {
                            break;
                        }
                        cacheKey = `teams_${year}`;
                        break;
                    }
                    case "standings": {
                        if (year === CURRENT_YEAR) {
                            break;
                        }
                        cacheKey = `standings_${year}`;
                        break;
                    }
                    case "scoreboard": {
                        if (year === CURRENT_YEAR) {
                            break;
                        }
                        cacheKey = `scoreboard_${year}_${weekParam || ""}`;
                        break;
                    }
                    case "draftresults": {
                        cacheKey = `draftresults_${year}`;
                        break;
                    }
                    case "roster": {
                        if (year === CURRENT_YEAR) {
                            break;
                        }
                        const teamId = (req.query.teamId as string) || "1";
                        cacheKey = `roster_${year}_${teamId}_${weekParam || ""}`;
                        break;
                    }
                    case "settings": {
                        if (year === CURRENT_YEAR) {
                            break;
                        }
                        cacheKey = `settings_${year}`;
                        break;
                    }
                    case "transactions": {
                        if (year === CURRENT_YEAR) {
                            break;
                        }
                        cacheKey = `transactions_${year}`;
                        break;
                    }
                }
                await setCache(cacheKey, json);
            }

            res.status(200).json(json);
            return;
        } catch (error) {
            console.error("Error fetching from Yahoo API:", error);
            res.status(500).json({ error: "Failed to fetch data from Yahoo" });
            return;
        }
    }
);

async function getCache(cacheKey: string) {
    const doc = await admin.firestore().collection("yahooCache").doc(cacheKey).get();
    if (!doc.exists) return null;
    const data = doc.data()?.response;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

async function setCache(cacheKey: string, response: any) {
    if (!cacheKey || typeof cacheKey !== "string" || cacheKey.trim() === "") {
        console.error("Invalid cacheKey provided to setCache:", cacheKey);
        return;
    }

    const jsonString = JSON.stringify(response);
    await admin.firestore().collection("yahooCache").doc(cacheKey).set({
        response: jsonString,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}