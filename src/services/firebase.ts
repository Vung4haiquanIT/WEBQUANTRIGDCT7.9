import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc as rawSetDoc, 
  updateDoc as rawUpdateDoc, 
  addDoc as rawAddDoc,
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  Firestore,
  writeBatch,
  SetOptions
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { sanitizeFirestoreData } from '../utils/firestoreUtils';

// Initialize Firebase App
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom Database ID if specified and ignoreUndefinedProperties
export const db: Firestore = getApps().length <= 1 
  ? initializeFirestore(app, { ignoreUndefinedProperties: true }, (firebaseConfig as any).firestoreDatabaseId || undefined)
  : getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || undefined);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firebase Storage
export const storage: FirebaseStorage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

/**
 * Sanitized wrapper for Firestore setDoc to guarantee zero-undefined payloads
 */
export const setDoc = async (reference: any, data: any, options?: SetOptions) => {
  const sanitized = sanitizeFirestoreData(data);
  return options ? rawSetDoc(reference, sanitized, options) : rawSetDoc(reference, sanitized);
};

/**
 * Sanitized wrapper for Firestore updateDoc to guarantee zero-undefined payloads
 */
export const updateDoc = async (reference: any, data: any) => {
  const sanitized = sanitizeFirestoreData(data);
  return rawUpdateDoc(reference, sanitized);
};

/**
 * Sanitized wrapper for Firestore addDoc to guarantee zero-undefined payloads
 */
export const addDoc = async (reference: any, data: any) => {
  const sanitized = sanitizeFirestoreData(data);
  return rawAddDoc(reference, sanitized);
};

export {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
};
export type { FirebaseUser };

