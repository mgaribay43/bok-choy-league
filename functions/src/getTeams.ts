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

      // const url = `https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games?format=json`; <-- Use to gather game codes for all years

      // Example league key, you can dynamically get this from another API call
      // Where "461" = 2025 year game code | "1" = league | "128797" = league ID (new every year) (can append t.1 to the end for data from only team x i.e 1-10)

      //const leagueKey25 = "461.l.128797";
      const leagueKey24 = "449.l.111890";

      // Yahoo Fantasy Team API: Get user's teams in a league
      const url = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey24}/teams?format=json`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      res.status(200).json(response.data);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error("Yahoo API Error:");
        console.error("Message:", error.message);
        console.error("Status:", error.response?.status);
        console.error("Headers:", error.response?.headers);
        console.error("Data:", JSON.stringify(error.response?.data, null, 2));
        console.error("Config:", error.config);
      } else {
        console.error("Unknown Error:", error);
      }

      res.status(500).json({ error: "Failed to fetch team data" });
    }
  }
);
