import { onRequest } from "firebase-functions/v2/https";
import axios from "axios";

const CLIENT_ID = process.env.YAHOO_CLIENT_ID!;
const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET!;
const REDIRECT_URI = "https://thebokchoyleague.com/oauth/callback/";

export const yahooOAuth = onRequest(
  {
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    const code = req.body.code;
    if (!code) {
      res.status(400).send({ error: "Missing authorization code" });
      return;
    }

    const tokenUrl = "https://api.login.yahoo.com/oauth2/get_token";
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    });

    try {
      const response = await axios.post(tokenUrl, params, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      res.status(200).send({ access_token, refresh_token, expires_in });
    } catch (error: any) {
      console.error("Token exchange error:", error.response?.data || error.message);
      res.status(500).send({ error: "Token exchange failed" });
    }
  }
);
