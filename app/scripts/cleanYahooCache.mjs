/**
 * Script to delete yahooCache documents that begin with playerstats_2025
 * Usage: node cleanYahooCache.mjs [--execute]
 * If --execute is not provided, runs in preview mode.
 */

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, terminate } from "firebase/firestore";

// Firebase config - use actual config from your project
const firebaseConfig = {
  apiKey: "AIzaSyD-wNzUysL_Fm-5S-Rvvey9WLJZIheWvVU",
  authDomain: "bokchoyleague.firebaseapp.com",
  projectId: "bokchoyleague",
  storageBucket: "bokchoyleague.firebasestorage.app",
  messagingSenderId: "566835598665",
  appId: "1:566835598665:web:880217b1673beb7ff07698",
  measurementId: "G-VZ43L4BECL"
};

// Initialize Firebase
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const shouldExecute = process.argv.includes("--execute");

async function cleanupAndExit(code = 0) {
  try {
    await terminate(db);
    process.exit(code);
  } catch (error) {
    console.error("❌ Error closing Firebase connection:", error);
    process.exit(1);
  }
}

async function cleanYahooCache() {
  const cacheCollection = collection(db, "yahooCache");
  const snapshot = await getDocs(cacheCollection);

  // Filter docs that start with playerstats_2025
  const targetDocs = snapshot.docs.filter(docSnap =>
    docSnap.id.startsWith("playerstats_2025")
  );

  if (targetDocs.length === 0) {
    console.log("No matching documents found.");
    await cleanupAndExit(0);
    return;
  }

  if (!shouldExecute) {
    console.log(`🔍 PREVIEW MODE: Would delete ${targetDocs.length} documents:`);
    targetDocs.forEach(docSnap => {
      console.log(` - ${docSnap.id}`);
    });
    console.log("\nRun with --execute to actually delete.");
    await cleanupAndExit(0);
    return;
  }

  let deleted = 0;
  for (const docSnap of targetDocs) {
    await deleteDoc(doc(db, "yahooCache", docSnap.id));
    console.log(`🗑️  Deleted: ${docSnap.id}`);
    deleted++;
  }

  console.log(`\n✅ Deleted ${deleted} documents starting with playerstats_2025`);
  await cleanupAndExit(0);
}

cleanYahooCache().catch(async (err) => {
  console.error("Error cleaning yahooCache:", err);
  await cleanupAndExit(1);
});