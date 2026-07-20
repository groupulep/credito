/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Installment {
  id: string;
  numero: number;
  montoTotal: number;
  capital: number;
  interes: number;
  saldoRestante: number;
  fechaVencimiento: string;
  pagado: boolean;
  fechaPago: string | null;
}

export interface Loan {
  id: string;
  montoOriginal: number;
  tasaInteresMensual: number; // en porcentaje (ej: 2)
  plazoMeses: number;
  fechaInicio: string;
  estado: 'vigente' | 'atrasado' | 'cancelado';
  cuotas: Installment[];
}

export interface Client {
  cedula: string;
  contrasena: string;
  nombre: string;
  correo: string;
  telefono: string;
  direccion: string;
  prestamo: Loan | null;
  banco?: string;
  numeroCuenta?: string;
}

export type UserRole = 'admin' | 'client';

export interface UserSession {
  role: UserRole;
  cedula?: string;
  nombre: string;
}
