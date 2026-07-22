import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, writeBatch, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Client, Loan } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');

export { signInWithPopup, GoogleAuthProvider };

// Initialize Firestore with database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Helper to sanitize client objects so no undefined/NaN fields cause Firestore setDoc failures
export function sanitizeClient(client: Client): Client {
  if (!client) {
    return {
      cedula: '0',
      contrasena: '0',
      nombre: 'Usuario Sin Nombre',
      correo: 'sin_correo@email.com',
      telefono: '3000000000',
      direccion: 'No registrada',
      prestamo: null,
      banco: 'No especificado',
      numeroCuenta: 'No registrada',
      mensajes: [],
      notificaciones: [],
      montoMaximo: 10000000,
    };
  }

  const cleanObj = JSON.parse(JSON.stringify(client));
  const cleanCedula = String(cleanObj.cedula || '').trim();

  let sanitizedLoan: Loan | null = null;
  if (cleanObj.prestamo) {
    const p = cleanObj.prestamo;
    sanitizedLoan = {
      id: String(p.id || `loan-${Math.random().toString(36).substr(2, 9)}`),
      montoOriginal: Number(p.montoOriginal) || 0,
      tasaInteresMensual: Number(p.tasaInteresMensual) || 0,
      plazoMeses: Number(p.plazoMeses) || 12,
      fechaInicio: String(p.fechaInicio || new Date().toISOString().split('T')[0]),
      estado: p.estado || 'vigente',
      cuotas: Array.isArray(p.cuotas)
        ? p.cuotas.map((c: any, index: number) => ({
            id: String(c.id || `inst-${index + 1}`),
            numero: Number(c.numero) || index + 1,
            montoTotal: Number(c.montoTotal) || 0,
            capital: Number(c.capital) || 0,
            interes: Number(c.interes) || 0,
            saldoRestante: Number(c.saldoRestante) || 0,
            fechaVencimiento: String(c.fechaVencimiento || ''),
            pagado: Boolean(c.pagado),
            fechaPago: c.fechaPago ? String(c.fechaPago) : null,
          }))
        : [],
    };
  }

  return {
    cedula: cleanCedula,
    contrasena: String(cleanObj.contrasena || cleanCedula).trim(),
    nombre: String(cleanObj.nombre || '').trim(),
    correo: String(cleanObj.correo || 'sin_correo@email.com').trim(),
    telefono: String(cleanObj.telefono || '3000000000').trim(),
    direccion: String(cleanObj.direccion || 'No registrada').trim(),
    prestamo: sanitizedLoan,
    banco: String(cleanObj.banco || 'No especificado').trim(),
    numeroCuenta: String(cleanObj.numeroCuenta || 'No registrada').trim(),
    mensajes: Array.isArray(cleanObj.mensajes) ? cleanObj.mensajes : [],
    notificaciones: Array.isArray(cleanObj.notificaciones) ? cleanObj.notificaciones : [],
    montoMaximo: Number(cleanObj.montoMaximo) || 10000000,
  };
}

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

// Fetch all clients from Firestore.
export async function fetchClientsFromFirebase(): Promise<Client[]> {
  try {
    const querySnapshot = await getDocs(collection(db, CLIENTS_COLLECTION));
    const clients: Client[] = [];
    querySnapshot.forEach((doc) => {
      clients.push(sanitizeClient(doc.data() as Client));
    });
    return clients;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, CLIENTS_COLLECTION);
  }
}

// Seed initial clients to Firebase
export async function seedClientsToFirebase(initialClients: Client[]): Promise<void> {
  try {
    if (initialClients.length === 0) return;
    const batch = writeBatch(db);
    initialClients.forEach((client) => {
      const cleanClient = sanitizeClient(client);
      const docRef = doc(db, CLIENTS_COLLECTION, cleanClient.cedula);
      batch.set(docRef, cleanClient);
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
    const cleanClient = sanitizeClient(client);
    const docRef = doc(db, CLIENTS_COLLECTION, cleanClient.cedula);
    await setDoc(docRef, cleanClient);
    console.log(`Saved client ${cleanClient.nombre} to Firebase`);
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
      const cleanClient = sanitizeClient(client);
      const docRef = doc(db, CLIENTS_COLLECTION, cleanClient.cedula);
      batch.set(docRef, cleanClient);
    });
    await batch.commit();
    console.log('Successfully synchronized all clients to Firebase!');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, CLIENTS_COLLECTION);
  }
}

// Live real-time subscription for reactive changes
export function subscribeToClients(onUpdate: (clients: Client[]) => void, onError: (error: Error) => void) {
  const q = collection(db, CLIENTS_COLLECTION);
  return onSnapshot(q, (querySnapshot) => {
    const clientsList: Client[] = [];
    const testCedulas = ['12345', '98765', '11111'];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Client;
      if (!testCedulas.includes(data.cedula)) {
        clientsList.push(sanitizeClient(data));
      } else {
        deleteClientFromFirebase(data.cedula).catch(err => console.error('Error deleting test client:', err));
      }
    });
    onUpdate(clientsList);
  }, (error) => {
    console.error('Snapshot error:', error);
    onError(error);
  });
}
