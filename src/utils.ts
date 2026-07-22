/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Installment, Loan } from './types';

export function parseNumericInput(val: string | number | undefined | null): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let clean = String(val).replace(/[$ \t]/g, '').trim();
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if ((clean.match(/\./g) || []).length > 1) {
    clean = clean.replace(/\./g, '');
  } else if ((clean.match(/,/g) || []).length > 1) {
    clean = clean.replace(/,/g, '');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper to add months to a YYYY-MM-DD date string
export function addMonths(dateStr: string, months: number): string {
  const safeDateStr = dateStr || new Date().toISOString().split('T')[0];
  const [year, month, day] = safeDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year || 2026, (month || 1) - 1 + months, day || 1));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Generate French amortization schedule (Sistema Francés)
export function generateAmortizationSchedule(
  montoInput: number | string,
  tasaMensualPctInput: number | string,
  plazoMesesInput: number | string,
  fechaInicioStr: string
): Installment[] {
  const monto = parseNumericInput(montoInput);
  const tasaMensualPct = parseNumericInput(tasaMensualPctInput);
  const plazoMeses = Math.max(1, Math.round(parseNumericInput(plazoMesesInput)));

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
      montoTotal: isNaN(montoTotal) ? 0 : montoTotal,
      capital: isNaN(capital) ? 0 : capital,
      interes: isNaN(interes) ? 0 : interes,
      saldoRestante: isNaN(saldoRestante) ? 0 : saldoRestante,
      fechaVencimiento,
      pagado: false,
      fechaPago: null,
    });
  }

  return schedule;
}

// Pre-seeded initial client list (Empty by default)
export const PRE_SEEDED_CLIENTS: Client[] = [];

const LOCAL_STORAGE_KEY = 'crediulep_db';

export function getDatabase(): Client[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    saveDatabase([]);
    return [];
  }
  try {
    const clients: Client[] = JSON.parse(data);
    const testCedulas = ['12345', '98765', '11111'];
    const filtered = clients.filter((c) => !testCedulas.includes(c.cedula));
    if (filtered.length !== clients.length) {
      saveDatabase(filtered);
    }
    return filtered;
  } catch (e) {
    console.error('Error parsing localStorage database', e);
    return [];
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
