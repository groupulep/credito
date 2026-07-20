import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, getDocFromServer } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Client } from '../types';
import { PRE_SEEDED_CLIENTS } from '../utils';

const firebaseConfig = {
  apiKey: "AIzaSyAMT5aeaY-Elj934ioKYzpbY3zwJG1Ybjw",
  authDomain: "gen-lang-client-0778123662.firebaseapp.com",
  projectId: "gen-lang-client-0778123662",
  storageBucket: "gen-lang-client-0778123662.firebasestorage.app",
  messagingSenderId: "197378777119",
  appId: "1:197378777119:web:104569da124a8e33e9f52a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');

export { signInWithPopup, GoogleAuthProvider };

// Initialize Firestore with specific database ID and force long polling
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, "ai-studio-crediulep-3ac3c98b-5554-4487-a577-229586eab8d9");

// CRITICAL CONSTRAINT: When the application initially boots, call getFromServer to test the connection.
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test completed successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection check: offline mode active or connection pending.");
    } else {
      console.warn("Firestore connection check warning/offline mode active:", error);
    }
  }
}
testConnection();

const CLIENTS_COLLECTION = 'clients';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    operationType,
    path
  };
  
  console.error('Firestore Error Details:', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

// Fetch all clients from Firestore. If empty, seed from PRE_SEEDED_CLIENTS.
export async function fetchClientsFromFirebase(): Promise<Client[]> {
  try {
    const querySnapshot = await getDocs(collection(db, CLIENTS_COLLECTION));
    if (querySnapshot.empty) {
      console.log('No clients found in Firebase. Seeding default clients...');
      await seedClientsToFirebase(PRE_SEEDED_CLIENTS);
      return PRE_SEEDED_CLIENTS;
    }
    const clients: Client[] = [];
    querySnapshot.forEach((doc) => {
      clients.push(doc.data() as Client);
    });
    return clients;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, CLIENTS_COLLECTION);
  }
}

// Seed initial clients to Firebase
export async function seedClientsToFirebase(initialClients: Client[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    initialClients.forEach((client) => {
      const docRef = doc(db, CLIENTS_COLLECTION, client.cedula);
      batch.set(docRef, client);
    });
    await batch.commit();
    console.log('Successfully seeded clients to Firebase!');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, CLIENTS_COLLECTION);
  }
}

// Save or update a single client in Firebase
export async function saveClientToFirebase(client: Client): Promise<void> {
  try {
    const docRef = doc(db, CLIENTS_COLLECTION, client.cedula);
    await setDoc(docRef, client);
    console.log(`Saved client ${client.nombre} to Firebase`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CLIENTS_COLLECTION}/${client.cedula}`);
  }
}

// Delete a client from Firebase
export async function deleteClientFromFirebase(cedula: string): Promise<void> {
  try {
    const docRef = doc(db, CLIENTS_COLLECTION, cedula);
    await deleteDoc(docRef);
    console.log(`Deleted client with cedula ${cedula} from Firebase`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CLIENTS_COLLECTION}/${cedula}`);
  }
}

// Bulk sync all clients to Firebase (useful for migration or full reset)
export async function syncAllClientsToFirebase(clients: Client[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    clients.forEach((client) => {
      const docRef = doc(db, CLIENTS_COLLECTION, client.cedula);
      batch.set(docRef, client);
    });
    await batch.commit();
    console.log('Successfully synchronized all clients to Firebase!');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, CLIENTS_COLLECTION);
  }
}
