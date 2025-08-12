// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyD-wNzUysL_Fm-5S-Rvvey9WLJZIheWvVU",
    authDomain: "bokchoyleague.firebaseapp.com",
    projectId: "bokchoyleague",
    storageBucket: "bokchoyleague.firebasestorage.app",
    messagingSenderId: "566835598665",
    appId: "1:566835598665:web:880217b1673beb7ff07698",
    measurementId: "G-VZ43L4BECL"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Initialize Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);