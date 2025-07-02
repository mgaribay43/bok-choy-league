// functions/src/getStandings.ts
import { onRequest } from "firebase-functions/v2/https";
import axios from "axios";
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

export const getStandings = onRequest(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    try {
      const year = req.query.year as string;

      if (!year || !(year in leagueKeysByYear)) {
        res.status(400).json({ error: "Invalid or missing 'year' query parameter" });
        return;
      }

      const leagueKey = leagueKeysByYear[year];

      const tokens = await getTokensForUser();
      if (!tokens || !tokens.access_token) {
        res.status(401).json({ error: "Access token not found" });
        return;
      }

      const accessToken = tokens.access_token;

      const url = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;

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

      res.status(500).json({ error: "Failed to fetch standings data" });
    }
  }
);
export{};
