// Firebase Configuration for HaftalikTakip

import { initializeApp } from 'firebase/app';
// import { getAnalytics } from 'firebase/analytics'; // Optional: if you want to use Firebase Analytics
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace the following with your app's Firebase project configuration
// For Firebase JavaScript SDK v7.20.0 and later, `measurementId` is optional
const firebaseConfig = {
  apiKey: "AIzaSyD26RIAW8Afgf-HwkFjKL9jutlVteTT9Xs",
  authDomain: "haftaliktakipapp.firebaseapp.com",
  projectId: "haftaliktakipapp",
  storageBucket: "haftaliktakipapp.firebasestorage.app",
  messagingSenderId: "971501424803",
  appId: "1:971501424803:web:b3e3cd943dc782a13f2f16",
  measurementId: "G-2HKXDTJD3N" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Optional
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };