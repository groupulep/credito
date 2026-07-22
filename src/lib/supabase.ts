import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, Loan } from '../types';

export function getSupabaseConfig() {
  const localUrl = localStorage.getItem('crediulep_supabase_url');
  const localKey = localStorage.getItem('crediulep_supabase_key');

  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const url = localUrl && localUrl.trim().length > 0 ? localUrl.trim() : envUrl.trim();
  const key = localKey && localKey.trim().length > 0 ? localKey.trim() : envKey.trim();

  return { url, key };
}

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = getSupabaseConfig();
  return Boolean(
    url &&
      url.length > 0 &&
      !url.includes('YOUR_') &&
      key &&
      key.length > 0 &&
      !key.includes('YOUR_')
  );
};

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const { url, key } = getSupabaseConfig();
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

export const supabase = getSupabaseClient();

export const CLIENTS_TABLE = 'clients';

export const SUPABASE_SQL_SETUP = `-- Script de creación de tabla en Supabase
CREATE TABLE IF NOT EXISTS public.clients (
  cedula TEXT PRIMARY KEY,
  nombre TEXT,
  correo TEXT,
  telefono TEXT,
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Políticas de seguridad RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica" ON public.clients;
CREATE POLICY "Permitir lectura publica" ON public.clients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica" ON public.clients;
CREATE POLICY "Permitir insercion publica" ON public.clients FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion publica" ON public.clients;
CREATE POLICY "Permitir actualizacion publica" ON public.clients FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion publica" ON public.clients;
CREATE POLICY "Permitir eliminacion publica" ON public.clients FOR DELETE USING (true);
`;

/**
 * Test Supabase connection in real time
 */
export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ success: boolean; message: string; tableExists?: boolean }> {
  try {
    let client: SupabaseClient | null = null;
    if (customUrl && customKey) {
      client = createClient(customUrl.trim(), customKey.trim());
    } else {
      client = getSupabaseClient();
    }

    if (!client) {
      return {
        success: false,
        message: 'No se han proporcionado las credenciales de Supabase (URL y Anon Key).',
      };
    }

    // Try selecting from table
    const { data, error } = await client.from(CLIENTS_TABLE).select('cedula').limit(1);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation "public.clients"')) {
        return {
          success: true,
          tableExists: false,
          message: '¡Conexión exitosa a Supabase! Sin embargo, la tabla "clients" aún no ha sido creada.',
        };
      }
      return {
        success: false,
        message: `Error de Supabase: ${error.message} (Código: ${error.code || 'Desconocido'})`,
      };
    }

    return {
      success: true,
      tableExists: true,
      message: `¡Conexión exitosa a Supabase! La tabla "clients" está activa (${data?.length || 0} registros leídos).`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error al intentar conectar: ${err?.message || String(err)}`,
    };
  }
}

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

  const cleanObj = typeof client === 'string' ? JSON.parse(client) : client;
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

/**
 * Fetch all clients from Supabase table 'clients'
 */
export async function fetchClientsFromSupabase(): Promise<Client[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from(CLIENTS_TABLE).select('*');
    if (error || !data) {
      return [];
    }
    return data.map((row: any) => {
      if (row.data && typeof row.data === 'object') {
        return sanitizeClient({ ...row.data, cedula: row.cedula || row.data.cedula });
      }
      return sanitizeClient(row as Client);
    });
  } catch {
    return [];
  }
}

/**
 * Save or update a single client in Supabase
 */
export async function saveClientToSupabase(clientObj: Client): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const cleanClient = sanitizeClient(clientObj);
    if (!cleanClient.cedula) return;

    const record = {
      cedula: cleanClient.cedula,
      nombre: cleanClient.nombre,
      correo: cleanClient.correo,
      telefono: cleanClient.telefono,
      data: cleanClient,
      updated_at: new Date().toISOString(),
    };

    await client.from(CLIENTS_TABLE).upsert(record, { onConflict: 'cedula' });
  } catch {
    // Quiet fallback
  }
}

/**
 * Delete a client from Supabase
 */
export async function deleteClientFromSupabase(cedula: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    if (!cedula) return;
    await client.from(CLIENTS_TABLE).delete().eq('cedula', cedula);
  } catch {
    // Quiet fallback
  }
}

/**
 * Seed initial clients to Supabase if empty
 */
export async function seedClientsToSupabase(initialClients: Client[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !initialClients || initialClients.length === 0) return;
  try {
    const records = initialClients
      .map((c) => sanitizeClient(c))
      .filter((c) => Boolean(c.cedula))
      .map((cleanClient) => ({
        cedula: cleanClient.cedula,
        nombre: cleanClient.nombre,
        correo: cleanClient.correo,
        telefono: cleanClient.telefono,
        data: cleanClient,
        updated_at: new Date().toISOString(),
      }));

    if (records.length > 0) {
      await client.from(CLIENTS_TABLE).upsert(records, { onConflict: 'cedula' });
    }
  } catch {
    // Quiet fallback
  }
}

/**
 * Subscribe to real-time updates from Supabase
 */
export function subscribeToClientsSupabase(
  onUpdate: (clients: Client[]) => void,
  onError?: (error: Error) => void
) {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  try {
    // Initial fetch
    fetchClientsFromSupabase()
      .then((clients) => {
        if (clients.length > 0) {
          onUpdate(clients);
        }
      })
      .catch((err) => {
        if (onError) onError(err);
      });

    // Real-time subscription
    const channel = client
      .channel('public:clients')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: CLIENTS_TABLE },
        () => {
          fetchClientsFromSupabase()
            .then((clients) => onUpdate(clients))
            .catch((err) => {
              if (onError) onError(err);
            });
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    if (onError) onError(err as Error);
    return () => {};
  }
}
