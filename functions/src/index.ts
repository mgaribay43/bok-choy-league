import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();

export const exchangeYahooCode = functions.https.onRequest(async (req, res) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== "string") {
      res.status(400).send({ error: "Missing or invalid code parameter" });
      return;
    }

    const clientId = functions.config().yahoo.client_id;
    const clientSecret = functions.config().yahoo.client_secret;
    const redirectUri = functions.config().yahoo.redirect_uri;

    // Prepare URL-encoded params
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);

    // Exchange the authorization code for tokens
    const response = await axios.post(
      "https://api.login.yahoo.com/oauth2/get_token",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Save the refresh token securely for future token refreshes
    await db.collection("tokens").doc("yahoo").set(
      {
        refresh_token,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Return tokens to the caller (usually your frontend or backend)
    res.status(200).send({ access_token, expires_in });
  } catch (error: any) {
    console.error("Error exchanging code:", error.response?.data || error.message);
    res.status(500).send({ error: "Failed to exchange code" });
  }
});
