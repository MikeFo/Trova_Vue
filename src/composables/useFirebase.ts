import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { environment } from '../environments/environment';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;
let storage: FirebaseStorage | null = null;
let firestore: Firestore | null = null;

// Resolves once Firebase has determined auth state (user restored or confirmed absent).
let authReady: Promise<void> | null = null;

export function useFirebase() {
  try {
    if (!app) {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
      } else {
        if (!environment?.firebaseConfig) {
          console.warn('Firebase config not found in environment');
          return { app: null, auth: null, database: null, storage: null, firestore: null, authReady: Promise.resolve() };
        }
        app = initializeApp(environment.firebaseConfig);
      }
    }

    if (!auth && app) {
      auth = getAuth(app);
      setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.warn('Failed to set auth persistence:', error);
      });

      authReady = new Promise<void>((resolve) => {
        const unsubscribe = onAuthStateChanged(auth!, () => {
          unsubscribe();
          resolve();
        });
        setTimeout(resolve, 3000);
      });
    }

    if (!database && app) {
      database = getDatabase(app);
    }

    if (!storage && app) {
      storage = getStorage(app);
    }

    if (!firestore && app) {
      firestore = getFirestore(app);
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return { app: null, auth: null, database: null, storage: null, firestore: null, authReady: Promise.resolve() };
  }

  return {
    app,
    auth,
    database,
    storage,
    firestore,
    authReady: authReady || Promise.resolve(),
  };
}

