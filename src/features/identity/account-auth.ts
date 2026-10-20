import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseApp } from "@/lib/firebase";

// Keep the existing shared access-key session untouched. Same Firebase project,
// separate client persistence namespace; this session grants no editor features.
const accountApp =
  getApps().find((app) => app.name === "identity-account") ??
  initializeApp(firebaseApp.options, "identity-account");
export const accountAuth = getAuth(accountApp);

export function accountError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Check your email and password.";
    case "auth/email-already-in-use":
      return "This email is already registered. Sign in instead.";
    case "auth/weak-password":
      return "Use a stronger password (at least 6 characters).";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Sign in was cancelled.";
    case "auth/popup-blocked":
      return "Allow popups to sign in with Google.";
    case "auth/unauthorized-domain":
      return "This domain must be authorized in Firebase Authentication.";
    case "auth/operation-not-allowed":
      return "This sign-in provider must be enabled in Firebase Authentication.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Check your connection and retry.";
    default:
      return "Could not complete sign-in. Please retry.";
  }
}
