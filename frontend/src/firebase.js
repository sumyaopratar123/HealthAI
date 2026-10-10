import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAS6AfVGDwRV1aQOYZMePQbxc4pcXWbTYQ",
  authDomain: "healthai-project-525f2.firebaseapp.com",
  projectId: "healthai-project-525f2",
  storageBucket: "healthai-project-525f2.firebasestorage.app",
  messagingSenderId: "530892257508",
  appId: "1:530892257508:web:6f463d3908c139c0d654f1",
  measurementId: "G-0SM3M2P1FB"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();