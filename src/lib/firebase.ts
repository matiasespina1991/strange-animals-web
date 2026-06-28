import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDqMlDBhMvV3ZATPidgICQ0PI11uee_dr8",
  authDomain: "strange-animals-web.firebaseapp.com",
  projectId: "strange-animals-web",
  storageBucket: "strange-animals-web.firebasestorage.app",
  messagingSenderId: "536380283169",
  appId: "1:536380283169:web:e49aac72a45094854f0660",
  measurementId: "G-G1HRY6J91J",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseDb = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

export const analyticsPromise: Promise<Analytics | undefined> =
  typeof window === "undefined"
    ? Promise.resolve(undefined)
    : isSupported()
        .then((supported) =>
          supported ? getAnalytics(firebaseApp) : undefined,
        )
        .catch(() => undefined);
