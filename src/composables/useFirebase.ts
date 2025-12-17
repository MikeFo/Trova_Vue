import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { environment } from '../environments/environment';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;
let storage: FirebaseStorage | null = null;
let firestore: Firestore | null = null;

export function useFirebase() {
  try {
    if (!app) {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
      } else {
        if (!environment?.firebaseConfig) {
          console.warn('Firebase config not found in environment');
          return { app: null, auth: null, database: null, storage: null, firestore: null };
        }
        app = initializeApp(environment.firebaseConfig);
      }
    }

    if (!auth && app) {
      auth = getAuth(app);
      // Explicitly set persistence to LOCAL (default for web, but being explicit)
      // This ensures auth state persists across page refreshes
      setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.warn('Failed to set auth persistence:', error);
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
    return { app: null, auth: null, database: null, storage: null, firestore: null };
  }

  return {
    app,
    auth,
    database,
    storage,
    firestore,
  };
}

