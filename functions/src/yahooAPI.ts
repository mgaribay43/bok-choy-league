// index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getTokensForUser } from "./utils/tokenStorage";

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
        const year = req.query.year as string || "2025"; // default to 2025

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
                case "teams":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
                    break;
                case "standings":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;
                    break;
                case "scoreboard":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard?format=json`;
                    break;
                case "draftresults":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/draftresults?format=json`;
                    break;
                case "players":
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/players?format=json`;
                    break;
                case "roster":
                    // Defaulting to team 1; you could also pass `teamId` as another query param
                    endpoint = `https://fantasysports.yahooapis.com/fantasy/v2/team/${leagueKey}.t.1/roster?format=json`;
                    break;
                default:
                    res.status(400).json({ error: "Invalid 'type' parameter" });
                    return;
            }
            console.log(endpoint);
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
