import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  // Only in Firebase's React Native build. The "paths" entry in tsconfig.json
  // points TypeScript at those typings so this import type-checks.
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

// The web app config from Firebase Console > Project settings > Your apps.
// None of these are secrets: they only say which Firebase project to talk to.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID, // optional for Auth
};

let auth: Auth | null = null;

// Set up Firebase and keep the signed in session
export function getFirebaseAuth(): Auth {
  if (auth) return auth;

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      'Firebase isn’t set up. Add EXPO_PUBLIC_FIREBASE_API_KEY and EXPO_PUBLIC_FIREBASE_PROJECT_ID to .env, then run npx expo start -c.'
    );
  }

  // Fast Refresh can run this file again, and Firebase throws if the same
  // app or auth is set up twice, so reuse them when they already exist.
  if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    // AsyncStorage keeps the session on the phone, so people stay signed in
    // after closing the app. Without it, they'd be signed out on every restart.
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    auth = getAuth(getApp());
  }
  return auth;
}
