/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Installment, Loan } from './types';

// Helper to add months to a YYYY-MM-DD date string
export function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Generate French amortization schedule (Sistema Francés)
export function generateAmortizationSchedule(
  monto: number,
  tasaMensualPct: number,
  plazoMeses: number,
  fechaInicioStr: string
): Installment[] {
  const schedule: Installment[] = [];
  const r = tasaMensualPct / 100; // convert to decimal
  
  // Monthly payment (Anualidad / Cuota fija)
  let cuotaFija = 0;
  if (r === 0) {
    cuotaFija = monto / plazoMeses;
  } else {
    cuotaFija = monto * (r * Math.pow(1 + r, plazoMeses)) / (Math.pow(1 + r, plazoMeses) - 1);
  }

  let saldoPendiente = monto;

  for (let i = 1; i <= plazoMeses; i++) {
    const interes = Number((saldoPendiente * r).toFixed(2));
    let capital = Number((cuotaFija - interes).toFixed(2));
    
    // Adjust final payment to avoid floating point errors
    if (i === plazoMeses) {
      capital = Number(saldoPendiente.toFixed(2));
    }

    const montoTotal = Number((capital + interes).toFixed(2));
    saldoPendiente = Number((saldoPendiente - capital).toFixed(2));
    
    // Ensure outstanding balance is zero on final installment due to precision
    const saldoRestante = i === plazoMeses ? 0 : Math.max(0, saldoPendiente);

    const fechaVencimiento = addMonths(fechaInicioStr, i);

    schedule.push({
      id: `inst-${Math.random().toString(36).substr(2, 9)}`,
      numero: i,
      montoTotal,
      capital,
      interes,
      saldoRestante,
      fechaVencimiento,
      pagado: false,
      fechaPago: null,
    });
  }

  return schedule;
}

// Pre-seeded initial client list
export const PRE_SEEDED_CLIENTS: Client[] = [
  {
    cedula: '12345',
    contrasena: '12345',
    nombre: 'Juan Pérez',
    correo: 'juan.perez@email.com',
    telefono: '3001234567',
    direccion: 'Calle Luna 123, Bogotá',
    prestamo: null, // will be configured below
  },
  {
    cedula: '98765',
    contrasena: '98765',
    nombre: 'María Rodríguez',
    correo: 'maria.rod@email.com',
    telefono: '3159876543',
    direccion: 'Carrera 45 #89, Medellín',
    prestamo: null, // will be configured below
  },
  {
    cedula: '11111',
    contrasena: '11111',
    nombre: 'Carlos Mendoza',
    correo: 'carlos.mendoza@email.com',
    telefono: '3201111111',
    direccion: 'Avenida Siempre Viva 742, Cali',
    prestamo: null, // will be configured below
  },
];

// Initialize pre-seeded loans with history
const initPreseededLoans = () => {
  // 1. Juan Pérez: Préstamo vigente de 10,000, 2.0% mensual, 12 meses, iniciado hace 4 meses (e.g. 2026-03-01)
  const JuanSchedule = generateAmortizationSchedule(10000, 2.0, 12, '2026-03-01');
  // Mark 4 installments as paid
  for (let i = 0; i < 4; i++) {
    JuanSchedule[i].pagado = true;
    JuanSchedule[i].fechaPago = addMonths('2026-03-01', i + 1);
  }
  PRE_SEEDED_CLIENTS[0].prestamo = {
    id: 'loan-juan',
    montoOriginal: 10000,
    tasaInteresMensual: 2.0,
    plazoMeses: 12,
    fechaInicio: '2026-03-01',
    estado: 'vigente',
    cuotas: JuanSchedule,
  };

  // 2. María Rodríguez: Préstamo atrasado de 5000, 3.0% mensual, 6 meses, iniciado hace 4 meses (e.g. 2026-03-01)
  // Since it's now 2026-07-01 (4 months since start), installments 1 and 2 are paid, but 3 and 4 are overdue (pendiente and date passed)
  const MariaSchedule = generateAmortizationSchedule(5000, 3.0, 6, '2026-03-01');
  // Mark 2 installments as paid
  for (let i = 0; i < 2; i++) {
    MariaSchedule[i].pagado = true;
    MariaSchedule[i].fechaPago = addMonths('2026-03-01', i + 1);
  }
  // The rest are unpaid. Maria is in arrears ('atrasado')
  PRE_SEEDED_CLIENTS[1].prestamo = {
    id: 'loan-maria',
    montoOriginal: 5000,
    tasaInteresMensual: 3.0,
    plazoMeses: 6,
    fechaInicio: '2026-03-01',
    estado: 'atrasado',
    cuotas: MariaSchedule,
  };

  // 3. Carlos Mendoza: Préstamo cancelado/apto de 4000, 1.5% mensual, 6 meses, iniciado hace 8 meses (e.g. 2025-10-01)
  const CarlosSchedule = generateAmortizationSchedule(4000, 1.5, 6, '2025-10-01');
  // All paid
  for (let i = 0; i < 6; i++) {
    CarlosSchedule[i].pagado = true;
    CarlosSchedule[i].fechaPago = addMonths('2025-10-01', i + 1);
  }
  PRE_SEEDED_CLIENTS[2].prestamo = {
    id: 'loan-carlos',
    montoOriginal: 4000,
    tasaInteresMensual: 1.5,
    plazoMeses: 6,
    fechaInicio: '2025-10-01',
    estado: 'cancelado',
    cuotas: CarlosSchedule,
  };
};

initPreseededLoans();

const LOCAL_STORAGE_KEY = 'crediulep_db';

export function getDatabase(): Client[] {
  if (typeof window === 'undefined') return PRE_SEEDED_CLIENTS;
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    saveDatabase(PRE_SEEDED_CLIENTS);
    return PRE_SEEDED_CLIENTS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Error parsing localStorage database', e);
    return PRE_SEEDED_CLIENTS;
  }
}

export function saveDatabase(db: Client[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
  }
}

// Format numbers as currency COP/USD (let's use standard $ currency)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
