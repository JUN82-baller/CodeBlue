import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App safely (singleton)
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);

// Configure Google Auth Provider with Google Sheets, Google Drive, and Gmail scopes
const googleProvider = new GoogleAuthProvider();
export const GOOGLE_WORKSPACE_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
];

export const GOOGLE_SHEETS_SCOPES = GOOGLE_WORKSPACE_SCOPES;

GOOGLE_WORKSPACE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

// Flag to track sign-in in progress
let isSigningIn = false;

// Cached in-memory access token (Do NOT store in localStorage per guidelines)
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Initialize auth state listener.
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(firebaseAuth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken && Date.now() < tokenExpiresAt) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      tokenExpiresAt = 0;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Trigger Google Sign-In popup to obtain OAuth token with Sheets scopes
 */
export const signInWithGoogleSheets = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Không thể lấy Google OAuth Access Token từ phiên đăng nhập.');
    }

    cachedAccessToken = credential.accessToken;
    // Set 1 hour expiry fallback
    tokenExpiresAt = Date.now() + 3500 * 1000;

    return {
      user: result.user,
      accessToken: cachedAccessToken,
    };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get the current cached in-memory access token
 */
export const getGoogleAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }
  return null;
};

/**
 * Sign out from Google Auth
 */
export const signOutGoogle = async (): Promise<void> => {
  await signOut(firebaseAuth);
  cachedAccessToken = null;
  tokenExpiresAt = 0;
};

/**
 * Get current Firebase Auth user
 */
export const getCurrentGoogleUser = (): User | null => {
  return firebaseAuth.currentUser;
};
