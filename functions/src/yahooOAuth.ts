import { onRequest } from "firebase-functions/v2/https";
import axios from "axios";
import { defineSecret } from "firebase-functions/params";

const YAHOO_CLIENT_ID = defineSecret("YAHOO_CLIENT_ID");
const YAHOO_CLIENT_SECRET = defineSecret("YAHOO_CLIENT_SECRET");
const REDIRECT_URI = defineSecret("YAHOO_REDIRECT_URI");
import { saveTokensForUser } from './utils/tokenStorage';

export const yahooOAuth = onRequest(
  {
    secrets: [YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET],
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
    region: "us-central1",
    invoker: "public",
  },
  async (req, res) => {
    try {
      // Access secrets from environment variables injected by Firebase at runtime
      const CLIENT_ID = process.env.YAHOO_CLIENT_ID!;
      const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET!;
      const code = req.body.code;

      if (!code) {
        res.status(400).send({ error: "Missing authorization code" });
        return;
      }

      const tokenUrl = "https://api.login.yahoo.com/oauth2/get_token";

      const params = new URLSearchParams({
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI.value(),
        code,
      });

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // 🟢 ✅ Store tokens using your utility function
      await saveTokensForUser(access_token, refresh_token, expires_in);

      res.status(200).send({ access_token, refresh_token, expires_in });
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error("Token exchange error response:", error.response?.data);
        console.error("Token exchange status:", error.response?.status);
        console.error("Token exchange headers:", error.response?.headers);
      } else {
        console.error("Unexpected error:", error);
      }
      res.status(500).send({ error: "Token exchange failed" });
    }
  }
);
