import { Client, Loan } from '../types';

// Disconnected stubs for auth (not used)
export const db = null;
export const auth = null;
export const googleProvider = null;
export const signInWithPopup = async () => {};

// Helper to sanitize client objects
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

// Local stubs
export async function fetchClientsFromFirebase(): Promise<Client[]> {
  return [];
}

export async function seedClientsToFirebase(): Promise<void> {}

export async function saveClientToFirebase(): Promise<void> {}

export async function deleteClientFromFirebase(): Promise<void> {}

export async function syncAllClientsToFirebase(): Promise<void> {}

export function subscribeToClients(
  _onUpdate: (clients: Client[]) => void,
  _onError?: (error: Error) => void
) {
  return () => {};
}



