// functions/src/refreshTokens.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { getFirestore } from "firebase-admin/firestore";
import { saveTokensForUser } from "./utils/tokenStorage"; // assumes this stores to Firestore
import { defineSecret } from "firebase-functions/params";

const YAHOO_CLIENT_ID = defineSecret("YAHOO_CLIENT_ID");
const YAHOO_CLIENT_SECRET = defineSecret("YAHOO_CLIENT_SECRET");
const YAHOO_REDIRECT_URI = defineSecret("YAHOO_REDIRECT_URI");

export const refreshTokens = onSchedule(
    {
        schedule: "*/30 * * * *",
        region: "us-central1",
        timeoutSeconds: 60,
        memory: "256MiB",
        secrets: [YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, YAHOO_REDIRECT_URI],
        invoker: "public",
    },
    async () => {
        const db = getFirestore();
        const tokenDocRef = db.collection("tokens").doc("master");
        const tokenDoc = await tokenDocRef.get();
        const clientId = YAHOO_CLIENT_ID.value();
        const clientSecret = YAHOO_CLIENT_SECRET.value();
        const redirectUri = YAHOO_REDIRECT_URI.value();

        if (!tokenDoc.exists) {
            console.error("No token document found in Firestore.");
            return;
        }

        const { refresh_token } = tokenDoc.data() as {
            refresh_token: string;
        };

        try {
            const params = new URLSearchParams();
            params.append("grant_type", "refresh_token");
            params.append("refresh_token", refresh_token);
            params.append("redirect_uri", redirectUri);

            const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

            const response = await axios.post("https://api.login.yahoo.com/oauth2/get_token", params, {
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            await saveTokensForUser(
                response.data.access_token,
                response.data.refresh_token ?? refresh_token,
                Date.now() + response.data.expires_in * 1000
            );

            console.log("Yahoo tokens refreshed and saved to Firestore.");

        } catch (error: any) {
            console.error("Failed to refresh Yahoo tokens:", error.response?.data || error.message);
        }
    }
);
