/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  Users,
  CircleDollarSign,
  HandCoins,
  ShieldAlert,
  Search,
  Filter,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MessageCircle,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  UsersRound,
  X,
  CreditCard,
  Calendar,
  DollarSign,
  Percent,
  Plus,
  Edit,
  KeyRound,
  FileSpreadsheet,
  Mail,
  Send,
  Sparkles,
  Check,
  Square,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Menu
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Client, Loan, Installment } from '../types';
import { generateAmortizationSchedule, formatCurrency, saveDatabase } from '../utils';
import { sendPushNotification } from '../App';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Legend
} from 'recharts';

interface AdminDashboardProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onLogout: () => void;
  syncError?: string | null;
}

export default function AdminDashboard({
  clients,
  setClients,
  onLogout,
  syncError = null,
}: AdminDashboardProps) {
  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const [activeTab, setActiveTab] = useState<'kpis' | 'management' | 'calendar' | 'notifications'>('kpis');

  // Notification panel states
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifTarget, setNotifTarget] = useState<'all' | 'vigente' | 'atrasado' | 'specific'>('all');
  const [notifTargetCedula, setNotifTargetCedula] = useState('');
  const [notifSuccessMessage, setNotifSuccessMessage] = useState('');

  // House Clean / Limpiar Casa states
  const [selectiveWipeSelected, setSelectiveWipeSelected] = useState<string[]>([]);
  const [showWipeConfirmType, setShowWipeConfirmType] = useState<'selective' | 'canceled' | null>(null);
  const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState('');
  const [wipeSearchQuery, setWipeSearchQuery] = useState('');

  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getDaysDifference = (dateStr1: string, dateStr2: string): number => {
    const d1 = new Date(dateStr1 + 'T00:00:00');
    const d2 = new Date(dateStr2 + 'T00:00:00');
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'vigente' | 'atrasado' | 'cancelado'>('todos');

  // New client form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState({
    cedula: '',
    nombre: '',
    correo: '',
    telefono: '',
    direccion: '',
    banco: '',
    numeroCuenta: '',
    montoMaximo: '10000000',
    // Loan terms
    monto: '5000000',
    tasa: '2.0',
    plazo: '12',
    fechaInicio: new Date().toISOString().split('T')[0],
    estadoInicial: 'vigente' as 'vigente' | 'atrasado' | 'cancelado',
  });

  // Client detail modal state (optional, for viewing full schedule)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Editing client state
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editCedula, setEditCedula] = useState('');
  const [editCorreo, setEditCorreo] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editBanco, setEditBanco] = useState('');
  const [editNumeroCuenta, setEditNumeroCuenta] = useState('');
  const [editContrasena, setEditContrasena] = useState('');
  const [editHasLoan, setEditHasLoan] = useState(false);
  const [editMonto, setEditMonto] = useState('');
  const [editTasa, setEditTasa] = useState('');
  const [editPlazo, setEditPlazo] = useState('');
  const [editFechaInicio, setEditFechaInicio] = useState('');
  const [editEstadoLoan, setEditEstadoLoan] = useState<'vigente' | 'atrasado' | 'cancelado'>('vigente');
  const [editMontoMaximo, setEditMontoMaximo] = useState('');
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // --- Calendar states & helper logic ---
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [calendarFilter, setCalendarFilter] = useState<'todos' | 'payment' | 'due'>('todos');

  // Deterministic hour/time formatting based on client/loan details
  const getDeterministicTime = (seed: string, type: 'payment' | 'due') => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    if (type === 'payment') {
      const hour = 8 + (hash % 10); // 8 to 17 (8:00 AM to 5:00 PM)
      const minute = (hash % 12) * 5; // step of 5 minutes
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const padMin = String(minute).padStart(2, '0');
      return `${displayHour}:${padMin} ${ampm}`;
    } else {
      return "11:59 PM";
    }
  };

  // Structured type for event
  interface CalendarEvent {
    id: string;
    type: 'payment' | 'due_paid' | 'due_pending';
    dateStr: string;
    timeStr: string;
    clientCedula: string;
    clientNombre: string;
    monto: number;
    cuotaNumero: number;
  }

  // Extract events
  const allCalendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    clients.forEach((client) => {
      const loan = client.prestamo;
      if (!loan) return;
      
      loan.cuotas.forEach((cuota) => {
        // Due date event (deuda/vencimiento)
        events.push({
          id: `due-${cuota.id}`,
          type: cuota.pagado ? 'due_paid' : 'due_pending',
          dateStr: cuota.fechaVencimiento,
          timeStr: getDeterministicTime(`${client.cedula}-${cuota.numero}-due`, 'due'),
          clientCedula: client.cedula,
          clientNombre: client.nombre,
          monto: cuota.montoTotal,
          cuotaNumero: cuota.numero,
        });

        // Payment event (pago realizado)
        if (cuota.pagado && cuota.fechaPago) {
          events.push({
            id: `pay-${cuota.id}`,
            type: 'payment',
            dateStr: cuota.fechaPago,
            timeStr: getDeterministicTime(`${client.cedula}-${cuota.numero}-pay`, 'payment'),
            clientCedula: client.cedula,
            clientNombre: client.nombre,
            monto: cuota.montoTotal,
            cuotaNumero: cuota.numero,
          });
        }
      });
    });
    return events;
  }, [clients]);

  // Monthly stats for calendar KPI widgets
  const calendarMonthStats = useMemo(() => {
    const currentY = currentDate.getFullYear();
    const currentM = currentDate.getMonth() + 1; // 1-12
    const monthPrefix = `${currentY}-${String(currentM).padStart(2, '0')}`;

    let totalCollected = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    clients.forEach((client) => {
      const loan = client.prestamo;
      if (!loan) return;

      loan.cuotas.forEach((cuota) => {
        // Is payment in this month?
        if (cuota.pagado && cuota.fechaPago && cuota.fechaPago.startsWith(monthPrefix)) {
          totalCollected += cuota.montoTotal;
        }
        // Is due date in this month?
        if (cuota.fechaVencimiento.startsWith(monthPrefix)) {
          if (!cuota.pagado) {
            // Due this month and unpaid
            totalPending += cuota.montoTotal;
            // Check if overdue (fechaVencimiento < today)
            const todayStr = new Date().toISOString().split('T')[0];
            if (cuota.fechaVencimiento < todayStr) {
              totalOverdue += cuota.montoTotal;
            }
          }
        }
      });
    });

    return {
      totalCollected,
      totalPending,
      totalOverdue,
    };
  }, [clients, currentDate]);

  // Selected date events based on state and calendar filter
  const selectedDateEvents = useMemo(() => {
    return allCalendarEvents.filter((ev) => {
      if (ev.dateStr !== selectedDateStr) return false;
      if (calendarFilter === 'payment') {
        return ev.type === 'payment';
      }
      if (calendarFilter === 'due') {
        return ev.type === 'due_pending' || ev.type === 'due_paid';
      }
      return true;
    });
  }, [allCalendarEvents, selectedDateStr, calendarFilter]);

  // Success/Error toast alerts
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const triggerAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // --- KPI Calculations ---
  const kpis = useMemo(() => {
    let totalPortfolio = 0; // Total capital colocada (Vigente + Atrasado)
    let activeClientsCount = 0; // Clientes con vigentes o atrasados
    let totalOutstanding = 0; // Saldo pendiente total
    let totalCollected = 0; // Fondos recaudados (total capital + interes pagado)
    let overdueCount = 0; // Número de atrasados

    clients.forEach((client) => {
      const loan = client.prestamo;
      if (!loan) return;

      // Active loans are 'vigente' and 'atrasado'
      if (loan.estado === 'vigente' || loan.estado === 'atrasado') {
        totalPortfolio += loan.montoOriginal;
        activeClientsCount++;
        
        if (loan.estado === 'atrasado') {
          overdueCount++;
        }
      }

      // Sum cuotas to calculate collected and outstanding funds
      loan.cuotas.forEach((cuota) => {
        if (cuota.pagado) {
          totalCollected += cuota.montoTotal;
        } else {
          totalOutstanding += cuota.montoTotal;
        }
      });
    });

    const delinquencyRate = activeClientsCount > 0 
      ? Math.round((overdueCount / activeClientsCount) * 100) 
      : 0;

    return {
      totalPortfolio,
      activeClientsCount,
      totalOutstanding,
      totalCollected,
      delinquencyRate,
      overdueCount
    };
  }, [clients]);

  // --- Charts Data ---
  const chartData = useMemo(() => {
    const statusCounts = { vigente: 0, atrasado: 0, cancelado: 0, sinPrestamo: 0 };
    clients.forEach((c) => {
      if (c.prestamo) {
        statusCounts[c.prestamo.estado]++;
      } else {
        statusCounts.sinPrestamo++;
      }
    });

    return [
      { name: 'Al Día (Vigente)', value: statusCounts.vigente, color: '#8b5cf6' }, // Violeta/Morado
      { name: 'En Mora (Atrasado)', value: statusCounts.atrasado, color: '#f43f5e' }, // Rosa/Rojo
      { name: 'Cancelado (Paz y Salvo)', value: statusCounts.cancelado, color: '#10b981' }, // Verde
    ];
  }, [clients]);

  const barChartData = useMemo(() => {
    return clients.map(c => {
      let pagado = 0;
      let pendiente = 0;
      if (c.prestamo) {
        c.prestamo.cuotas.forEach(q => {
          if (q.pagado) pagado += q.montoTotal;
          else pendiente += q.montoTotal;
        });
      }
      return {
        nombre: c.nombre.split(' ')[0],
        'Pagado ($)': pagado,
        'Pendiente ($)': pendiente,
      };
    });
  }, [clients]);

  // --- Filtering & Search ---
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.cedula.includes(searchQuery);

      if (!matchesSearch) return false;

      if (statusFilter === 'todos') return true;
      if (statusFilter === 'vigente') return client.prestamo?.estado === 'vigente';
      if (statusFilter === 'atrasado') return client.prestamo?.estado === 'atrasado';
      if (statusFilter === 'cancelado') return client.prestamo?.estado === 'cancelado';
      return true;
    });
  }, [clients, searchQuery, statusFilter]);

  // --- Handlers ---
  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!newClient.cedula.trim() || !newClient.nombre.trim()) {
      triggerAlert('error', 'Cédula y Nombre Completo son requeridos.');
      return;
    }

    if (clients.some((c) => c.cedula === newClient.cedula.trim())) {
      triggerAlert('error', `Ya existe un afiliado con la cédula ${newClient.cedula}.`);
      return;
    }

    const montoVal = parseFloat(newClient.monto);
    const tasaVal = parseFloat(newClient.tasa);
    const plazoVal = parseInt(newClient.plazo);

    if (isNaN(montoVal) || montoVal <= 0 || isNaN(tasaVal) || tasaVal < 0 || isNaN(plazoVal) || plazoVal <= 0) {
      triggerAlert('error', 'Por favor configure montos, tasas y plazos válidos.');
      return;
    }

    const initialSchedule = generateAmortizationSchedule(
      montoVal,
      tasaVal,
      plazoVal,
      newClient.fechaInicio
    );

    const newLoan: Loan = {
      id: `loan-${Math.random().toString(36).substr(2, 9)}`,
      montoOriginal: montoVal,
      tasaInteresMensual: tasaVal,
      plazoMeses: plazoVal,
      fechaInicio: newClient.fechaInicio,
      estado: newClient.estadoInicial,
      cuotas: initialSchedule,
    };

    const addedClient: Client = {
      cedula: newClient.cedula.trim(),
      contrasena: newClient.cedula.trim(), // password defaults to national ID for ease of use
      nombre: newClient.nombre.trim(),
      correo: newClient.correo.trim() || 'sin_correo@email.com',
      telefono: newClient.telefono.trim() || '3000000000',
      direccion: newClient.direccion.trim() || 'No registrada',
      prestamo: newLoan,
      banco: newClient.banco.trim() || 'No especificado',
      numeroCuenta: newClient.numeroCuenta.trim() || 'No registrada',
      montoMaximo: parseFloat(newClient.montoMaximo) || 10000000,
    };

    const updatedClients = [...clients, addedClient];
    setClients(updatedClients);
    saveDatabase(updatedClients);

    // Reset Form
    setNewClient({
      cedula: '',
      nombre: '',
      correo: '',
      telefono: '',
      direccion: '',
      banco: '',
      numeroCuenta: '',
      montoMaximo: '10000000',
      monto: '5000000',
      tasa: '2.0',
      plazo: '12',
      fechaInicio: new Date().toISOString().split('T')[0],
      estadoInicial: 'vigente',
    });
    setShowAddForm(false);
    triggerAlert('success', `Afiliado ${addedClient.nombre} registrado correctamente.`);
  };

  const handleUpdateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const targetCedula = editingClient.cedula;
    const newCedulaVal = editCedula.trim();
    const newNombreVal = editNombre.trim();

    if (!newCedulaVal || !newNombreVal) {
      triggerAlert('error', 'Cédula y Nombre Completo son requeridos.');
      return;
    }

    // Check if cédula was changed, and if the new one is already in use by someone else
    if (newCedulaVal !== targetCedula && clients.some((c) => c.cedula === newCedulaVal)) {
      triggerAlert('error', `Ya existe un afiliado con la cédula ${newCedulaVal}.`);
      return;
    }

    // Build the updated client object
    const updatedClients = clients.map((client) => {
      if (client.cedula !== targetCedula) return client;

      let updatedLoan: Loan | null = client.prestamo;

      if (!editHasLoan) {
        updatedLoan = null;
      } else {
        const montoVal = parseFloat(editMonto);
        const tasaVal = parseFloat(editTasa);
        const plazoVal = parseInt(editPlazo);

        if (isNaN(montoVal) || montoVal <= 0 || isNaN(tasaVal) || tasaVal < 0 || isNaN(plazoVal) || plazoVal <= 0) {
          triggerAlert('error', 'Por favor configure un monto, tasa y plazo válidos.');
          return client;
        }

        // Did we modify the core loan parameters?
        const isLoanParamsChanged = !client.prestamo ||
          client.prestamo.montoOriginal !== montoVal ||
          client.prestamo.tasaInteresMensual !== tasaVal ||
          client.prestamo.plazoMeses !== plazoVal ||
          client.prestamo.fechaInicio !== editFechaInicio;

        if (isLoanParamsChanged) {
          // Re-generate schedule
          const newSchedule = generateAmortizationSchedule(
            montoVal,
            tasaVal,
            plazoVal,
            editFechaInicio
          );
          updatedLoan = {
            id: client.prestamo?.id || `loan-${Math.random().toString(36).substr(2, 9)}`,
            montoOriginal: montoVal,
            tasaInteresMensual: tasaVal,
            plazoMeses: plazoVal,
            fechaInicio: editFechaInicio,
            estado: editEstadoLoan,
            cuotas: newSchedule,
          };
        } else {
          // Just update state status if it was changed
          updatedLoan = {
            ...client.prestamo,
            estado: editEstadoLoan,
          } as Loan;
        }
      }

      return {
        ...client,
        cedula: newCedulaVal,
        nombre: newNombreVal,
        correo: editCorreo.trim() || 'sin_correo@email.com',
        telefono: editTelefono.trim() || '3000000000',
        direccion: editDireccion.trim() || 'No registrada',
        contrasena: editContrasena.trim() || client.contrasena || newCedulaVal,
        prestamo: updatedLoan,
        banco: editBanco.trim(),
        numeroCuenta: editNumeroCuenta.trim(),
        montoMaximo: parseFloat(editMontoMaximo) || 10000000,
      };
    });

    setClients(updatedClients);
    saveDatabase(updatedClients);
    setEditingClient(null);
    triggerAlert('success', `Datos de ${newNombreVal} actualizados correctamente.`);
  };

  // Delete a single user
  const handleDeleteSingleClient = (targetCedula: string) => {
    const target = clients.find((c) => c.cedula === targetCedula);
    const updatedClients = clients.filter((c) => c.cedula !== targetCedula);

    setClients(updatedClients);
    saveDatabase(updatedClients);

    setClientToDelete(null);
    if (editingClient?.cedula === targetCedula) {
      setEditingClient(null);
    }
    if (selectedClient?.cedula === targetCedula) {
      setSelectedClient(null);
    }

    triggerAlert('success', `Usuario ${target?.nombre || targetCedula} eliminado correctamente.`);
  };

  // Simulate installment collection (Registro pagado)
  const handleRegisterPayment = (cedula: string) => {
    const updatedClients = clients.map((client) => {
      if (client.cedula !== cedula || !client.prestamo) return client;

      const loan = { ...client.prestamo };
      const cuotas = [...loan.cuotas];

      // Find the first unpaid installment
      const nextUnpaidIdx = cuotas.findIndex((cuota) => !cuota.pagado);

      if (nextUnpaidIdx === -1) {
        triggerAlert('error', 'Este crédito ya se encuentra totalmente cancelado.');
        return client;
      }

      // Mark as paid
      const updatedCuota = {
        ...cuotas[nextUnpaidIdx],
        pagado: true,
        fechaPago: new Date().toISOString().split('T')[0],
      };
      cuotas[nextUnpaidIdx] = updatedCuota;

      // Check if all paid
      const allPaid = cuotas.every((c) => c.pagado);
      
      // Update state reactively
      let newEstado: 'vigente' | 'atrasado' | 'cancelado' = 'vigente';
      if (allPaid) {
        newEstado = 'cancelado';
      } else {
        // If there's any pending overdue, keep atrasado, otherwise set to vigente
        const todayStr = new Date().toISOString().split('T')[0];
        const hasOverdue = cuotas.some((c) => !c.pagado && c.fechaVencimiento < todayStr);
        newEstado = hasOverdue ? 'atrasado' : 'vigente';
      }

      loan.cuotas = cuotas;
      loan.estado = newEstado;

      return {
        ...client,
        prestamo: loan,
      };
    });

    setClients(updatedClients);
    saveDatabase(updatedClients);
    
    // Update active modal client if open
    if (selectedClient && selectedClient.cedula === cedula) {
      const updatedSelected = updatedClients.find(c => c.cedula === cedula);
      if (updatedSelected) setSelectedClient(updatedSelected);
    }

    triggerAlert('success', 'Pago de cuota registrado exitosamente.');
  };

  const handleSendAdminMessage = (cedula: string, texto: string) => {
    const updatedClients = clients.map((client) => {
      if (client.cedula !== cedula) return client;
      
      const currentMsgs = client.mensajes || [];
      const newMsg = {
        id: Math.random().toString(36).substring(2, 9),
        remitente: 'admin' as const,
        texto: texto.trim(),
        fecha: new Date().toISOString()
      };
      
      return {
        ...client,
        mensajes: [...currentMsgs, newMsg]
      };
    });
    
    setClients(updatedClients);
    saveDatabase(updatedClients);
    
    // Update active modal client if open
    if (selectedClient && selectedClient.cedula === cedula) {
      const updatedSelected = updatedClients.find(c => c.cedula === cedula);
      if (updatedSelected) setSelectedClient(updatedSelected);
    }
  };

  // Export database to Excel file
  const handleExportToExcel = () => {
    try {
      // 1. Prepare Sheet 1: Clientes y Créditos
      const clientRows = clients.map((client) => {
        const p = client.prestamo;
        const totalCuotas = p ? p.cuotas.length : 0;
        const cuotasPagadas = p ? p.cuotas.filter((c) => c.pagado).length : 0;
        const cuotasPendientes = p ? p.cuotas.filter((c) => !c.pagado).length : 0;

        const capitalPagado = p
          ? p.cuotas.filter((c) => c.pagado).reduce((sum, c) => sum + c.capital, 0)
          : 0;
        const interesPagado = p
          ? p.cuotas.filter((c) => c.pagado).reduce((sum, c) => sum + c.interes, 0)
          : 0;
        const totalPagado = p
          ? p.cuotas.filter((c) => c.pagado).reduce((sum, c) => sum + c.montoTotal, 0)
          : 0;

        const capitalPendiente = p
          ? p.cuotas.filter((c) => !c.pagado).reduce((sum, c) => sum + c.capital, 0)
          : 0;
        const interesPendiente = p
          ? p.cuotas.filter((c) => !c.pagado).reduce((sum, c) => sum + c.interes, 0)
          : 0;
        const totalPendiente = p
          ? p.cuotas.filter((c) => !c.pagado).reduce((sum, c) => sum + c.montoTotal, 0)
          : 0;

        return {
          'Cédula de Ciudadanía': client.cedula,
          'Nombre Completo': client.nombre,
          'Correo Electrónico': client.correo,
          'Teléfono / WhatsApp': client.telefono,
          'Dirección': client.direccion,
          'Contraseña de Acceso': client.contrasena || client.cedula,
          'Banco / Entidad': client.banco || '',
          'Número de Cuenta': client.numeroCuenta || '',
          'Tiene Crédito Activo': p ? 'SÍ' : 'NO',
          'ID Crédito': p ? p.id : 'N/A',
          'Monto Préstamo': p ? p.montoOriginal : 0,
          'Tasa Interés Mensual (%)': p ? p.tasaInteresMensual : 0,
          'Plazo (Meses)': p ? p.plazoMeses : 0,
          'Fecha de Inicio': p ? p.fechaInicio : 'N/A',
          'Estado Crédito': p
            ? p.estado === 'vigente'
              ? 'Vigente (Al día)'
              : p.estado === 'atrasado'
              ? 'Atrasado (Mora)'
              : 'Cancelado'
            : 'N/A',
          'Cuotas Totales': totalCuotas,
          'Cuotas Pagadas': cuotasPagadas,
          'Cuotas Pendientes': cuotasPendientes,
          'Capital Pagado': capitalPagado,
          'Interés Pagado': interesPagado,
          'Total Pagado': totalPagado,
          'Capital Pendiente': capitalPendiente,
          'Interés Pendiente': interesPendiente,
          'Total Pendiente': totalPendiente,
        };
      });

      // 2. Prepare Sheet 2: Detalle de Cuotas (Historial Completo)
      const installmentRows: any[] = [];
      clients.forEach((client) => {
        const p = client.prestamo;
        if (p) {
          p.cuotas.forEach((cuota) => {
            installmentRows.push({
              'Cédula Afiliado': client.cedula,
              'Nombre Afiliado': client.nombre,
              'ID Crédito': p.id,
              'Número de Cuota': cuota.numero,
              'Monto de Cuota': cuota.montoTotal,
              'Abono a Capital': cuota.capital,
              'Interés de Cuota': cuota.interes,
              'Saldo Restante': cuota.saldoRestante,
              'Fecha de Vencimiento': cuota.fechaVencimiento,
              'Estado de Pago': cuota.pagado ? 'Pagada' : 'Pendiente',
              'Fecha de Pago': cuota.fechaPago || 'N/A',
              'ID Cuota': cuota.id,
            });
          });
        }
      });

      // 3. Prepare Sheet 3: Mensajes de Soporte
      const messageRows: any[] = [];
      clients.forEach((client) => {
        if (client.mensajes && client.mensajes.length > 0) {
          client.mensajes.forEach((msg) => {
            messageRows.push({
              'Cédula Afiliado': client.cedula,
              'Nombre Afiliado': client.nombre,
              'ID Mensaje': msg.id,
              'Remitente': msg.remitente === 'admin' ? 'Administrador (admin)' : 'Socio (cliente)',
              'Texto': msg.texto,
              'Fecha': msg.fecha,
            });
          });
        }
      });

      // 4. Create Workbook and Sheets
      const wb = XLSX.utils.book_new();

      const wsClients = XLSX.utils.json_to_sheet(clientRows);
      const wsInstallments = XLSX.utils.json_to_sheet(installmentRows);
      const wsMessages = XLSX.utils.json_to_sheet(messageRows);

      // Add Auto-fit columns helper
      const autofitColumns = (ws: any, data: any[]) => {
        if (data.length === 0) return;
        const keys = Object.keys(data[0]);
        ws['!cols'] = keys.map((key) => {
          let maxLen = key.toString().length;
          data.forEach((row) => {
            const val = row[key];
            if (val !== null && val !== undefined) {
              const valStr = val.toString();
              if (valStr.length > maxLen) maxLen = valStr.length;
            }
          });
          return { wch: Math.min(maxLen + 3, 40) }; // Padding + cap
        });
      };

      autofitColumns(wsClients, clientRows);
      autofitColumns(wsInstallments, installmentRows);
      autofitColumns(wsMessages, messageRows);

      XLSX.utils.book_append_sheet(wb, wsClients, 'Afiliados y Créditos');
      XLSX.utils.book_append_sheet(wb, wsInstallments, 'Detalle de Cuotas');
      XLSX.utils.book_append_sheet(wb, wsMessages, 'Mensajes de Soporte');

      // 5. Trigger file download
      XLSX.writeFile(wb, `Reporte_Cartera_CrediULEP_${new Date().toISOString().split('T')[0]}.xlsx`);
      triggerAlert('success', 'Archivo Excel generado y descargado exitosamente.');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Ocurrió un error al generar el archivo Excel.');
    }
  };

  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      triggerAlert('error', 'Por favor ingresa un título y el cuerpo del mensaje.');
      return;
    }

    if (notifTarget === 'specific' && !notifTargetCedula) {
      triggerAlert('error', 'Por favor selecciona un socio destinatario.');
      return;
    }

    // Determine target clients
    let targetClients: Client[] = [];
    if (notifTarget === 'all') {
      targetClients = clients;
    } else if (notifTarget === 'vigente') {
      targetClients = clients.filter(c => c.prestamo?.estado === 'vigente');
    } else if (notifTarget === 'atrasado') {
      targetClients = clients.filter(c => c.prestamo?.estado === 'atrasado');
    } else if (notifTarget === 'specific') {
      const found = clients.find(c => c.cedula === notifTargetCedula);
      if (found) targetClients = [found];
    }

    if (targetClients.length === 0) {
      triggerAlert('error', 'No se encontraron socios que cumplan con la condición seleccionada.');
      return;
    }

    // Create notification item
    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      titulo: notifTitle.trim(),
      mensaje: notifBody.trim(),
      fecha: new Date().toISOString(),
      leido: false
    };

    // Update clients state
    const updatedClients = clients.map(client => {
      const isTarget = targetClients.some(tc => tc.cedula === client.cedula);
      if (isTarget) {
        const existingNotifs = client.notificaciones || [];
        return {
          ...client,
          notificaciones: [newNotif, ...existingNotifs]
        };
      }
      return client;
    });

    setClients(updatedClients);
    saveDatabase(updatedClients);

    // Trigger local push notification for immediate visual alert
    sendPushNotification(
      `Alerta de CrediULEP: ${notifTitle.trim()}`,
      `Enviado a ${targetClients.length} socio(s)`
    );

    triggerAlert(
      'success',
      `¡Notificación enviada exitosamente a ${targetClients.length} socio(s)!`
    );

    // Clear state
    setNotifTitle('');
    setNotifBody('');
    setNotifSuccessMessage(`Última enviada: "${notifTitle}" a ${targetClients.length} socio(s) el ${new Date().toLocaleTimeString()}`);
    setTimeout(() => setNotifSuccessMessage(''), 8000);
  };

  const handleDeleteNotification = (notifId: string) => {
    const updatedClients = clients.map(client => {
      if (client.notificaciones) {
        return {
          ...client,
          notificaciones: client.notificaciones.filter(n => n.id !== notifId)
        };
      }
      return client;
    });
    setClients(updatedClients);
    saveDatabase(updatedClients);
    triggerAlert('success', 'Notificación eliminada de los registros.');
  };

  // Import database from Excel file (supports updating existing records and skipping duplicates)
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'binary' });

        // 1. Parse Clientes/Afiliados
        const firstSheetName = workbook.SheetNames[0];
        const wsClients = workbook.Sheets['Afiliados y Créditos'] || workbook.Sheets[firstSheetName];
        if (!wsClients) {
          triggerAlert('error', 'No se encontró la hoja de Afiliados y Créditos en el archivo.');
          return;
        }
        const clientRows = XLSX.utils.sheet_to_json<any>(wsClients);

        // 2. Parse Cuotas
        const wsInstallments = workbook.Sheets['Detalle de Cuotas'] || workbook.Sheets[workbook.SheetNames[1]];
        const installmentRows = wsInstallments ? XLSX.utils.sheet_to_json<any>(wsInstallments) : [];

        // 3. Parse Mensajes
        const wsMessages = workbook.Sheets['Mensajes de Soporte'] || workbook.Sheets[workbook.SheetNames[2]];
        const messageRows = wsMessages ? XLSX.utils.sheet_to_json<any>(wsMessages) : [];

        // Rebuild clients map
        const importedClientsMap = new Map<string, Client>();

        clientRows.forEach((row: any) => {
          const cedula = String(row['Cédula de Ciudadanía'] || row['Cédula'] || row['cedula'] || '').trim();
          if (!cedula) return;

          const nombre = String(row['Nombre Completo'] || row['Nombre'] || row['nombre'] || '').trim();
          const correo = String(row['Correo Electrónico'] || row['Correo'] || row['correo'] || '').trim();
          const telefono = String(row['Teléfono / WhatsApp'] || row['Teléfono'] || row['telefono'] || '').trim();
          const direccion = String(row['Dirección'] || row['direccion'] || '').trim();
          const contrasena = String(row['Contraseña de Acceso'] || row['Contraseña'] || row['contrasena'] || cedula).trim();
          const banco = String(row['Banco / Entidad'] || row['banco'] || '').trim();
          const numeroCuenta = String(row['Número de Cuenta'] || row['N° de Cuenta'] || row['numeroCuenta'] || '').trim();

          const tienePrestamo = String(row['Tiene Crédito Activo'] || row['Tiene Préstamo'] || '').toUpperCase() === 'SÍ' ||
                                String(row['Tiene Crédito Activo'] || row['Tiene Préstamo'] || '').toUpperCase() === 'SI' ||
                                !!row['ID Crédito'] || !!row['Monto Préstamo'];

          let prestamo: Loan | null = null;
          if (tienePrestamo) {
            const idCredito = String(row['ID Crédito'] || row['idCredito'] || `loan-${cedula}-${Date.now()}`).trim();
            const montoOriginal = Number(row['Monto Préstamo'] || row['Monto'] || row['montoOriginal'] || 0);
            const tasaInteresMensual = Number(row['Tasa Interés Mensual (%)'] || row['Tasa Interés Mensual'] || row['tasaInteresMensual'] || 0);
            const plazoMeses = Number(row['Plazo (Meses)'] || row['Plazo'] || row['plazoMeses'] || 0);
            const fechaInicio = String(row['Fecha de Inicio'] || row['fechaInicio'] || new Date().toISOString().split('T')[0]).trim();
            
            let estado: 'vigente' | 'atrasado' | 'cancelado' = 'vigente';
            const rowEstado = String(row['Estado Crédito'] || row['Estado'] || row['estado'] || '').toLowerCase();
            if (rowEstado.includes('atrasado') || rowEstado.includes('mora') || rowEstado.includes('demorado')) {
              estado = 'atrasado';
            } else if (rowEstado.includes('cancelado') || rowEstado.includes('pagado')) {
              estado = 'cancelado';
            }

            prestamo = {
               id: idCredito,
               montoOriginal,
               tasaInteresMensual,
               plazoMeses,
               fechaInicio,
               estado,
               cuotas: []
            };
          }

          importedClientsMap.set(cedula, {
            cedula,
            contrasena,
            nombre,
            correo,
            telefono,
            direccion,
            prestamo,
            banco: banco || undefined,
            numeroCuenta: numeroCuenta || undefined,
            mensajes: []
          });
        });

        // Associate cuotas/installments
        installmentRows.forEach((row: any) => {
          const cedula = String(row['Cédula Afiliado'] || row['Cédula de Ciudadanía'] || row['Cédula'] || row['cedula'] || '').trim();
          if (!cedula) return;

          const client = importedClientsMap.get(cedula);
          if (client && client.prestamo) {
            const numero = Number(row['Número de Cuota'] || row['Cuota'] || row['numero'] || 0);
            const montoTotal = Number(row['Monto de Cuota'] || row['Monto'] || row['montoTotal'] || 0);
            const capital = Number(row['Abono a Capital'] || row['Capital'] || row['capital'] || 0);
            const interes = Number(row['Interés de Cuota'] || row['Interés'] || row['interes'] || 0);
            const saldoRestante = Number(row['Saldo Restante'] || row['saldoRestante'] || 0);
            const fechaVencimiento = String(row['Fecha de Vencimiento'] || row['fechaVencimiento'] || '').trim();
            const pagadoStr = String(row['Estado de Pago'] || row['pagado'] || '').toLowerCase();
            const pagado = pagadoStr.includes('pagada') || pagadoStr.includes('sí') || pagadoStr.includes('si') || pagadoStr === 'true' || pagadoStr === '1';
            const fechaPagoRaw = row['Fecha de Pago'] || row['fechaPago'];
            const fechaPago = (fechaPagoRaw && fechaPagoRaw !== 'N/A') ? String(fechaPagoRaw).trim() : null;

            const idCuota = String(row['ID Cuota'] || row['id'] || `${cedula}-cuota-${numero}`);

            const installment: Installment = {
              id: idCuota,
              numero,
              montoTotal,
              capital,
              interes,
              saldoRestante,
              fechaVencimiento,
              pagado,
              fechaPago
            };

            const existingCuotaIdx = client.prestamo.cuotas.findIndex(c => c.numero === numero);
            if (existingCuotaIdx > -1) {
              client.prestamo.cuotas[existingCuotaIdx] = installment;
            } else {
              client.prestamo.cuotas.push(installment);
            }
          }
        });

        // Associate messages
        messageRows.forEach((row: any) => {
          const cedula = String(row['Cédula Afiliado'] || row['Cédula'] || row['cedula'] || '').trim();
          if (!cedula) return;

          const client = importedClientsMap.get(cedula);
          if (client) {
            const senderRaw = String(row['Remitente'] || row['remitente'] || '').toLowerCase();
            const remitente: 'admin' | 'cliente' = (senderRaw.includes('admin') || senderRaw.includes('administrador')) ? 'admin' : 'cliente';
            const texto = String(row['Texto'] || row['texto'] || row['Mensaje'] || '').trim();
            const fecha = String(row['Fecha'] || row['fecha'] || new Date().toISOString()).trim();
            const id = String(row['ID Mensaje'] || row['id'] || Math.random().toString(36).substring(2, 9));

            if (texto) {
              if (!client.mensajes) client.mensajes = [];
              client.mensajes.push({
                id,
                remitente,
                texto,
                fecha
              });
            }
          }
        });

        // Sort installments and messages by date/number
        importedClientsMap.forEach((client) => {
          if (client.prestamo && client.prestamo.cuotas.length > 0) {
            client.prestamo.cuotas.sort((a, b) => a.numero - b.numero);
          }
          if (client.mensajes && client.mensajes.length > 0) {
            client.mensajes.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
          }
        });

        // Merge with existing clients
        const currentClients = [...clients];
        let addedCount = 0;
        let updatedCount = 0;

        importedClientsMap.forEach((importedClient, cedula) => {
          const existingIndex = currentClients.findIndex(c => c.cedula === cedula);
          if (existingIndex > -1) {
            const existing = currentClients[existingIndex];
            
            let updatedPrestamo = null;
            if (importedClient.prestamo) {
              // Merge installments if necessary
              const mergedCuotas = [...(existing.prestamo?.cuotas || [])];
              importedClient.prestamo.cuotas.forEach(newCuota => {
                const idx = mergedCuotas.findIndex(c => c.numero === newCuota.numero);
                if (idx > -1) {
                  mergedCuotas[idx] = newCuota;
                } else {
                  mergedCuotas.push(newCuota);
                }
              });
              
              updatedPrestamo = {
                ...importedClient.prestamo,
                cuotas: mergedCuotas.sort((a, b) => a.numero - b.numero)
              };
            } else if (existing.prestamo) {
              updatedPrestamo = existing.prestamo;
            }

            const mergedMessages = [...(existing.mensajes || [])];
            (importedClient.mensajes || []).forEach(newMsg => {
              const exists = mergedMessages.some(m => m.id === newMsg.id || (m.texto === newMsg.texto && m.fecha === newMsg.fecha));
              if (!exists) {
                mergedMessages.push(newMsg);
              }
            });

            currentClients[existingIndex] = {
              ...existing,
              nombre: importedClient.nombre || existing.nombre,
              correo: importedClient.correo || existing.correo,
              telefono: importedClient.telefono || existing.telefono,
              direccion: importedClient.direccion || existing.direccion,
              contrasena: importedClient.contrasena || existing.contrasena,
              banco: importedClient.banco || existing.banco,
              numeroCuenta: importedClient.numeroCuenta || existing.numeroCuenta,
              prestamo: updatedPrestamo,
              mensajes: mergedMessages.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
            };
            updatedCount++;
          } else {
            currentClients.push(importedClient);
            addedCount++;
          }
        });

        setClients(currentClients);
        saveDatabase(currentClients);
        triggerAlert('success', `Importación completa: ${addedCount} nuevos afiliados creados, ${updatedCount} afiliados existentes actualizados.`);
      } catch (err) {
        console.error(err);
        triggerAlert('error', 'Error al procesar el archivo Excel. Asegúrate de usar un formato válido.');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const downloadExcelForWipedClients = (wiped: Client[], reason: string) => {
    try {
      const clientRows = wiped.map((client) => {
        const p = client.prestamo;
        const totalCuotas = p ? p.cuotas.length : 0;
        const cuotasPagadas = p ? p.cuotas.filter((c) => c.pagado).length : 0;
        const cuotasPendientes = p ? p.cuotas.filter((c) => !c.pagado).length : 0;

        const capitalPagado = p
          ? p.cuotas.filter((c) => c.pagado).reduce((sum, c) => sum + c.capital, 0)
          : 0;
        const interesPagado = p
          ? p.cuotas.filter((c) => c.pagado).reduce((sum, c) => sum + c.interes, 0)
          : 0;
        const totalPagado = p
          ? p.cuotas.filter((c) => c.pagado).reduce((sum, c) => sum + c.montoTotal, 0)
          : 0;

        const capitalPendiente = p
          ? p.cuotas.filter((c) => !c.pagado).reduce((sum, c) => sum + c.capital, 0)
          : 0;
        const interesPendiente = p
          ? p.cuotas.filter((c) => !c.pagado).reduce((sum, c) => sum + c.interes, 0)
          : 0;
        const totalPendiente = p
          ? p.cuotas.filter((c) => !c.pagado).reduce((sum, c) => sum + c.montoTotal, 0)
          : 0;

        return {
          'Cédula de Ciudadanía': client.cedula,
          'Nombre Completo': client.nombre,
          'Correo Electrónico': client.correo,
          'Teléfono / WhatsApp': client.telefono,
          'Dirección': client.direccion,
          'Tiene Crédito Activo': p ? 'SÍ' : 'NO',
          'Estado Crédito': p
            ? p.estado === 'vigente'
              ? 'Vigente (Al día)'
              : p.estado === 'atrasado'
              ? 'Atrasado (Mora)'
              : 'Cancelado'
            : 'N/A',
          'Cuotas Totales': totalCuotas,
          'Cuotas Pagadas': cuotasPagadas,
          'Cuotas Pendientes': cuotasPendientes,
          'Capital Pagado': capitalPagado,
          'Interés Pagado': interesPagado,
          'Total Pagado': totalPagado,
          'Capital Pendiente': capitalPendiente,
          'Interés Pendiente': interesPendiente,
          'Total Pendiente': totalPendiente,
        };
      });

      const installmentRows: any[] = [];
      wiped.forEach((client) => {
        const p = client.prestamo;
        if (p) {
          p.cuotas.forEach((cuota) => {
            installmentRows.push({
              'Cédula Afiliado': client.cedula,
              'Nombre Afiliado': client.nombre,
              'ID Crédito': p.id,
              'Número de Cuota': cuota.numero,
              'Monto de Cuota': cuota.montoTotal,
              'Abono a Capital': cuota.capital,
              'Interés de Cuota': cuota.interes,
              'Saldo Restante': cuota.saldoRestante,
              'Fecha de Vencimiento': cuota.fechaVencimiento,
              'Estado de Pago': cuota.pagado ? 'Pagada' : 'Pendiente',
              'Fecha de Pago': cuota.fechaPago || 'N/A',
            });
          });
        }
      });

      const wb = XLSX.utils.book_new();
      const wsClients = XLSX.utils.json_to_sheet(clientRows);
      const wsInstallments = XLSX.utils.json_to_sheet(installmentRows);

      const autofitColumns = (ws: any, data: any[]) => {
        if (data.length === 0) return;
        const keys = Object.keys(data[0]);
        ws['!cols'] = keys.map((key) => {
          let maxLen = key.toString().length;
          data.forEach((row) => {
            const val = row[key];
            if (val !== null && val !== undefined) {
              const valStr = val.toString();
              if (valStr.length > maxLen) maxLen = valStr.length;
            }
          });
          return { wch: Math.min(maxLen + 3, 40) };
        });
      };

      autofitColumns(wsClients, clientRows);
      autofitColumns(wsInstallments, installmentRows);

      XLSX.utils.book_append_sheet(wb, wsClients, 'Afiliados Eliminados');
      if (installmentRows.length > 0) {
        XLSX.utils.book_append_sheet(wb, wsInstallments, 'Detalle de Cuotas');
      }

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Respaldo_Limpieza_${reason}_${dateStr}.xlsx`);
    } catch (err) {
      console.error('Error generating backup excel for deleted clients:', err);
      triggerAlert('error', 'No se pudo generar el archivo Excel de respaldo.');
    }
  };

  const handlePerformWipe = () => {
    if (wipeConfirmPhrase.trim().toUpperCase() !== 'CONFIRMAR') {
      triggerAlert('error', 'Por favor escribe la palabra CONFIRMAR exactamente para continuar.');
      return;
    }

    let clientsToWipe: Client[] = [];
    let updatedClients: Client[] = [];

    if (showWipeConfirmType === 'all') {
      clientsToWipe = [...clients];
      updatedClients = [];
    } else if (showWipeConfirmType === 'canceled') {
      clientsToWipe = clients.filter(c => c.prestamo && c.prestamo.estado === 'cancelado');
      updatedClients = clients.filter(c => !c.prestamo || c.prestamo.estado !== 'cancelado');
    } else if (showWipeConfirmType === 'selective') {
      clientsToWipe = clients.filter(c => selectiveWipeSelected.includes(c.cedula));
      updatedClients = clients.filter(c => !selectiveWipeSelected.includes(c.cedula));
    }

    if (clientsToWipe.length === 0) {
      triggerAlert('error', 'No hay afiliados elegibles para eliminar.');
      setShowWipeConfirmType(null);
      setWipeConfirmPhrase('');
      return;
    }

    // 1. Download Backup Excel!
    downloadExcelForWipedClients(clientsToWipe, showWipeConfirmType === 'all' ? 'TOTAL' : showWipeConfirmType === 'canceled' ? 'LIQUIDADOS' : 'SELECTIVOS');

    // 2. Perform deletion!
    setClients(updatedClients);
    saveDatabase(updatedClients);

    // 3. Reset states
    if (showWipeConfirmType === 'selective') {
      setSelectiveWipeSelected([]);
    }
    setShowWipeConfirmType(null);
    setWipeConfirmPhrase('');

    triggerAlert('success', `Limpieza exitosa: se eliminaron ${clientsToWipe.length} afiliados y se descargó el respaldo Excel.`);
  };

  // WhatsApp template generator
  const getWhatsAppLink = (client: Client) => {
    if (!client.prestamo) return '#';

    const nombre = client.nombre;
    const telefono = client.telefono;
    const estado = client.prestamo.estado;
    const totalPendiente = client.prestamo.cuotas
      .filter((c) => !c.pagado)
      .reduce((sum, c) => sum + c.montoTotal, 0);

    const proximaCuota = client.prestamo.cuotas.find((c) => !c.pagado);
    const montoCuotaStr = proximaCuota ? formatCurrency(proximaCuota.montoTotal) : '$0';
    const fechaVenceStr = proximaCuota ? proximaCuota.fechaVencimiento : '';

    let text = '';
    if (estado === 'atrasado') {
      text = `Hola ${nombre}, te saludamos de CrediULEP. Queremos recordarte que presentas una cuota vencida por un valor de ${montoCuotaStr}. Tu saldo total pendiente es de ${formatCurrency(totalPendiente)}. Agradecemos tu pronto pago para evitar recargos. Reporta tu comprobante aquí.`;
    } else if (estado === 'vigente') {
      text = `Hola ${nombre}, gracias por ser parte de CrediULEP. Tu crédito se encuentra al día. Tu próximo vencimiento es el ${fechaVenceStr} por un valor de ${montoCuotaStr}. ¡Gracias por tu puntualidad!`;
    } else {
      text = `Hola ${nombre}, ¡felicitaciones! Tu crédito en CrediULEP ha sido totalmente cancelado y te encuentras a Paz y Salvo. Estás apto para solicitar una nueva línea de financiamiento social. Consúltanos para más información.`;
    }

    return `https://api.whatsapp.com/send?phone=${telefono.replace(/\s+/g, '')}&text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-purple-50/20 flex font-sans text-slate-900 select-none relative" id="admin-root">
      {/* Sidebar Backdrop overlay on mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Menu */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 lg:w-20'
        } bg-white text-slate-800 transition-all duration-300 flex flex-col justify-between shrink-0 fixed lg:relative inset-y-0 left-0 z-50 lg:z-20 border-r border-purple-100/60 overflow-hidden shadow-lg`}
        id="admin-sidebar"
      >
        {/* Atmospheric Orbs behind Sidebar */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-20 -right-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col flex-1">
          {/* Sidebar Header */}
          <div className="p-6 flex items-center justify-between border-b border-purple-100/50">
            {sidebarOpen ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
                  <span className="text-white font-black text-xl">C</span>
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-purple-950 tracking-tight leading-tight">CrediULEP</h1>
                  <span className="px-2 py-0.5 bg-purple-100 border border-purple-200 text-purple-700 text-[9px] font-bold tracking-widest rounded uppercase block mt-1 w-max">
                    ADMINISTRACIÓN
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 font-black text-white text-xl mx-auto">
                C
              </div>
            )}

            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-400 hover:text-purple-700 transition-colors cursor-pointer"
                title="Contraer menú"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle Expand when closed */}
          {!sidebarOpen && (
            <div className="py-4 flex justify-center border-b border-purple-100/50">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 bg-purple-50 hover:bg-purple-100 rounded-xl text-purple-500 hover:text-purple-700 transition-all cursor-pointer"
                title="Expandir menú"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-2.5">
            <button
              onClick={() => setActiveTab('kpis')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                activeTab === 'kpis'
                  ? 'bg-purple-50 text-purple-700 border border-purple-100 shadow-sm'
                  : 'text-slate-500 hover:text-purple-700 hover:bg-purple-50/50 border border-transparent'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 shrink-0 ${activeTab === 'kpis' ? 'text-purple-600' : 'text-slate-400'}`} />
              {sidebarOpen && <span className="tracking-tight">Dashboard General</span>}
            </button>

            <button
              onClick={() => setActiveTab('management')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                activeTab === 'management'
                  ? 'bg-purple-50 text-purple-700 border border-purple-100 shadow-sm'
                  : 'text-slate-500 hover:text-purple-700 hover:bg-purple-50/50 border border-transparent'
              }`}
            >
              <UsersRound className={`w-5 h-5 shrink-0 ${activeTab === 'management' ? 'text-purple-600' : 'text-slate-400'}`} />
              {sidebarOpen && <span className="tracking-tight">Gestión de Cartera</span>}
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-purple-50 text-purple-700 border border-purple-100 shadow-sm'
                  : 'text-slate-500 hover:text-purple-700 hover:bg-purple-50/50 border border-transparent'
              }`}
            >
              <Calendar className={`w-5 h-5 shrink-0 ${activeTab === 'calendar' ? 'text-purple-600' : 'text-slate-400'}`} />
              {sidebarOpen && <span className="tracking-tight">Calendario de Pagos</span>}
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-purple-50 text-purple-700 border border-purple-100 shadow-sm'
                  : 'text-slate-500 hover:text-purple-700 hover:bg-purple-50/50 border border-transparent'
              }`}
            >
              <Bell className={`w-5 h-5 shrink-0 ${activeTab === 'notifications' ? 'text-purple-600' : 'text-slate-400'}`} />
              {sidebarOpen && <span className="tracking-tight">Notificaciones</span>}
            </button>
          </nav>

          {/* Floating Mascot Identity */}
          <div className="p-4 mt-auto">
            {sidebarOpen ? (
              <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 text-center">
                <div className="w-14 h-14 bg-purple-100 rounded-full mx-auto mb-3 flex items-center justify-center border border-purple-200">
                  <span className="text-2xl">🐷</span>
                </div>
                <p className="text-[10px] text-purple-600 leading-relaxed font-semibold">
                  "El ahorro es la base de tu tranquilidad financiera."
                </p>
              </div>
            ) : (
              <div 
                className="w-10 h-10 bg-purple-50 border border-purple-100 rounded-full mx-auto flex items-center justify-center text-xl cursor-help"
                title='"El ahorro es la base de tu tranquilidad financiera."'
              >
                🐷
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-purple-100/50 relative z-10">
          <div className="flex items-center justify-between gap-2">
            {sidebarOpen ? (
              <div className="text-left">
                <span className="block text-xs font-bold text-purple-950">Administrador</span>
                <span className="block text-[10px] text-purple-600 font-extrabold uppercase tracking-widest mt-0.5">
                  CrediULEP Cartera
                </span>
              </div>
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mx-auto" />
            )}
            <button
              onClick={onLogout}
              className="p-2.5 bg-purple-50 hover:bg-red-50 text-purple-600 hover:text-red-600 rounded-xl transition-all cursor-pointer shadow-sm border border-purple-100 hover:border-red-100"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 relative" id="admin-main">
        {/* Custom Toast Alert */}
        <AnimatePresence>
          {alert && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border ${
                alert.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-500/10'
                  : 'bg-red-50 border-red-200 text-red-800 shadow-red-500/10'
              }`}
              id="admin-alert"
            >
              {alert.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span className="text-sm font-semibold">{alert.message}</span>
              <button onClick={() => setAlert(null)} className="text-slate-400 hover:text-slate-600 ml-1">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync Error Alert Banner */}
        {syncError && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-lg shadow-amber-500/5" id="sync-error-banner">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900 uppercase tracking-wide">
                ⚠️ Conexión de Base de Datos offline
              </p>
              <p className="text-xs text-amber-700 font-medium mt-0.5 leading-relaxed">
                Las modificaciones que realices se guardarán de forma local, pero no se sincronizarán en la nube de forma inmediata hasta que se restablezca tu conexión.
              </p>
            </div>
          </div>
        )}

        {/* Dashboard Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8" id="admin-header">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 rounded-xl cursor-pointer mr-1"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'kpis'
                ? 'Indicadores de Cartera'
                : activeTab === 'management'
                ? 'Gestión de Cartera'
                : activeTab === 'calendar'
                ? 'Calendario de Pagos y Deudas'
                : 'Notificaciones Masivas y Personalizadas'}
            </h2>
            <div className="flex items-center pl-1 shrink-0" id="db-connection-status-wrapper">
              <span className="relative flex h-2.5 w-2.5" title={syncError ? 'Base de datos offline' : 'Base de datos conectada'}>
                {syncError ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"></span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Consola Administrativa</p>
              <p className="text-xs font-bold text-slate-600">CrediULEP v1.0</p>
            </div>
            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />
            <button
              onClick={handleExportToExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl shadow-md shadow-emerald-600/10 transition-all flex items-center gap-2 text-xs cursor-pointer"
              title="Descargar base de datos en archivo Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar Excel</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter('todos');
                setSearchQuery('');
                setActiveTab('management');
                setShowAddForm(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl shadow-md shadow-purple-600/10 transition-all flex items-center gap-2 text-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Nuevo Crédito</span>
            </button>
          </div>
        </header>

        {/* -------------------- SECTION A: Vista de Indicadores -------------------- */}
        {activeTab === 'kpis' && (
          <div className="space-y-8" id="kpis-section">
            {/* Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* KPI 1: Total Cartera Colocada */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-purple-50/40 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Cartera Colocada</p>
                  <h3 className="text-2xl font-black text-purple-600 tracking-tighter mt-2">
                    {formatCurrency(kpis.totalPortfolio)}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold mt-4 pt-3 border-t border-slate-50">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Suma capital créditos activos</span>
                </div>
              </div>

              {/* KPI 2: Clientes Activos */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-50/40 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Afiliados Activos</p>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter mt-2">
                    {kpis.activeClientsCount} <span className="text-xs font-medium text-slate-400">socios</span>
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-4 pt-3 border-t border-slate-50">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>En estado Vigente/Atrasado</span>
                </div>
              </div>

              {/* KPI 3: Saldo Pendiente de Cobro */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-50/40 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Saldo por Cobrar</p>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter mt-2 font-mono">
                    {formatCurrency(kpis.totalOutstanding)}
                  </h3>
                </div>
                <div className="w-full mt-4 pt-3 border-t border-slate-50 flex flex-col gap-1.5">
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-500" 
                      style={{ width: `${kpis.totalPortfolio > 0 ? Math.min(100, Math.round((kpis.totalOutstanding / kpis.totalPortfolio) * 100)) : 0}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold block text-right">
                    {kpis.totalPortfolio > 0 ? Math.round((kpis.totalOutstanding / kpis.totalPortfolio) * 100) : 0}% de la cartera
                  </span>
                </div>
              </div>

              {/* KPI 4: Fondos Recaudados */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-50/40 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Fondos Recaudados</p>
                  <h3 className="text-2xl font-black text-emerald-600 tracking-tighter mt-2 font-mono">
                    {formatCurrency(kpis.totalCollected)}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold mt-4 pt-3 border-t border-slate-50">
                  <HandCoins className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Suma de cuotas ya cobradas</span>
                </div>
              </div>

              {/* KPI 5: La Copa Mora */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-orange-50/40 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
                <div>
                  <p className="text-xs font-bold text-orange-600 uppercase tracking-tight">Índice de Mora</p>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter mt-2">
                    {kpis.delinquencyRate}%
                  </h3>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                  {kpis.delinquencyRate > 15 ? (
                    <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded font-bold border border-red-100/50 flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3 text-red-500" /> Alerta ({kpis.overdueCount})
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-600 rounded font-bold border border-orange-100/50 flex items-center gap-0.5">
                      Aceptable ({kpis.overdueCount})
                    </span>
                  )}
                  <span className="text-[9px] text-slate-400 font-semibold">Tasa general</span>
                </div>
              </div>
            </div>

            {/* Graphics and Status Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pie Chart: Status Distribution */}
              <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm col-span-1">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Distribución de Estados</h3>
                <p className="text-xs text-slate-400 mb-4">Porcentaje de clientes según estado de pago actual</p>
                
                <div className="h-64" id="pie-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(value) => [`${value} afiliados`, 'Cantidad']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Custom Legends */}
                <div className="grid grid-cols-3 gap-1 pt-4 text-center border-t border-slate-50 mt-2">
                  {chartData.map((item, index) => (
                    <div key={index}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] font-bold text-slate-500 block truncate">{item.name}</span>
                      <span className="text-xs font-black text-slate-800">{item.value} ({clients.length > 0 ? Math.round((item.value / clients.length) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar Chart: Collection vs Pending by Client */}
              <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm col-span-1 lg:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Amortización por Afiliado</h3>
                  <p className="text-xs text-slate-400 mb-4">Comparativa de montos pagados frente a saldos pendientes por cliente</p>
                </div>

                <div className="h-64 mt-2" id="bar-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barChartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <ChartTooltip formatter={(value) => [formatCurrency(Number(value)), '']} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Bar dataKey="Pagado ($)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Pendiente ($)" fill="#c084fc" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* --- SECCIÓN LIMPIAR CASA (MANTENIMIENTO) --- */}
            <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    🧹 Limpiar Casa (Mantenimiento de Cartera)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Elimina afiliados de forma masiva o selectiva. Se descargará automáticamente un archivo Excel de respaldo antes de borrar.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Option 1: Canceled Loans */}
                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between hover:bg-slate-50 transition-all">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Recomendado
                    </span>
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Créditos Liquidados
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Elimina todos los afiliados cuyo préstamo ya esté completamente cancelado/pagado. Deja la base de datos libre de créditos inactivos.
                    </p>
                    <div className="text-xs font-bold text-slate-600 pt-2">
                      Afiliados elegibles: <span className="text-emerald-600">{clients.filter(c => c.prestamo && c.prestamo.estado === 'cancelado').length}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const count = clients.filter(c => c.prestamo && c.prestamo.estado === 'cancelado').length;
                      if (count === 0) {
                        triggerAlert('error', 'No hay ningún afiliado con crédito cancelado para eliminar.');
                        return;
                      }
                      setShowWipeConfirmType('canceled');
                    }}
                    className="mt-4 w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Limpiar Liquidados</span>
                  </button>
                </div>

                {/* Option 2: Selective Deletion */}
                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between hover:bg-slate-50 transition-all">
                  <div className="space-y-2 flex-1 flex flex-col">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                      Personalizado
                    </span>
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Selección Manual
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                      Marca los afiliados específicos que deseas eliminar de forma definitiva de la plataforma.
                    </p>
                    
                    {/* Search and Selector Box */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col flex-1 min-h-[140px] max-h-[180px]">
                      <div className="flex items-center px-2 py-1 bg-slate-50 border-b border-slate-100">
                        <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre o cédula..."
                          value={wipeSearchQuery}
                          onChange={(e) => setWipeSearchQuery(e.target.value)}
                          className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:ring-0 text-slate-700 p-0"
                        />
                        {wipeSearchQuery && (
                          <button onClick={() => setWipeSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                        {clients.filter(c => 
                          c.nombre.toLowerCase().includes(wipeSearchQuery.toLowerCase()) || 
                          c.cedula.includes(wipeSearchQuery)
                        ).length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic text-center py-4">No se encontraron afiliados</p>
                        ) : (
                          clients.filter(c => 
                            c.nombre.toLowerCase().includes(wipeSearchQuery.toLowerCase()) || 
                            c.cedula.includes(wipeSearchQuery)
                          ).map((c) => {
                            const isSelected = selectiveWipeSelected.includes(c.cedula);
                            return (
                              <button
                                type="button"
                                key={c.cedula}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectiveWipeSelected(prev => prev.filter(id => id !== c.cedula));
                                  } else {
                                    setSelectiveWipeSelected(prev => [...prev, c.cedula]);
                                  }
                                }}
                                className={`w-full text-left px-2 py-1 rounded-lg text-[10px] flex items-center justify-between transition-all ${
                                  isSelected ? 'bg-purple-50 text-purple-700 font-bold border border-purple-100' : 'hover:bg-slate-100 text-slate-600 border border-transparent'
                                }`}
                              >
                                <span className="truncate max-w-[140px]">{c.nombre}</span>
                                <span className="font-mono text-[9px] text-slate-400">{c.cedula}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectiveWipeSelected.length === 0) {
                        triggerAlert('error', 'Selecciona al menos un afiliado de la lista para eliminar.');
                        return;
                      }
                      setShowWipeConfirmType('selective');
                    }}
                    className="mt-4 w-full bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Borrar Seleccionados ({selectiveWipeSelected.length})</span>
                  </button>
                </div>

                {/* Option 3: Full Reset */}
                <div className="bg-red-50/20 border border-red-100 p-5 rounded-2xl flex flex-col justify-between hover:bg-red-50/40 transition-all">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                      Zona de Peligro
                    </span>
                    <h4 className="text-xs font-black text-red-700 uppercase tracking-wider">
                      Reinicio Total de Cartera
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Borra de forma absoluta TODOS los afiliados de la base de datos de forma irreversible. Ideal para limpiezas de fin de periodo o pruebas.
                    </p>
                    <div className="text-xs font-bold text-slate-600 pt-2">
                      Total afiliados a borrar: <span className="text-red-600">{clients.length}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (clients.length === 0) {
                        triggerAlert('error', 'No hay ningún afiliado en el sistema.');
                        return;
                      }
                      setShowWipeConfirmType('all');
                    }}
                    className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md shadow-red-600/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Restablecer Todo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- SECTION B: Gestión de Clientes -------------------- */}
        {activeTab === 'management' && (
          <div className="space-y-6" id="management-section">
            {/* Excel Data Sync Actions Bar */}
            <div className="bg-white border border-slate-100 p-4 md:p-5 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/50">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">Sincronización Masiva de Datos</h4>
                  <p className="text-xs text-slate-500">Carga un archivo Excel para registrar o actualizar afiliados y créditos, o descarga el informe actual.</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                {/* Hidden file input for Excel import */}
                <input
                  type="file"
                  id="excel-import-input"
                  accept=".xlsx, .xls"
                  onChange={handleImportExcel}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('excel-import-input')?.click()}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-purple-600/10 transition-all flex items-center gap-2 text-xs cursor-pointer active:scale-[0.98]"
                  title="Cargar archivo Excel para importar o actualizar afiliados, créditos y cuotas"
                >
                  <Plus className="w-4 h-4" />
                  <span>Importar Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportToExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/10 transition-all flex items-center gap-2 text-xs cursor-pointer active:scale-[0.98]"
                  title="Descargar base de datos actual en archivo Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Excel</span>
                </button>
              </div>
            </div>

            {/* Real-time search tools & filters */}
            <div className="bg-white border border-slate-100 p-4 md:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o cédula..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto" id="status-filters">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 hidden md:inline-block">
                  Estado:
                </span>
                {(['todos', 'vigente', 'atrasado', 'cancelado'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all uppercase cursor-pointer ${
                      statusFilter === filter
                        ? filter === 'todos'
                          ? 'bg-slate-900 text-white shadow-md'
                          : filter === 'vigente'
                          ? 'bg-blue-600 text-white shadow-md'
                          : filter === 'atrasado'
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {filter === 'todos' ? 'Todos' : filter === 'vigente' ? 'Vigente (Azul)' : filter === 'atrasado' ? 'Demorado (Rojo)' : 'Cancelado (Verde)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Collapsible Add New Client Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                  id="add-client-form-container"
                >
                  <form
                    onSubmit={handleCreateClient}
                    className="bg-white border border-purple-100 rounded-3xl shadow-sm p-6 space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                          <Plus className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800">Registrar Afiliado e Inicializar Crédito</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Section 1: Personal Info */}
                      <div className="space-y-4 md:col-span-2 lg:col-span-1 border-r border-slate-50 pr-0 lg:pr-6">
                        <h4 className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-1">
                          1. Información Personal
                        </h4>
                        
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Cédula de Identidad *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: 54321"
                            value={newClient.cedula}
                            onChange={(e) => setNewClient({ ...newClient, cedula: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Nombre Completo *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: Ana Gómez"
                            value={newClient.nombre}
                            onChange={(e) => setNewClient({ ...newClient, nombre: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Correo Electrónico</label>
                          <input
                            type="email"
                            placeholder="Ej: ana@email.com"
                            value={newClient.correo}
                            onChange={(e) => setNewClient({ ...newClient, correo: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Teléfono (WhatsApp)</label>
                          <input
                            type="text"
                            placeholder="Ej: 3009999999"
                            value={newClient.telefono}
                            onChange={(e) => setNewClient({ ...newClient, telefono: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Dirección Residencial</label>
                          <input
                            type="text"
                            placeholder="Ej: Transversal 12 #34, Bogotá"
                            value={newClient.direccion}
                            onChange={(e) => setNewClient({ ...newClient, direccion: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Banco / Entidad</label>
                            <input
                              type="text"
                              placeholder="Ej: Bancolombia, Nequi"
                              value={newClient.banco}
                              onChange={(e) => setNewClient({ ...newClient, banco: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">N° de Cuenta</label>
                            <input
                              type="text"
                              placeholder="Ej: Ahorros 12345"
                              value={newClient.numeroCuenta}
                              onChange={(e) => setNewClient({ ...newClient, numeroCuenta: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Monto Máximo de Crédito (Cupo Pre-Aprobado)</label>
                          <input
                            type="number"
                            required
                            min="100000"
                            step="100000"
                            placeholder="Ej: 10000000"
                            value={newClient.montoMaximo}
                            onChange={(e) => setNewClient({ ...newClient, montoMaximo: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all font-semibold font-mono"
                          />
                        </div>
                      </div>

                      {/* Section 2: Credit Terms */}
                      <div className="space-y-4 md:col-span-1 lg:col-span-1 border-r border-slate-50 pr-0 lg:pr-6">
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
                          2. Términos del Crédito
                        </h4>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Monto del Préstamo (COP)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                            <input
                              type="number"
                              required
                              placeholder="Ej: 5000000"
                              value={newClient.monto}
                              onChange={(e) => setNewClient({ ...newClient, monto: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl pl-7 pr-3.5 py-2.5 text-sm outline-none transition-all font-semibold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Tasa Interés Mensual</label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.1"
                                required
                                value={newClient.tasa}
                                onChange={(e) => setNewClient({ ...newClient, tasa: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 pr-8 text-sm outline-none transition-all font-semibold"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Plazo (Meses)</label>
                            <input
                              type="number"
                              required
                              value={newClient.plazo}
                              onChange={(e) => setNewClient({ ...newClient, plazo: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all font-semibold"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Fecha de Inicio</label>
                          <input
                            type="date"
                            required
                            value={newClient.fechaInicio}
                            onChange={(e) => setNewClient({ ...newClient, fechaInicio: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Estado Inicial de Pago</label>
                          <select
                            value={newClient.estadoInicial}
                            onChange={(e) => setNewClient({ ...newClient, estadoInicial: e.target.value as any })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all font-bold text-slate-700"
                          >
                            <option value="vigente">Vigente (Al día)</option>
                            <option value="atrasado">Atrasado (En Mora)</option>
                            <option value="cancelado">Cancelado (Paz y Salvo)</option>
                          </select>
                        </div>
                      </div>

                      {/* Section 3: Summary Previsualization */}
                      <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">
                            3. Amortización Precalculada
                          </h4>
                          
                          {(() => {
                            const m = parseFloat(newClient.monto) || 0;
                            const t = parseFloat(newClient.tasa) || 0;
                            const p = parseInt(newClient.plazo) || 0;
                            
                            let cuota = 0;
                            const r = t / 100;
                            if (m > 0 && p > 0) {
                              if (r === 0) cuota = m / p;
                              else cuota = m * (r * Math.pow(1 + r, p)) / (Math.pow(1 + r, p) - 1);
                            }
                            const totalAPagar = cuota * p;
                            const interesesTotales = totalAPagar - m;

                            return (
                              <div className="space-y-3.5 text-sm">
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-slate-500 font-medium">Cuota Mensual (Fija):</span>
                                  <span className="font-bold text-slate-800">{formatCurrency(cuota)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-slate-500 font-medium">Capital Solicitado:</span>
                                  <span className="font-semibold text-slate-800">{formatCurrency(m)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-slate-500 font-medium">Intereses Generados:</span>
                                  <span className="font-semibold text-purple-600">{formatCurrency(interesesTotales > 0 ? interesesTotales : 0)}</span>
                                </div>
                                <div className="flex justify-between pt-1 font-bold text-base">
                                  <span className="text-slate-700">Retorno Estimado:</span>
                                  <span className="text-purple-600 font-extrabold">{formatCurrency(totalAPagar > 0 ? totalAPagar : 0)}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-500/10 transition-all text-sm mt-6 cursor-pointer"
                        >
                          Guardar y Generar Plan de Pagos
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* General Portfolio Table */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden" id="clients-table-container">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Afiliado / Cédula</th>
                      <th className="py-4 px-6">Contacto</th>
                      <th className="py-4 px-6">Monto Crédito</th>
                      <th className="py-4 px-6">Saldo Restante</th>
                      <th className="py-4 px-6">Progreso Amortización</th>
                      <th className="py-4 px-6 text-center">Estado</th>
                      <th className="py-4 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    <AnimatePresence>
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-medium text-sm">
                            No se encontraron afiliados que coincidan con la búsqueda o filtro.
                          </td>
                        </tr>
                      ) : (
                        filteredClients.map((client) => {
                          const loan = client.prestamo;
                          
                          // Count paid installments
                          const paidCount = loan ? loan.cuotas.filter((c) => c.pagado).length : 0;
                          const totalCount = loan ? loan.cuotas.length : 0;
                          const progressPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

                          // Balance calculations
                          const totalRemaining = loan
                            ? loan.cuotas.filter((c) => !c.pagado).reduce((sum, c) => sum + c.montoTotal, 0)
                            : 0;

                          return (
                            <motion.tr
                              key={client.cedula}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              {/* Client Info */}
                              <td className="py-4 px-6">
                                <p className="text-sm font-bold text-slate-800">{client.nombre}</p>
                                <p className="text-xs text-slate-400">CC {client.cedula}</p>
                                <p className="text-[10px] text-emerald-600 font-bold mt-1 uppercase tracking-wider">
                                  Cupo Máx: {formatCurrency(client.montoMaximo ?? 10000000)}
                                </p>
                              </td>

                              {/* Contact */}
                              <td className="py-4 px-6">
                                <p className="text-xs text-slate-500">{client.correo}</p>
                                <p className="text-xs font-mono text-slate-400 mt-0.5">{client.telefono}</p>
                              </td>

                              {/* Credit Capital */}
                              <td className="py-4 px-6">
                                {loan ? (
                                  <>
                                    <p className="font-mono text-sm text-slate-800 font-semibold">{formatCurrency(loan.montoOriginal)}</p>
                                    <p className="text-[10px] text-purple-600 font-bold mt-0.5">
                                      {loan.tasaInteresMensual}% Int. / {loan.plazoMeses} meses
                                    </p>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Sin crédito activo</span>
                                )}
                              </td>

                              {/* Remaining Balance */}
                              <td className="py-4 px-6">
                                {loan ? (
                                  <p className="font-mono text-sm text-purple-600 font-bold">
                                    {formatCurrency(totalRemaining)}
                                  </p>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">-</span>
                                )}
                              </td>

                              {/* Amortization Progress */}
                              <td className="py-4 px-6">
                                {loan ? (
                                  <div className="w-full max-w-[140px]">
                                    <div className="flex items-center gap-3">
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-purple-600 transition-all duration-500"
                                          style={{ width: `${progressPct}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-500">{progressPct}%</span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 block mt-1">{paidCount} de {totalCount} cuotas</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">-</span>
                                )}
                              </td>

                              {/* Colored status badge */}
                              <td className="py-4 px-6 text-center">
                                {loan ? (
                                  <span
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md border inline-block ${
                                      loan.estado === 'cancelado'
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : loan.estado === 'vigente'
                                        ? 'bg-blue-50 text-blue-600 border-blue-100'
                                        : 'bg-red-50 text-red-600 border-red-100'
                                    }`}
                                  >
                                    {loan.estado === 'cancelado' ? 'CANCELADO' : loan.estado === 'vigente' ? 'VIGENTE' : 'ATRASADO'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-md inline-block">
                                    SIN CRÉDITO
                                  </span>
                                )}
                              </td>

                              {/* Direct Actions */}
                              <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                                {loan && loan.estado !== 'cancelado' && (
                                  <button
                                    onClick={() => handleRegisterPayment(client.cedula)}
                                    className="p-1.5 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded-lg transition-colors border border-transparent hover:border-emerald-100 inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                    title="Pagar Cuota Actual"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                    <span className="hidden lg:inline-block">Registrar pago</span>
                                  </button>
                                )}

                                {loan && (
                                  <a
                                    href={getWhatsAppLink(client)}
                                    target="_blank"
                                    referrerPolicy="no-referrer"
                                    className="p-1.5 hover:bg-purple-50 text-purple-600 hover:text-purple-700 rounded-lg transition-colors border border-transparent hover:border-purple-100 inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                    title="Contacto WhatsApp"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                    <span className="hidden lg:inline-block">Contacto</span>
                                  </a>
                                )}

                                <button
                                  onClick={() => {
                                    setEditingClient(client);
                                    setEditNombre(client.nombre);
                                    setEditCedula(client.cedula);
                                    setEditCorreo(client.correo);
                                    setEditTelefono(client.telefono);
                                    setEditDireccion(client.direccion);
                                    setEditBanco(client.banco || '');
                                    setEditNumeroCuenta(client.numeroCuenta || '');
                                    setEditContrasena(client.contrasena || client.cedula);
                                    setEditMontoMaximo(client.montoMaximo ? client.montoMaximo.toString() : '10000000');
                                    setEditHasLoan(!!client.prestamo);
                                    if (client.prestamo) {
                                      setEditMonto(client.prestamo.montoOriginal.toString());
                                      setEditTasa(client.prestamo.tasaInteresMensual.toString());
                                      setEditPlazo(client.prestamo.plazoMeses.toString());
                                      setEditFechaInicio(client.prestamo.fechaInicio);
                                      setEditEstadoLoan(client.prestamo.estado);
                                    } else {
                                      setEditMonto('');
                                      setEditTasa('2.0');
                                      setEditPlazo('12');
                                      setEditFechaInicio(new Date().toISOString().split('T')[0]);
                                      setEditEstadoLoan('vigente');
                                    }
                                  }}
                                  className="p-1.5 hover:bg-amber-50 text-amber-600 hover:text-amber-700 rounded-lg transition-colors border border-transparent hover:border-amber-100 inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                  title="Editar Datos de Usuario"
                                >
                                  <Edit className="w-4 h-4" />
                                  <span className="hidden lg:inline-block">Editar</span>
                                </button>

                                <button
                                  onClick={() => setSelectedClient(client)}
                                  className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                  title="Ver Ficha y Cronograma"
                                >
                                  <Clock className="w-4 h-4" />
                                  <span className="hidden lg:inline-block">Plan pagos</span>
                                </button>

                                <button
                                  onClick={() => setClientToDelete(client)}
                                  className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg transition-colors border border-transparent hover:border-red-100 inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                  title="Eliminar Usuario"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="hidden lg:inline-block">Eliminar</span>
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- SECTION C: Calendario de Pagos -------------------- */}
        {activeTab === 'calendar' && (() => {
          const MONTH_NAMES = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ];
          const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();

          const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
          const firstDayOfMonthIndex = new Date(year, month, 1).getDay();

          const calendarDays: { dayNum: number | null; dateString: string | null }[] = [];

          // Padding from previous month
          for (let i = 0; i < firstDayOfMonthIndex; i++) {
            calendarDays.push({ dayNum: null, dateString: null });
          }

          // Days of the month
          for (let d = 1; d <= totalDaysInMonth; d++) {
            const mStr = String(month + 1).padStart(2, '0');
            const dStr = String(d).padStart(2, '0');
            const dateString = `${year}-${mStr}-${dStr}`;
            calendarDays.push({ dayNum: d, dateString });
          }

          const formatToSpanishFullDate = (dateString: string) => {
            const [y, m, d] = dateString.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString('es-CO', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
          };

          return (
            <div className="space-y-6 animate-fadeIn" id="calendar-section">
              <div className="bg-white border border-purple-100 p-6 rounded-3xl text-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2 text-slate-900">
                    <span className="text-xl">📅</span>
                    Calendario Inteligente de Cartera
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl font-medium">
                    Audita y rastrea las fechas de pago y los vencimientos de cuotas de tus afiliados en tiempo real, con desglose detallado de horas y montos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl text-[10px] font-bold border border-purple-100/50 flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
                    Punto Verde: Pagos Realizados
                  </span>
                  <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl text-[10px] font-bold border border-purple-100/50 flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-orange-500 inline-block shrink-0" />
                    Punto Naranja: Cuotas Pendientes
                  </span>
                </div>
              </div>

              {/* Monthly stats for Selected Month */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-50/40 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Recaudado este Mes ({MONTH_NAMES[month]})</p>
                    <h3 className="text-2xl font-black text-emerald-600 tracking-tighter mt-2 font-mono">
                      {formatCurrency(calendarMonthStats.totalCollected)}
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-50 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Pagos registrados para el mes seleccionado
                  </p>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-50/40 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Obligaciones Pendientes (Mes)</p>
                    <h3 className="text-2xl font-black text-amber-600 tracking-tighter mt-2 font-mono">
                      {formatCurrency(calendarMonthStats.totalPending)}
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-50 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Cuotas programadas que están por cobrar
                  </p>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-red-50/40 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
                  <div>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-tight">Mora Vencida de este Mes</p>
                    <h3 className="text-2xl font-black text-red-600 tracking-tighter mt-2 font-mono">
                      {formatCurrency(calendarMonthStats.totalOverdue)}
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-50 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Suma en mora con vencimiento pasado este mes
                  </p>
                </div>
              </div>

              {/* Calendar Workspace Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar Body */}
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm lg:col-span-2 space-y-6">
                  {/* Navigator Controls */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest block">Seleccionar Período</span>
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                        {MONTH_NAMES[month]} de {year}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const prev = new Date(year, month - 1, 1);
                          setCurrentDate(prev);
                        }}
                        className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200"
                        title="Mes anterior"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => {
                          const now = new Date();
                          setCurrentDate(now);
                          setSelectedDateStr(now.toISOString().split('T')[0]);
                        }}
                        className="px-3.5 py-1.5 text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl transition-all cursor-pointer border border-purple-100"
                      >
                        Hoy
                      </button>

                      <button
                        onClick={() => {
                          const next = new Date(year, month + 1, 1);
                          setCurrentDate(next);
                        }}
                        className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200"
                        title="Siguiente mes"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Grid Table */}
                  <div className="w-full">
                    {/* Week Days Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                      {WEEK_DAYS.map((dName) => (
                        <div key={dName} className="text-xs font-bold text-slate-400 py-1 uppercase tracking-wider">
                          {dName}
                        </div>
                      ))}
                    </div>

                    {/* Day Grid cells */}
                    <div className="grid grid-cols-7 gap-3">
                      {calendarDays.map((cell, idx) => {
                        const isSelected = cell.dateString === selectedDateStr;
                        const isToday = cell.dateString === new Date().toISOString().split('T')[0];

                        // Match events
                        const dayEvents = cell.dateString ? allCalendarEvents.filter(e => e.dateStr === cell.dateString) : [];
                        const hasPayments = dayEvents.some(e => e.type === 'payment');
                        const hasPending = dayEvents.some(e => e.type === 'due_pending');

                        return (
                          <button
                            key={idx}
                            disabled={!cell.dayNum}
                            onClick={() => {
                              if (cell.dateString) {
                                setSelectedDateStr(cell.dateString);
                              }
                            }}
                            className={`aspect-square p-2 rounded-2xl flex flex-col justify-between relative transition-all border ${
                              !cell.dayNum
                                ? 'bg-slate-50/20 border-transparent cursor-default'
                                : isSelected
                                ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/30 font-bold scale-[1.02]'
                                : isToday
                                ? 'bg-purple-50 border-purple-200 text-purple-900 font-extrabold'
                                : 'bg-white border-slate-100 hover:border-purple-300 text-slate-700 hover:bg-purple-50/20'
                            } ${cell.dayNum ? 'cursor-pointer' : ''}`}
                          >
                            {cell.dayNum && (
                              <>
                                <span className="text-xs sm:text-sm font-semibold">{cell.dayNum}</span>
                                
                                <div className="flex items-center gap-1 mt-auto justify-center w-full">
                                  {hasPayments && (
                                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
                                  )}
                                  {hasPending && (
                                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white animate-pulse' : 'bg-orange-500'}`} />
                                  )}
                                </div>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Daily ledger card */}
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm col-span-1 flex flex-col h-[520px]">
                  {/* Ledger Header */}
                  <div className="border-b border-slate-100 pb-4 shrink-0">
                    <h4 className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Auditoría de Tiempos
                    </h4>
                    <p className="text-sm font-black text-slate-800 leading-tight capitalize">
                      {formatToSpanishFullDate(selectedDateStr)}
                    </p>
                  </div>

                  {/* Filter tabs inside daily card */}
                  <div className="flex items-center gap-1.5 py-3 border-b border-slate-50 shrink-0">
                    <button
                      onClick={() => setCalendarFilter('todos')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${
                        calendarFilter === 'todos'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setCalendarFilter('payment')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                        calendarFilter === 'payment'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      Pagos
                    </button>
                    <button
                      onClick={() => setCalendarFilter('due')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                        calendarFilter === 'due'
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                      Deudas
                    </button>
                  </div>

                  {/* List of items */}
                  <div className="flex-1 overflow-y-auto pt-4 space-y-3 pr-1">
                    {selectedDateEvents.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 italic py-10">
                        <Calendar className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
                        <p className="text-xs font-semibold">No hay movimientos registrados.</p>
                        <p className="text-[10px] text-slate-400 mt-1">Busca días marcados con indicadores de color en el calendario.</p>
                      </div>
                    ) : (
                      selectedDateEvents.map((ev) => {
                        const isPay = ev.type === 'payment';
                        const isDuePending = ev.type === 'due_pending';
                        
                        return (
                          <div
                            key={ev.id}
                            className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                              isPay
                                ? 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50/60'
                                : isDuePending
                                ? 'bg-orange-50/40 border-orange-100 hover:bg-orange-50/60'
                                : 'bg-slate-50 border-slate-100'
                            }`}
                          >
                            <div className={`p-2 rounded-xl shrink-0 ${
                              isPay
                                ? 'bg-emerald-100 text-emerald-700'
                                : isDuePending
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {isPay ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-tight">
                                  Cuota #{ev.cuotaNumero}
                                </span>
                                <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                                  {ev.timeStr}
                                </span>
                              </div>

                              <p className="text-xs font-black text-slate-800 truncate" title={ev.clientNombre}>
                                {ev.clientNombre}
                              </p>

                              <p className="text-[10px] text-slate-500 font-bold">
                                CC: {ev.clientCedula}
                              </p>

                              <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-100 mt-1">
                                <span className={`text-[9px] font-black uppercase tracking-widest ${
                                  isPay
                                    ? 'text-emerald-700'
                                    : 'text-orange-700'
                                }`}>
                                  {isPay ? 'PAGO RECIBIDO' : 'CUOTA VENCIDA'}
                                </span>
                                <span className="text-xs font-black text-slate-900 font-mono">
                                  {formatCurrency(ev.monto)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* -------------------- SECTION D: Notificaciones -------------------- */}
        {activeTab === 'notifications' && (() => {
          // Compute audiences
          const totalAffiliates = clients.length;
          const vigentesCount = clients.filter(c => c.prestamo?.estado === 'vigente').length;
          const atrasadosCount = clients.filter(c => c.prestamo?.estado === 'atrasado').length;
          const noLoanCount = clients.filter(c => !c.prestamo).length;

          // Compute sent notifications history
          const sentNotificationsHistory: { id: string; titulo: string; mensaje: string; fecha: string; count: number; target: string }[] = [];
          const seenIds = new Set<string>();
          clients.forEach(c => {
            if (c.notificaciones) {
              c.notificaciones.forEach(n => {
                if (!seenIds.has(n.id)) {
                  seenIds.add(n.id);
                  const recipientCount = clients.filter(other => 
                    other.notificaciones?.some(otherN => otherN.id === n.id)
                  ).length;
                  
                  let targetDesc = 'Socio específico';
                  if (recipientCount === clients.length) {
                    targetDesc = 'Todos los afiliados';
                  } else if (recipientCount === vigentesCount && vigentesCount > 0) {
                    targetDesc = 'Socio(s) al día';
                  } else if (recipientCount === atrasadosCount && atrasadosCount > 0) {
                    targetDesc = 'Socio(s) en mora';
                  } else if (recipientCount === noLoanCount && noLoanCount > 0) {
                    targetDesc = 'Socio(s) sin crédito';
                  }

                  sentNotificationsHistory.push({
                    id: n.id,
                    titulo: n.titulo,
                    mensaje: n.mensaje,
                    fecha: n.fecha,
                    count: recipientCount,
                    target: targetDesc
                  });
                }
              });
            }
          });
          sentNotificationsHistory.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

          return (
            <div className="space-y-6" id="notifications-section">
              {/* Stats overview banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Socios</span>
                      <span className="text-lg font-extrabold text-slate-800">{totalAffiliates}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Al Día (Vigentes)</span>
                      <span className="text-lg font-extrabold text-emerald-600">{vigentesCount}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">En Mora (Atrasados)</span>
                      <span className="text-lg font-extrabold text-rose-600">{atrasadosCount}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Sin Crédito Activo</span>
                      <span className="text-lg font-extrabold text-slate-600">{noLoanCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Compose Form (7 cols) */}
                <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100/50">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Redactar Nueva Notificación</h3>
                      <p className="text-xs text-slate-500">Envía alertas instantáneas a tus afiliados de acuerdo a su estado de cuenta</p>
                    </div>
                  </div>

                  {notifSuccessMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-bold"
                    >
                      {notifSuccessMessage}
                    </motion.div>
                  )}

                  <form onSubmit={handleSendNotification} className="space-y-5">
                    {/* Destination Selection Cards */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Destinatarios / Audiencia</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => { setNotifTarget('all'); setNotifTargetCedula(''); }}
                          className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all cursor-pointer ${
                            notifTarget === 'all'
                              ? 'border-purple-500 bg-purple-50/40 shadow-sm'
                              : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                          }`}
                        >
                          <Users className={`w-5 h-5 ${notifTarget === 'all' ? 'text-purple-600' : 'text-slate-400'}`} />
                          <div>
                            <span className="text-xs font-extrabold text-slate-800 block">Todos</span>
                            <span className="text-[10px] text-slate-500">{totalAffiliates} afiliados</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setNotifTarget('atrasado'); setNotifTargetCedula(''); }}
                          className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all cursor-pointer ${
                            notifTarget === 'atrasado'
                              ? 'border-rose-500 bg-rose-50/40 shadow-sm'
                              : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                          }`}
                        >
                          <AlertTriangle className={`w-5 h-5 ${notifTarget === 'atrasado' ? 'text-rose-600' : 'text-slate-400'}`} />
                          <div>
                            <span className="text-xs font-extrabold text-slate-800 block">En Mora (Deben)</span>
                            <span className="text-[10px] text-slate-500">{atrasadosCount} afiliados</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setNotifTarget('vigente'); setNotifTargetCedula(''); }}
                          className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all cursor-pointer ${
                            notifTarget === 'vigente'
                              ? 'border-emerald-500 bg-emerald-50/40 shadow-sm'
                              : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                          }`}
                        >
                          <CheckCircle2 className={`w-5 h-5 ${notifTarget === 'vigente' ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <span className="text-xs font-extrabold text-slate-800 block">Al Día (Vigentes)</span>
                            <span className="text-[10px] text-slate-500">{vigentesCount} afiliados</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNotifTarget('specific')}
                          className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all cursor-pointer ${
                            notifTarget === 'specific'
                              ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                              : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                          }`}
                        >
                          <Mail className={`w-5 h-5 ${notifTarget === 'specific' ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <div>
                            <span className="text-xs font-extrabold text-slate-800 block">Socio Específico</span>
                            <span className="text-[10px] text-slate-500">Elegir un afiliado</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Specific client dropdown selection */}
                    <AnimatePresence>
                      {notifTarget === 'specific' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Seleccionar Socio Destinatario</label>
                          <select
                            value={notifTargetCedula}
                            onChange={(e) => setNotifTargetCedula(e.target.value)}
                            className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-2xl px-4 py-3 text-xs outline-none transition-all"
                          >
                            <option value="">-- Selecciona un Socio --</option>
                            {clients.map(c => {
                              const stateLabel = c.prestamo 
                                ? c.prestamo.estado === 'atrasado' 
                                  ? ' (EN MORA)' 
                                  : ' (AL DÍA)' 
                                : ' (SIN CRÉDITO)';
                              return (
                                <option key={c.cedula} value={c.cedula}>
                                  {c.nombre} - CC {c.cedula}{stateLabel}
                                </option>
                              );
                            })}
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Title Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Título / Asunto</label>
                      <input
                        type="text"
                        placeholder="Ej: Recordatorio de Próxima Cuota"
                        value={notifTitle}
                        onChange={(e) => setNotifTitle(e.target.value)}
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-2xl px-4 py-3.5 text-xs outline-none transition-all font-medium placeholder-slate-400"
                      />
                    </div>

                    {/* Template shortcuts */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">Plantillas Rápidas</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNotifTitle('Recordatorio de Pago de Cuota - CrediULEP');
                            setNotifBody('Estimado socio, le recordamos que la fecha de vencimiento de su próxima cuota está cerca. Le agradecemos realizar su pago a tiempo para mantener su excelente historial crediticio. ¡Muchas gracias!');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          📝 Próximo Pago
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifTitle('ALERTA DE MORA: Cuota Vencida - CrediULEP');
                            setNotifBody('Estimado socio, detectamos que presenta una o más cuotas en mora. Le solicitamos ponerse en contacto urgente con la administración para regularizar su situación y evitar cargos adicionales o reportes.');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          📝 Cuota en Mora
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifTitle('¡Felicitaciones por estar al día! 🌟');
                            setNotifBody('Estimado socio, queremos agradecerle su compromiso y puntualidad en el pago de sus cuotas. Su excelente comportamiento de pago fortalece nuestro fondo y le abre las puertas a futuros créditos.');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          📝 Felicitación
                        </button>
                      </div>
                    </div>

                    {/* Body textarea */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Mensaje / Cuerpo del Comunicado</label>
                      <textarea
                        rows={4}
                        placeholder="Escribe el mensaje que recibirá el socio en su panel de notificaciones y vía push..."
                        value={notifBody}
                        onChange={(e) => setNotifBody(e.target.value)}
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-2xl px-4 py-3.5 text-xs outline-none transition-all font-medium placeholder-slate-400 leading-relaxed resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!notifTitle.trim() || !notifBody.trim()}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-purple-500/10 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-2 mt-4"
                    >
                      <Send className="w-4 h-4" />
                      <span>Enviar Alerta de Notificación</span>
                    </button>
                  </form>
                </div>

                {/* Sent history log (5 cols) */}
                <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[650px]">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100 mb-4">
                    <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
                      <Clock className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">Historial de Envío</h4>
                      <p className="text-[11px] text-slate-500">Comunicados emitidos recientemente</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 min-h-0">
                    {sentNotificationsHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 italic">
                        <Bell className="w-10 h-10 text-slate-200 mb-2 stroke-1" />
                        <p className="text-xs font-semibold">No hay notificaciones enviadas.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Las alertas masivas que envíes se registrarán aquí.</p>
                      </div>
                    ) : (
                      sentNotificationsHistory.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100/30 transition-colors flex flex-col gap-2 relative group"
                        >
                          <button
                            onClick={() => handleDeleteNotification(notif.id)}
                            className="absolute top-3 right-3 p-1 bg-white hover:bg-rose-50 text-slate-300 hover:text-rose-600 border border-slate-100 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Eliminar notificación de los registros"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-start justify-between pr-6">
                            <span className="text-[9px] font-black text-slate-400 font-mono">
                              {new Date(notif.fecha).toLocaleDateString()} {new Date(notif.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                              notif.target.includes('mora')
                                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : notif.target.includes('día')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : notif.target.includes('específico')
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'bg-purple-50 text-purple-700 border border-purple-100'
                            }`}>
                              {notif.target} ({notif.count})
                            </span>
                          </div>

                          <div>
                            <h5 className="text-xs font-bold text-slate-800 line-clamp-1">{notif.titulo}</h5>
                            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed line-clamp-3">{notif.mensaje}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- Plan de Pagos Detail Modal --- */}
        <AnimatePresence>
          {selectedClient && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
                id="payment-plan-modal"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      Cronograma de Pagos - {selectedClient.nombre}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cédula: {selectedClient.cedula} • Teléfono: {selectedClient.telefono}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  {/* Loan Parameters Details */}
                  {selectedClient.prestamo ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-purple-50/40 p-4 rounded-2xl border border-purple-100/50">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Capital Solicitado
                          </span>
                          <span className="text-base font-extrabold text-slate-800">
                            {formatCurrency(selectedClient.prestamo.montoOriginal)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Tasa Mensual
                          </span>
                          <span className="text-base font-extrabold text-slate-800">
                            {selectedClient.prestamo.tasaInteresMensual}%
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Plazo Pactado
                          </span>
                          <span className="text-base font-extrabold text-slate-800">
                            {selectedClient.prestamo.plazoMeses} Meses
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Fecha de Inicio
                          </span>
                          <span className="text-base font-extrabold text-slate-800">
                            {selectedClient.prestamo.fechaInicio}
                          </span>
                        </div>
                      </div>

                      {/* Amortization Table */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-800">Tabla de Amortización</h4>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider">
                                <th className="py-3 px-4"># Cuota</th>
                                <th className="py-3 px-4">Vence</th>
                                <th className="py-3 px-4 text-right">Abono Capital</th>
                                <th className="py-3 px-4 text-right">Abono Interés</th>
                                <th className="py-3 px-4 text-right">Valor Cuota</th>
                                <th className="py-3 px-4 text-right">Saldo Deuda</th>
                                <th className="py-3 px-4 text-center">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium">
                              {selectedClient.prestamo.cuotas.map((cuota) => (
                                <tr key={cuota.id} className={`${cuota.pagado ? 'bg-slate-50/50' : 'bg-white'}`}>
                                  <td className="py-3 px-4 font-bold text-slate-600">{cuota.numero}</td>
                                  <td className="py-3 px-4 font-mono text-slate-500">{cuota.fechaVencimiento}</td>
                                  <td className="py-3 px-4 text-right">{formatCurrency(cuota.capital)}</td>
                                  <td className="py-3 px-4 text-right text-purple-600">{formatCurrency(cuota.interes)}</td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-800">{formatCurrency(cuota.montoTotal)}</td>
                                  <td className="py-3 px-4 text-right font-mono text-slate-400">{formatCurrency(cuota.saldoRestante)}</td>
                                  <td className="py-3 px-4 text-center">
                                    {cuota.pagado ? (
                                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                        Pagado el {cuota.fechaPago}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                        Pendiente
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center text-slate-400 italic font-medium">
                      Este afiliado no tiene ningún préstamo activo.
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  {selectedClient.prestamo && selectedClient.prestamo.estado !== 'cancelado' ? (
                    <button
                      onClick={() => handleRegisterPayment(selectedClient.cedula)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Registrar Pago de Cuota</span>
                    </button>
                  ) : (
                    <div />
                  )}
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all text-sm cursor-pointer"
                  >
                    Cerrar Plan
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- Edit Client Modal --- */}
        <AnimatePresence>
          {editingClient && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                id="edit-client-modal"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      Editar Afiliado: {editingClient.nombre}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Modifica todos los datos de perfil y condiciones del crédito de este usuario.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingClient(null)}
                    className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Content Form */}
                <form onSubmit={handleUpdateClient} className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Section A: User Details */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-purple-600 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        1. Información de Perfil del Usuario
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Cédula de Ciudadanía *</label>
                          <input
                            type="text"
                            required
                            value={editCedula}
                            onChange={(e) => setEditCedula(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Nombre Completo *</label>
                          <input
                            type="text"
                            required
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Correo Electrónico</label>
                          <input
                            type="email"
                            value={editCorreo}
                            onChange={(e) => setEditCorreo(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Teléfono (WhatsApp)</label>
                          <input
                            type="text"
                            value={editTelefono}
                            onChange={(e) => setEditTelefono(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold text-slate-500">Dirección Residencial</label>
                          <input
                            type="text"
                            value={editDireccion}
                            onChange={(e) => setEditDireccion(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Banco de la Cuenta</label>
                          <input
                            type="text"
                            placeholder="Ej: Bancolombia, Nequi"
                            value={editBanco}
                            onChange={(e) => setEditBanco(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Número de Cuenta</label>
                          <input
                            type="text"
                            placeholder="Ej: Ahorros 123-45678"
                            value={editNumeroCuenta}
                            onChange={(e) => setEditNumeroCuenta(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-semibold"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold text-slate-500">Monto Máximo de Crédito (Cupo Pre-Aprobado)</label>
                          <input
                            type="number"
                            required
                            min="100000"
                            step="100000"
                            placeholder="Ej: 10000000"
                            value={editMontoMaximo}
                            onChange={(e) => setEditMontoMaximo(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-semibold font-mono"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2 bg-purple-50/30 p-3.5 rounded-2xl border border-purple-100/50">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 tracking-wider uppercase mb-2">
                            <KeyRound className="w-3.5 h-3.5" />
                            Seguridad de la Cuenta
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">Contraseña de Ingreso</label>
                              <input
                                type="text"
                                required
                                value={editContrasena}
                                onChange={(e) => setEditContrasena(e.target.value)}
                                className="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-mono font-semibold"
                                placeholder="Misma cédula u otra"
                              />
                            </div>
                            <div className="flex items-end pb-1.5">
                              <p className="text-[11px] text-slate-400">
                                Por defecto es la cédula. Puedes cambiarla para personalizar el ingreso del afiliado.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section B: Credit Details */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                          <CircleDollarSign className="w-4 h-4" />
                          2. Información del Crédito / Préstamo
                        </h4>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editHasLoan}
                            onChange={(e) => setEditHasLoan(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                          <span className="ml-2 text-xs font-bold text-slate-700">Tiene Préstamo Activo</span>
                        </label>
                      </div>

                      {editHasLoan ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/20 p-4 rounded-2xl border border-indigo-100/30">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Monto del Préstamo (COP)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                              <input
                                type="number"
                                required={editHasLoan}
                                value={editMonto}
                                onChange={(e) => setEditMonto(e.target.value)}
                                className="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl pl-7 pr-3.5 py-2 text-sm outline-none transition-all font-semibold"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Tasa Interés Mensual (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              required={editHasLoan}
                              value={editTasa}
                              onChange={(e) => setEditTasa(e.target.value)}
                              className="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-semibold"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Plazo (Meses)</label>
                            <input
                              type="number"
                              required={editHasLoan}
                              value={editPlazo}
                              onChange={(e) => setEditPlazo(e.target.value)}
                              className="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-semibold"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Fecha de Inicio</label>
                            <input
                              type="date"
                              required={editHasLoan}
                              value={editFechaInicio}
                              onChange={(e) => setEditFechaInicio(e.target.value)}
                              className="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-semibold"
                            />
                          </div>

                          <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-bold text-slate-500">Estado de Pago del Crédito</label>
                            <select
                              value={editEstadoLoan}
                              onChange={(e) => setEditEstadoLoan(e.target.value as any)}
                              className="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-bold text-slate-700"
                            >
                              <option value="vigente">Vigente (Al día)</option>
                              <option value="atrasado">Atrasado (En Mora)</option>
                              <option value="cancelado">Cancelado (Paz y Salvo)</option>
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">
                              ⚠️ Advertencia: Si cambias Monto, Tasa, Plazo o Fecha de Inicio, se regenerará por completo el cronograma de cuotas (perdiendo el historial de cuotas pagadas anteriormente para este préstamo). Si solo cambias el Estado de Pago, las cuotas existentes se conservarán.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 italic text-xs font-medium">
                          Este afiliado no tendrá ningún préstamo asignado. Al guardar se eliminará cualquier préstamo asociado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const target = editingClient;
                        setEditingClient(null);
                        setClientToDelete(target);
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 font-bold py-2.5 px-4 rounded-xl transition-all text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar Usuario</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingClient(null)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all text-sm cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-purple-500/15 transition-all text-sm cursor-pointer"
                      >
                        Guardar Cambios
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- CONFIRMACIÓN DE LIMPIEZA / LIMPIAR CASA --- */}
        <AnimatePresence>
          {showWipeConfirmType !== null && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-red-50">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 uppercase">
                      Confirmar Operación de Limpieza
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                      Acción Crítica e Irreversible
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                    <p>
                      Estás a punto de eliminar permanentemente de la plataforma:
                    </p>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-700">
                      {showWipeConfirmType === 'all' && (
                        <span>🔥 TODOS los afiliados ({clients.length}) y toda la cartera de créditos</span>
                      )}
                      {showWipeConfirmType === 'canceled' && (
                        <span>✅ Afiliados con créditos totalmente pagados/liquidados ({clients.filter(c => c.prestamo && c.prestamo.estado === 'cancelado').length})</span>
                      )}
                      {showWipeConfirmType === 'selective' && (
                        <span>📌 Los {selectiveWipeSelected.length} afiliados seleccionados de la lista</span>
                      )}
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-700 flex items-start gap-2">
                      <FileSpreadsheet className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                      <p>
                        <strong>Respaldo Automático:</strong> Al continuar, el sistema generará y descargará inmediatamente un archivo Excel conteniendo toda la información de los afiliados antes de eliminarlos.
                      </p>
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Para confirmar, escribe la palabra <span className="text-red-600 font-black tracking-widest bg-red-50 px-1.5 py-0.5 rounded">CONFIRMAR</span> en el cuadro inferior:
                    </p>
                  </div>

                  <input
                    type="text"
                    placeholder="Escribe CONFIRMAR..."
                    value={wipeConfirmPhrase}
                    onChange={(e) => setWipeConfirmPhrase(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all font-black text-center text-red-600 tracking-wider placeholder:tracking-normal placeholder:font-normal"
                  />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWipeConfirmType(null);
                      setWipeConfirmPhrase('');
                    }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-xl transition-all text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handlePerformWipe}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl shadow-md shadow-red-600/15 transition-all text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar y Descargar Respaldo</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- MODAL DE CONFIRMACIÓN PARA ELIMINAR UN USUARIO INDIVIDUAL --- */}
        <AnimatePresence>
          {clientToDelete && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-red-50">
                  <div className="p-2.5 bg-red-100 text-red-600 rounded-2xl shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Eliminar Afiliado
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Esta acción eliminará al usuario permanentemente.
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    ¿Estás seguro de que deseas eliminar a <strong className="text-slate-900 font-bold">{clientToDelete.nombre}</strong> (C.C. <span className="font-mono text-slate-600">{clientToDelete.cedula}</span>)?
                  </p>

                  {clientToDelete.prestamo && (
                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p>
                        Este usuario tiene un préstamo asociado. Al eliminarlo se borrarán también todos sus datos de crédito y cuotas.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setClientToDelete(null)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-xl transition-all text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSingleClient(clientToDelete.cedula)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-red-600/15 transition-all text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Usuario</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
