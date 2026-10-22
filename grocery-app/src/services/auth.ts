// Same switch as priceService. Read here directly, because priceService imports this file.
const USE_MOCK_DATA = process.env.EXPO_PUBLIC_USE_MOCK_DATA !== 'false';

// TEMPORARY until Firebase Auth is connected: a token saved in .env by `npm run dev-token`.
// Tokens expire after about an hour. Never commit a real token.
export async function getAuthToken(): Promise<string | null> {
  return process.env.EXPO_PUBLIC_DEV_ID_TOKEN ?? null;
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

  // TODO(firebase): createUserWithEmailAndPassword, then updateProfile with the name,
  // then create the users row through the backend. Map Firebase error codes to AuthError,
  // e.g. auth/email-already-in-use -> field 'email'.
  throw new AuthError(
    'Sign up isn’t connected to Firebase yet. Use mock mode for now.'
  );
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
      // Same message for a bad email or a bad password, so the app never
      // reveals which emails have accounts.
      throw new AuthError('Incorrect email or password.');
    }
    return {
      uid: `mock-${Date.now()}`,
      firstName: nameFromEmail(input.email),
      lastName: '',
      email: input.email,
    };
  }

  // TODO(firebase): signInWithEmailAndPassword. Map auth/invalid-credential
  // (and auth/user-not-found, auth/wrong-password) to 'Incorrect email or password.'
  // and auth/too-many-requests to a "try again later" message.
  throw new AuthError(
    'Log in isn’t connected to Firebase yet. Use mock mode for now.'
  );
}
