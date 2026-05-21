import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCpU5tD-AzazyxC-PNvTXB2UR8kAfz9-4g",
  authDomain: "denovix-specifications.firebaseapp.com",
  projectId: "denovix-specifications",
  storageBucket: "denovix-specifications.firebasestorage.app",
  messagingSenderId: "905391775193",
  appId: "1:905391775193:web:63f1fc1a2dca3280950dc8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();