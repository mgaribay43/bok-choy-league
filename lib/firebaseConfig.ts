import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyD-wNzUysL_Fm-5S-Rvvey9WLJZIheWvVU",
    authDomain: "bokchoyleague.firebaseapp.com",
    projectId: "bokchoyleague",
    storageBucket: "bokchoyleague.firebasestorage.app",
    messagingSenderId: "566835598665",
    appId: "1:566835598665:web:880217b1673beb7ff07698",
    measurementId: "G-VZ43L4BECL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
