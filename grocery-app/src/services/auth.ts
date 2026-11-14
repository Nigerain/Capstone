import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { apiPost } from './api';
import { getFirebaseAuth } from './firebase';

// Same switch as priceService. Read here directly, because priceService imports this file.
const USE_MOCK_DATA = process.env.EXPO_PUBLIC_USE_MOCK_DATA !== 'false';

// The Firebase ID token for the signed-in user, sent to the backend as
// "Authorization: Bearer <token>". getIdToken() refreshes it on its own
// when it's about to expire (tokens last about an hour).
export async function getAuthToken(): Promise<string | null> {
  if (!USE_MOCK_DATA) {
    const user = getFirebaseAuth().currentUser;
    if (user) return user.getIdToken();
  }
  // TEMPORARY fallback for testing real scanning while search/sign-in stay
  // mocked (EXPO_PUBLIC_USE_MOCK_DATA=true, EXPO_PUBLIC_USE_MOCK_OCR=false).
  // Remove once everyone signs in for real.
  return process.env.EXPO_PUBLIC_DEV_ID_TOKEN || null;
}

export type AuthUser = {
  uid: string; // Firebase UID (matches users.id in the database)
  firstName: string;
  lastName: string;
  email: string;
};

export type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

// An error with a message that's safe to show on screen.
export class AuthError extends Error {
  field?: keyof SignUpInput; // which input it belongs to, if any

  constructor(message: string, field?: keyof SignUpInput) {
    super(message);
    this.name = 'AuthError';
    this.field = field;
  }
}

// Turns Firebase's error codes into messages people can act on.
// Codes: https://firebase.google.com/docs/reference/js/auth#autherrorcodes
function toAuthError(error: unknown): AuthError {
  if (!(error instanceof FirebaseError)) {
    return new AuthError('Something went wrong. Please try again.');
  }
  switch (error.code) {
    case 'auth/email-already-in-use':
      return new AuthError('An account with this email already exists.', 'email');
    case 'auth/invalid-email':
      return new AuthError('Enter a valid email, like you@email.com.', 'email');
    case 'auth/weak-password':
      return new AuthError('Choose a stronger password.', 'password');
    // Same message for a bad email or a bad password, so the app never
    // reveals which emails have accounts.
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new AuthError('Incorrect email or password.');
    case 'auth/too-many-requests':
      return new AuthError('Too many attempts. Please wait a few minutes and try again.');
    case 'auth/network-request-failed':
      return new AuthError('Couldn’t connect. Check your internet and try again.');
    default:
      return new AuthError('Something went wrong. Please try again.');
  }
}

// The backend has no "get my profile" endpoint yet, so the name comes from
// the Firebase account's displayName ("Jordan Smith"), saved at sign up.
// Everything before the first space is the first name.
function toAuthUser(user: User): AuthUser {
  const [firstName = '', ...rest] = (user.displayName ?? '').trim().split(/\s+/);
  return {
    uid: user.uid,
    firstName: firstName || nameFromEmail(user.email ?? ''),
    lastName: rest.join(' '),
    email: user.email ?? '',
  };
}

// The backend requires a username, but the sign up screen doesn't ask for one,
// so use the part of the email before the @ ("jordan.smith").
// Usernames don't have to be unique in the database.
function usernameFromEmail(email: string) {
  return email.split('@')[0].toLowerCase();
}

export async function signUp(input: SignUpInput): Promise<AuthUser> {
  if (USE_MOCK_DATA) {
    // Pretend to talk to a server so the loading state is visible.
    await new Promise((resolve) => setTimeout(resolve, 800));
    // Lets you test the "email taken" error: sign up with taken@example.com.
    if (input.email.toLowerCase() === 'taken@example.com') {
      throw new AuthError(
        'An account with this email already exists.',
        'email'
      );
    }
    return {
      uid: `mock-${Date.now()}`,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
    };
  }

  // 1. Create the Firebase account (this also signs them in).
  let user: User;
  try {
    ({ user } = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      input.email,
      input.password
    ));
  } catch (error) {
    throw toAuthError(error);
  }

  try {
    // 2. Save the name on the Firebase account, so logging in later can greet them.
    await updateProfile(user, {
      displayName: `${input.firstName} ${input.lastName}`,
    });
    // 3. Create their row in the users table. The backend reads the UID and
    // email from the token, so only the names are sent.
    await apiPost(
      '/api/v1/users/profile',
      {
        username: usernameFromEmail(input.email),
        firstName: input.firstName,
        lastName: input.lastName,
      },
      await user.getIdToken()
    );
  } catch (error) {
    // Without a users row, they couldn't submit prices. Delete the half-made
    // Firebase account so they can sign up again with the same email.
    console.warn('Sign up: creating the profile failed, undoing.', error);
    await user.delete().catch(() => signOut(getFirebaseAuth()));
    throw new AuthError(
      'We couldn’t finish creating your account. Please try again.'
    );
  }

  return {
    uid: user.uid,
    firstName: input.firstName,
    lastName: input.lastName,
    email: user.email ?? input.email,
  };
}

export type LogInInput = {
  email: string;
  password: string;
};

// "Jordan" from "jordan.smith@email.com", for the mock greeting.
function nameFromEmail(email: string) {
  const first = email.split('@')[0].split(/[._-]/)[0] || 'there';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export async function logIn(input: LogInInput): Promise<AuthUser> {
  if (USE_MOCK_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    // Lets you test the error: log in with wrong@example.com.
    if (input.email.toLowerCase() === 'wrong@example.com') {
      throw new AuthError('Incorrect email or password.');
    }
    return {
      uid: `mock-${Date.now()}`,
      firstName: nameFromEmail(input.email),
      lastName: '',
      email: input.email,
    };
  }

  try {
    const { user } = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      input.email,
      input.password
    );
    return toAuthUser(user);
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function logOut(): Promise<void> {
  if (USE_MOCK_DATA) return;
  await signOut(getFirebaseAuth());
}

// Emails a reset link. Succeeds even if no account uses that email, so the
// app never reveals which emails have accounts.
export async function resetPassword(email: string): Promise<void> {
  if (USE_MOCK_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/user-not-found') {
      return;
    }
    throw toAuthError(error);
  }
}

// Calls `onChange` with the signed-in user, or null, now and on every change.
// Firebase restores the saved session at app start, so this is how someone
// who signed in yesterday is still signed in today. Returns an unsubscribe.
// Mock mode has no saved session, so it does nothing there.
export function watchAuthUser(
  onChange: (user: AuthUser | null) => void
): () => void {
  if (USE_MOCK_DATA) return () => {};
  return onAuthStateChanged(getFirebaseAuth(), (user) =>
    onChange(user ? toAuthUser(user) : null)
  );
}
