import * as functions from "firebase-functions";
import axios from "axios";

const CLIENT_ID = functions.config().yahoo.client_id;
const CLIENT_SECRET = functions.config().yahoo.client_secret;
const REDIRECT_URI = "https://thebokchoyleague.com/oauth/callbackpage";

export const yahooOAuth = functions.https.onRequest(async (req, res) => {
  const code = req.body.code;

  if (!code) {
    res.status(400).send({ error: 'Missing authorization code' });
    return;
  }

  const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code,
  });

  try {
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Optionally save these to Firestore or Firebase config
    res.status(200).send({ access_token, refresh_token, expires_in });
  } catch (error: any) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(500).send({ error: 'Token exchange failed' });
  }
});
