// functions/src/getTeams.ts
import { onRequest } from "firebase-functions/v2/https";
import axios from "axios";
import { getTokensForUser } from "./utils/tokenStorage";

export const getTeams = onRequest(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    try {

      const tokens = await getTokensForUser();
      if (!tokens || !tokens.access_token) {
        res.status(401).json({ error: "Access token not found" });
        return;
      }

      const accessToken = tokens.access_token;

      // Example league key, you can dynamically get this from another API call
      const leagueKey = "nfl.l.128797"; // replace with actual league key

      // Yahoo Fantasy Team API: Get user's teams in a league
      const url = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      res.status(200).json(response.data);
    } catch (error: any) {
      console.error("Yahoo API Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch team data" });
    }
  }
);
