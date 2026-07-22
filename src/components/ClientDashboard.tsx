/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  ArrowUpRight,
  HelpCircle,
  Send,
  MessageCircle,
  FileText,
  AlertTriangle,
  Calendar,
  DollarSign,
  Award,
  Smile,
  LogOut,
  MapPin,
  Mail,
  Phone,
  Percent,
  Sparkles,
  User,
  Landmark,
  ShieldCheck,
  Bell,
  ChevronDown,
  CreditCard,
  Wifi,
  KeyRound,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { Client, UserSession, Installment, Message } from '../types';
import { formatCurrency, saveDatabase } from '../utils';

interface ClientDashboardProps {
  session: UserSession;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onLogout: () => void;
  syncError?: string | null;
}

export default function ClientDashboard({ session, clients, setClients, onLogout, syncError }: ClientDashboardProps) {
  // Find current client profile in reactive database
  const clientData = useMemo(() => {
    return clients.find((c) => c.cedula === session.cedula) || null;
  }, [clients, session]);

  const [requestedAmount, setRequestedAmount] = useState<number>(2000000); // Default to $2,000,000 COP
  const [activeTab, setActiveTab] = useState<'summary' | 'schedule' | 'simulator'>('summary');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);
  const [dropdownTab, setDropdownTab] = useState<'profile' | 'notifications'>('profile');
  const [typedMessage, setTypedMessage] = useState('');

  // Password change and first-time announcement states
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [showFirstTimeAd, setShowFirstTimeAd] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  useEffect(() => {
    if (clientData && clientData.montoMaximo && requestedAmount > clientData.montoMaximo) {
      setRequestedAmount(clientData.montoMaximo);
    }
  }, [clientData, requestedAmount]);

  useEffect(() => {
    if (clientData && clientData.contrasena === clientData.cedula) {
      const hasSeen = sessionStorage.getItem(`seen_pw_ad_${clientData.cedula}`);
      if (!hasSeen) {
        setShowFirstTimeAd(true);
      }
    }
  }, [clientData]);

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(false);

    if (!clientData) return;

    if (currentPasswordInput !== clientData.contrasena) {
      setPasswordChangeError('La contraseña actual es incorrecta.');
      return;
    }

    if (newPasswordInput.trim().length < 4) {
      setPasswordChangeError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (newPasswordInput === clientData.cedula) {
      setPasswordChangeError('La nueva contraseña no puede ser tu número de cédula por motivos de seguridad.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordChangeError('La confirmación de la contraseña no coincide.');
      return;
    }

    // Success! Update password in the clients list
    const updatedClients = clients.map((c) => {
      if (c.cedula === clientData.cedula) {
        return {
          ...c,
          contrasena: newPasswordInput.trim(),
        };
      }
      return c;
    });

    setClients(updatedClients);
    saveDatabase(updatedClients);

    setPasswordChangeSuccess(true);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');

    // Auto close modal after 2.5 seconds
    setTimeout(() => {
      setShowPasswordChangeModal(false);
      setPasswordChangeSuccess(false);
    }, 2500);
  };

  const unreadCount = useMemo(() => {
    if (!clientData || !clientData.notificaciones) return 0;
    return clientData.notificaciones.filter(n => !n.leido).length;
  }, [clientData]);

  const initials = useMemo(() => {
    if (!clientData) return 'C';
    const parts = clientData.nombre.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [clientData]);

  // Loan status computations
  const loanStats = useMemo(() => {
    if (!clientData || !clientData.prestamo) return null;
    const loan = clientData.prestamo;

    const originalCapital = loan.montoOriginal;
    const rate = loan.tasaInteresMensual;
    const term = loan.plazoMeses;

    // Sum total paid and outstanding
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalInterest = 0;
    
    loan.cuotas.forEach((c) => {
      totalInterest += c.interes;
      if (c.pagado) {
        totalPaid += c.montoTotal;
      } else {
        totalOutstanding += c.montoTotal;
      }
    });

    const paidCount = loan.cuotas.filter((c) => c.pagado).length;
    const progressPct = Math.round((paidCount / term) * 100);

    const nextPaymentCuota = loan.cuotas.find((c) => !c.pagado);
    const nextPaymentDate = nextPaymentCuota ? nextPaymentCuota.fechaVencimiento : 'Saldado';
    const nextPaymentAmount = nextPaymentCuota ? nextPaymentCuota.montoTotal : 0;

    return {
      originalCapital,
      totalInterest,
      term,
      totalPaid,
      totalOutstanding,
      progressPct,
      paidCount,
      nextPaymentDate,
      nextPaymentAmount,
      estado: loan.estado,
    };
  }, [clientData]);

  // Compute days stats for the current installment cycle
  const daysStats = useMemo(() => {
    if (!clientData || !clientData.prestamo) return null;
    const loan = clientData.prestamo;
    
    // Find next unpaid cuota
    const unpaidCuotas = loan.cuotas.filter((c) => !c.pagado);
    if (unpaidCuotas.length === 0) {
      return { totalDays: 30, elapsedDays: 30, daysRemaining: 0, pct: 100, nextCuotaNum: loan.cuotas.length };
    }
    
    const nextCuota = unpaidCuotas[0];
    
    // Period start date is either the last paid cuota's date, or the loan start date
    const paidCuotas = loan.cuotas.filter((c) => c.pagado);
    let periodStartStr = loan.fechaInicio;
    if (paidCuotas.length > 0) {
      const lastPaid = paidCuotas[paidCuotas.length - 1];
      periodStartStr = lastPaid.fechaVencimiento;
    }
    
    // Calculate difference
    const startParts = periodStartStr.split('-').map(Number);
    const dueParts = nextCuota.fechaVencimiento.split('-').map(Number);
    
    // Use Date.UTC to avoid local timezone offsets
    const startDateObj = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
    const dueDateObj = new Date(Date.UTC(dueParts[0], dueParts[1] - 1, dueParts[2]));
    
    // Current date - normalize to UTC midnight
    const todayRaw = new Date();
    const todayObj = new Date(Date.UTC(todayRaw.getFullYear(), todayRaw.getMonth(), todayRaw.getDate()));
    
    // Total days in the current cycle
    const totalDiffMs = dueDateObj.getTime() - startDateObj.getTime();
    const totalDays = Math.max(1, Math.round(totalDiffMs / (1000 * 60 * 60 * 24)));
    
    // Days remaining until due date
    const remainingDiffMs = dueDateObj.getTime() - todayObj.getTime();
    const daysRemaining = Math.max(0, Math.round(remainingDiffMs / (1000 * 60 * 60 * 24)));
    
    // Days elapsed
    const elapsedDays = Math.max(0, totalDays - daysRemaining);
    
    // Percentage
    const pct = Math.round((elapsedDays / totalDays) * 100);
    
    return {
      totalDays,
      elapsedDays,
      daysRemaining,
      pct,
      nextCuotaNum: nextCuota.numero,
    };
  }, [clientData]);

  // WhatsApp Preconfigured Message templates
  const openWhatsAppTemplate = (type: 'consulta' | 'nuevo_credito' | 'reportar_pago') => {
    if (!clientData) return;

    const nombre = clientData.nombre;
    const cedula = clientData.cedula;
    const adminPhone = '573001234567'; // Default administrative number

    let text = '';
    if (type === 'consulta') {
      text = `Hola CrediULEP, soy ${nombre} con Cédula ${cedula}. Deseo consultar el estado general de mi cuenta.`;
    } else if (type === 'nuevo_credito') {
      if (loanStats && loanStats.estado !== 'cancelado') {
        return; // Disabled if active debt
      }
      text = `Hola CrediULEP, soy ${nombre} con Cédula ${cedula}. He cancelado mi deuda anterior y me encuentro a paz y salvo. Solicito formalmente el estudio de un nuevo financiamiento.`;
    } else if (type === 'reportar_pago') {
      const nextCuotaNum = loanStats ? loanStats.paidCount + 1 : 1;
      const totalCuotas = loanStats ? loanStats.term : 12;
      const cuotaAmount = loanStats ? loanStats.nextPaymentAmount : 0;
      const originalAmount = loanStats ? loanStats.originalCapital : 0;
      const remainingBalance = loanStats ? loanStats.totalOutstanding : 0;
      
      text = `¡Hola CrediULEP! 👋\n\n*REPORTE DE PAGO DE CUOTA*\n\n` +
             `• *Socio:* ${nombre}\n` +
             `• *Cédula:* ${cedula}\n` +
             `• *Monto Solicitado:* ${formatCurrency(originalAmount)}\n` +
             `• *Cuota a Pagar:* Cuota #${nextCuotaNum} de ${totalCuotas}\n` +
             `• *Valor de la Cuota:* ${formatCurrency(cuotaAmount)}\n` +
             `• *Saldo Pendiente:* ${formatCurrency(remainingBalance)}\n\n` +
             `Deseo reportar el pago de mi cuota. A continuación adjunto el comprobante correspondiente para su validación en el sistema.`;
    }

    const url = `https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noreferrer');
  };

  const openWhatsAppCreditRequest = (amount: number) => {
    if (!clientData) return;

    // Safety check: if they have an active loan (not paz y salvo), they cannot request/simulate a new one
    if (clientData.prestamo && clientData.prestamo.estado !== 'cancelado') {
      return;
    }

    const nombre = clientData.nombre;
    const cedula = clientData.cedula;
    const adminPhone = '573001234567'; // Default administrative number

    const text = `Hola CrediULEP, soy ${nombre} con Cédula ${cedula}. Me encuentro a paz y salvo y deseo solicitar formalmente un nuevo crédito por valor de ${formatCurrency(amount)}. Quedo atento a los requisitos y al estudio de mi solicitud. ¡Muchas gracias!`;

    const url = `https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noreferrer');
  };

  const handleSendMessage = () => {
    if (!typedMessage.trim() || !clientData) return;
    const newMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      remitente: 'cliente',
      texto: typedMessage.trim(),
      fecha: new Date().toISOString()
    };
    
    setClients((prevClients) => {
      return prevClients.map((c) => {
        if (c.cedula === clientData.cedula) {
          const currentMsgs = c.mensajes || [];
          return {
            ...c,
            mensajes: [...currentMsgs, newMsg]
          };
        }
        return c;
      });
    });
    
    setTypedMessage('');
  };

  if (!clientData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">No se pudo cargar tu perfil</h2>
        <p className="text-slate-500 mt-2 max-w-sm">
          No encontramos un afiliado correspondiente a tu número de cédula.
        </p>
        <button
          onClick={onLogout}
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
        >
          Volver al Login
        </button>
      </div>
    );
  }

  const renderSimulator = () => {
    return (
      <div className="bg-white border border-purple-100 p-6 rounded-3xl shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Simulador Financiero CrediULEP</h3>
          <p className="text-xs text-slate-400">Ajusta el monto del desembolso para cotizar el plan de cuotas correspondiente</p>
        </div>

        {/* Slider Panel */}
        <div className="p-6 bg-purple-50/30 rounded-2xl border border-purple-100/50 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">
              Monto de Financiamiento
            </span>
            <span className="text-[10px] font-mono text-purple-600 font-bold bg-white px-2.5 py-1 rounded-lg border border-purple-100/60 shadow-sm">
              Paso: $100K COP
            </span>
          </div>

          <div className="text-center py-2 bg-white rounded-2xl border border-purple-100/30 shadow-inner">
            <span className="text-3xl font-black text-slate-900 tracking-tight font-mono">
              {formatCurrency(requestedAmount)}
            </span>
          </div>

          <div className="space-y-1">
            <input
              type="range"
              min="500000"
              max={clientData?.montoMaximo || 10000000}
              step="100000"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(Number(e.target.value))}
              className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              id="amount-slider-tab"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold font-mono">
              <span>{formatCurrency(500000)}</span>
              <span>{formatCurrency(clientData?.montoMaximo || 10000000)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-dashed border-purple-200/60 flex items-center justify-between text-xs text-purple-950 font-bold">
            <span className="opacity-80">Cuota Fija Mensual Estimada (12 meses):</span>
            <span className="font-mono text-purple-700 text-sm font-black bg-white px-3 py-1.5 rounded-xl border border-purple-100/50 shadow-sm">
              {formatCurrency(Math.round((requestedAmount * 1.18) / 12))} / mes
            </span>
          </div>
        </div>

        {/* Primary Solicitation Button */}
        <motion.button
          whileHover={{ scale: 1.02, translateY: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => openWhatsAppCreditRequest(requestedAmount)}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-2xl shadow-lg shadow-purple-500/10 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <span className="block font-black text-sm">Desembolsar Crédito Simulado</span>
              <span className="block text-[10px] text-purple-100">Envía tu propuesta de amortización por WhatsApp</span>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-white/90" />
        </motion.button>
      </div>
    );
  };

  const isPazYSalvo = !clientData.prestamo || clientData.prestamo.estado === 'cancelado';

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800" id="client-root">
      {/* Client Header bar */}
      <nav className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30" id="client-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-purple-800 flex items-center justify-center font-black text-white shadow-md shadow-purple-500/20 text-xs shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 block leading-tight">
                  ¡Hola, {clientData.nombre}!
                </span>
                <span className="relative flex h-2 w-2 mt-0.5" title={syncError ? 'Base de datos offline' : 'Base de datos conectada'} id="client-db-light">
                  {syncError ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"></span>
                    </>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"></span>
                    </>
                  )}
                </span>
              </div>
              <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wider block leading-none mt-0.5">Socio Certificado</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 relative">
            {/* Standalone Notification Bell Button */}
            <button
              onClick={() => {
                if (showUserDropdown && dropdownTab === 'notifications') {
                  setShowUserDropdown(false);
                } else {
                  setShowUserDropdown(true);
                  setDropdownTab('notifications');
                }
              }}
              className="relative p-2.5 text-slate-400 hover:text-purple-600 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all cursor-pointer focus:outline-none flex items-center justify-center shrink-0"
              title="Notificaciones"
              id="client-notification-bell"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-600"></span>
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (showUserDropdown && dropdownTab === 'profile') {
                  setShowUserDropdown(false);
                } else {
                  setShowUserDropdown(true);
                  setDropdownTab('profile');
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all text-left cursor-pointer focus:outline-none"
              id="client-profile-dropdown-trigger"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/10">
                  <User className="w-4 h-4" />
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${showUserDropdown && dropdownTab === 'profile' ? 'rotate-180 text-purple-600' : ''}`} />
            </button>

            {/* Floating Dropdown Panel */}
            <AnimatePresence>
              {showUserDropdown && (
                <>
                  {/* Backdrop with premium blur effect */}
                  <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     transition={{ duration: 0.2 }}
                     className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm z-40 cursor-default" 
                     onClick={() => setShowUserDropdown(false)} 
                  />
                  
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-[340px] sm:w-[390px] bg-white border border-slate-100 rounded-3xl shadow-xl shadow-purple-100/40 overflow-hidden z-50 flex flex-col"
                    id="client-dropdown-panel"
                  >
                    {dropdownTab === 'profile' ? (
                      <>
                        {/* Compact Profile Header */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-purple-500/10">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-black text-slate-800 leading-tight truncate">{clientData.nombre}</h3>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">C.C. {clientData.cedula}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black rounded-full border border-emerald-100/50 uppercase tracking-wider shrink-0">
                            <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                            Socio Activo
                          </span>
                        </div>

                        {/* Content area */}
                        <div className="p-4 max-h-[380px] overflow-y-auto custom-scrollbar">
                          <div className="space-y-4">
                            {/* Datos Personales Normales */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Identificación Personal</span>
                                <span className="text-[9px] bg-purple-50 text-purple-700 font-extrabold px-2.5 py-0.5 rounded-md border border-purple-100 uppercase tracking-wider">
                                  Miembro Activo
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-500">Nombre Completo</span>
                                  <span className="font-extrabold text-slate-800 text-right uppercase tracking-tight">{clientData.nombre}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-500">Documento</span>
                                  <span className="font-mono font-extrabold text-slate-800 text-right">C.C. {clientData.cedula}</span>
                                </div>
                              </div>
                            </div>

                            {/* Personal and Bank accounts information list */}
                            <div className="space-y-2.5 text-xs">
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-150 pb-1.5">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Cuenta para Desembolsos</span>
                                  <span className="text-[8px] bg-purple-50 text-purple-700 font-extrabold px-2 py-0.5 rounded border border-purple-100 uppercase">
                                    {clientData.banco || 'N/A'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="font-bold text-slate-500">Número de Cuenta</span>
                                  <span className="font-mono font-extrabold text-slate-800">
                                    {clientData.numeroCuenta || 'No registrada'}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1.5 px-0.5">
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/50">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <Phone className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="font-bold">Celular</span>
                                  </div>
                                  <span className="font-bold text-slate-700 font-mono">{clientData.telefono}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/50">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <Mail className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="font-bold">Correo</span>
                                  </div>
                                  <span className="font-bold text-slate-700 break-all text-right max-w-[180px] truncate" title={clientData.correo}>
                                    {clientData.correo}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/50">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <MapPin className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="font-bold">Dirección</span>
                                  </div>
                                  <span className="font-semibold text-slate-600 text-right truncate max-w-[180px]" title={clientData.direccion}>
                                    {clientData.direccion}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Botón Cambiar Contraseña */}
                            <div className="pt-2 border-t border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowUserDropdown(false);
                                  setPasswordChangeError(null);
                                  setPasswordChangeSuccess(false);
                                  setCurrentPasswordInput('');
                                  setNewPasswordInput('');
                                  setConfirmPasswordInput('');
                                  setShowPasswordChangeModal(true);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl transition-all border border-purple-200/50 cursor-pointer active:scale-[0.98]"
                              >
                                <KeyRound className="w-4 h-4" />
                                <span>Cambiar Contraseña</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Footer logout button */}
                        <div className="bg-slate-50 border-t border-slate-100 p-3 flex flex-col gap-2">
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              onLogout();
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold text-xs rounded-xl transition-all border border-slate-200 hover:border-red-150 cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Cerrar Sesión</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Compact Notification Header */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-purple-600" />
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Notificaciones</h3>
                          </div>
                          {unreadCount > 0 && (
                            <span className="bg-purple-100 text-purple-800 text-[9px] font-black px-2.5 py-0.5 rounded-full">
                              {unreadCount} nuevas
                             </span>
                          )}
                        </div>

                        {/* Content area */}
                        <div className="p-4 max-h-[380px] overflow-y-auto custom-scrollbar">
                          <div className="space-y-2.5">
                            {(!clientData.notificaciones || clientData.notificaciones.length === 0) ? (
                              <div className="bg-slate-50/50 p-6 rounded-xl text-center text-xs text-slate-400 font-medium italic border border-dashed border-slate-200">
                                No tienes comunicados o alertas pendientes.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {clientData.notificaciones.map((notif) => (
                                  <div
                                    key={notif.id}
                                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 text-[11px] ${
                                      notif.leido 
                                        ? 'bg-slate-50/50 border-slate-100 text-slate-500' 
                                        : 'bg-purple-50/20 border-purple-100 text-slate-800 shadow-sm'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-1">
                                          {!notif.leido && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0 animate-pulse" />
                                          )}
                                          <h4 className="font-black tracking-tight leading-tight">{notif.titulo}</h4>
                                        </div>
                                        <span className="text-[8px] font-bold text-slate-400 shrink-0">
                                          {new Date(notif.fecha).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <p className="font-medium leading-relaxed">{notif.mensaje}</p>
                                    </div>
                                    
                                    {!notif.leido && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedClients = clients.map(c => {
                                            if (c.cedula === clientData.cedula) {
                                              return {
                                                ...c,
                                                notificaciones: (c.notificaciones || []).map(n => 
                                                  n.id === notif.id ? { ...n, leido: true } : n
                                                )
                                              };
                                            }
                                            return c;
                                          });
                                          setClients(updatedClients);
                                          saveDatabase(updatedClients);
                                        }}
                                        className="self-end text-[9px] font-black text-purple-750 hover:text-purple-800 cursor-pointer bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-all border border-purple-200/35"
                                      >
                                        Marcar como leída
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {/* Main client workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="client-main">
        {/* Welcome Jumbotron Card (now simple and clean brand banner) */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-purple-100 rounded-3xl p-6 md:p-8 shadow-lg shadow-purple-100/30 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
          id="client-welcome-card"
        >
          {/* Decorative glows */}
          <div className="absolute top-[-50%] left-[-20%] w-96 h-96 bg-purple-50/30 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-50%] right-[-10%] w-96 h-96 bg-violet-50/20 rounded-full blur-[100px] pointer-events-none" />

          {/* Left Side: CrediULEP Logo branding */}
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-purple-800 flex items-center justify-center font-black text-white shrink-0 shadow-md shadow-purple-500/25">
              <span className="text-xl">C</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900 block leading-tight">CrediULEP Oficial</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider rounded border border-emerald-200/40">
                  Conectado
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1 font-semibold">
                Portal de Servicios Financieros y Afiliados. Revisa el estado de tu amortización interactiva abajo.
              </p>
            </div>
          </div>
        </motion.section>

        {/* ----------------- CASE: ACTIVE LOAN ----------------- */}
        {!isPazYSalvo && loanStats && clientData.prestamo && (
          <div className="space-y-12" id="client-active-loan-section">
            {/* 1. Resumen General */}
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  Resumen General
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              
              {/* 1. Interactive Dual-Ring Credit Progress Circle */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-purple-100 p-6 rounded-3xl shadow-lg shadow-purple-100/30 relative overflow-hidden flex flex-col items-center justify-center space-y-6"
                id="digital-loan-progress-circle-card"
              >
                {/* Decorative gradients */}
                <div className="absolute top-[-20%] left-[-20%] w-48 h-48 bg-purple-50/50 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-20%] w-48 h-48 bg-emerald-50/40 rounded-full blur-3xl pointer-events-none" />

                {/* Card Top: Branding */}
                <div className="w-full flex items-center justify-between border-b border-slate-50 pb-3 relative z-10">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Resumen de tu Crédito</span>
                    <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Plan Activo • CrediULEP</span>
                  </div>
                  <div className="px-2.5 py-0.5 rounded bg-purple-50/60 text-purple-600 text-[9px] font-bold font-mono border border-purple-100/40">
                    C.C. {clientData.cedula}
                  </div>
                </div>

                {/* SVG Concentric Rings */}
                <div className="relative flex items-center justify-center h-[200px] w-[200px] z-10">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                    <defs>
                      <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                      <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>

                    {/* Outer Ring: Loan Installments Progress (Monto/Cuotas) */}
                    {/* Background track */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="10"
                    />
                    {/* Active progress */}
                    <motion.circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="transparent"
                      stroke="url(#purpleGrad)"
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 80}
                      initial={{ strokeDashoffset: 2 * Math.PI * 80 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 80 - (2 * Math.PI * 80 * (loanStats?.progressPct || 0)) / 100 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      strokeLinecap="round"
                    />

                    {/* Inner Ring: Current Cycle Progress in Days */}
                    {/* Background track */}
                    <circle
                      cx="100"
                      cy="100"
                      r="60"
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="8"
                    />
                    {/* Active progress */}
                    <motion.circle
                      cx="100"
                      cy="100"
                      r="60"
                      fill="transparent"
                      stroke="url(#emeraldGrad)"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 60}
                      initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 60 - (2 * Math.PI * 60 * (daysStats ? daysStats.pct : 0)) / 100 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Centered text within circle */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Saldo Pendiente</span>
                    <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight mt-0.5">
                      {formatCurrency(loanStats.totalOutstanding)}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5 bg-purple-50/50 px-2.5 py-1 rounded-full border border-purple-100/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block animate-pulse" />
                      <span className="text-[9px] font-bold text-purple-700 tracking-wide">
                        {loanStats.paidCount} de {loanStats.term} Cuotas
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ring Explanations and stats */}
                <div className="w-full grid grid-cols-2 gap-4 pt-4 border-t border-slate-50 relative z-10 text-left">
                  {/* Outer Ring Legend */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400 block shrink-0" />
                      <span className="text-[11px] font-bold text-slate-700 tracking-wide">Monto Pagado</span>
                    </div>
                    <div className="pl-3.5">
                      <span className="block text-[8px] text-slate-400 uppercase font-bold tracking-wider">Crédito Solicitado</span>
                      <span className="block font-mono text-xs font-bold text-slate-800">{formatCurrency(loanStats.originalCapital)}</span>
                      <span className="block text-[9px] text-purple-600 font-medium mt-0.5">{loanStats.progressPct}% Amortizado</span>
                    </div>
                  </div>

                  {/* Inner Ring Legend */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 block shrink-0" />
                      <span className="text-[11px] font-bold text-slate-700 tracking-wide">Días de Cuota</span>
                    </div>
                    <div className="pl-3.5">
                      <span className="block text-[8px] text-slate-400 uppercase font-bold tracking-wider">Tiempo Transcurrido</span>
                      <span className="block font-mono text-xs font-bold text-slate-800">
                        {daysStats?.elapsedDays} de {daysStats?.totalDays} días
                      </span>
                      {daysStats && (
                        <span className={`block text-[9px] font-bold uppercase mt-1 px-1.5 py-0.5 rounded-md inline-block border text-center ${
                          daysStats.daysRemaining === 0 
                            ? 'bg-rose-50 text-rose-600 border-rose-100/40' 
                            : daysStats.daysRemaining <= 5 
                              ? 'bg-amber-50 text-amber-600 border-amber-100/40' 
                              : 'bg-emerald-50 text-emerald-600 border-emerald-100/40'
                        }`}>
                          {daysStats.daysRemaining === 0 ? '¡Vence Hoy!' : `Faltan ${daysStats.daysRemaining} días`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* 2. Bill Payment Status Desk */}
              <div className="bg-white border border-purple-100 p-6 rounded-3xl shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Estado de Facturación</h3>
                    <p className="text-[10px] text-slate-400">Próximos compromisos pactados</p>
                  </div>
                  {loanStats.estado === 'atrasado' ? (
                    <span className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded-lg border border-red-100 uppercase tracking-wider">
                      Mora Detectada
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-lg border border-green-100 uppercase tracking-wider">
                      Vigente
                    </span>
                  )}
                </div>

                {loanStats.nextPaymentAmount > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Total de Cuota</span>
                        <span className={`text-2xl font-black mt-1 font-mono block ${loanStats.estado === 'atrasado' ? 'text-red-600' : 'text-purple-600'}`}>
                          {formatCurrency(loanStats.nextPaymentAmount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Límite de Pago</span>
                        <span className="block font-mono font-extrabold text-sm text-slate-700 mt-1">{loanStats.nextPaymentDate}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1 text-slate-500">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Progreso del Crédito
                        </span>
                        <span className="text-purple-700">{loanStats.paidCount} / {loanStats.term} Cuotas</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full transition-all duration-1000"
                          style={{ width: `${loanStats.progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Pay Cuota WhatsApp Trigger */}
                    <motion.button
                      whileHover={{ scale: 1.02, translateY: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => openWhatsAppTemplate('reportar_pago')}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-2xl font-bold shadow-md shadow-purple-500/10 transition-all text-sm cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Pagar</span>
                    </motion.button>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-800">No tienes cuotas pendientes de pago</p>
                    <p className="text-xs text-slate-400 mt-0.5">Te encuentras totalmente al día.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        {/* End of 1. Resumen General */}

        {/* 2. Cronograma de Pagos */}
        <div className="space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Cronograma de Pagos
            </h2>
          </div>
          <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Right Column (originally 7 of 12 cols): Interactive Timeline Cronogram */}
          
          <div className="bg-white border border-purple-100 p-6 rounded-3xl shadow-sm space-y-6">
            
            {/* Cronogram Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Cronograma de Amortización</h3>
                    <p className="text-xs text-slate-400">Desglose secuencial de cuotas generadas por la entidad</p>
                  </div>
                  
                  {/* Action Print */}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200/50"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Imprimir Extracto</span>
                  </motion.button>
                </div>

                {/* Interactive Status Tab Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-100 shrink-0 w-fit">
                  <button
                    onClick={() => setPaymentFilter('all')}
                    className={`px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      paymentFilter === 'all'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setPaymentFilter('pending')}
                    className={`px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      paymentFilter === 'pending'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Pendientes
                  </button>
                  <button
                    onClick={() => setPaymentFilter('paid')}
                    className={`px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      paymentFilter === 'paid'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Pagadas
                  </button>
                </div>

                {/* Scrollable payments list */}
                <div className="relative pl-6 border-l border-purple-100 space-y-5" id="client-timeline">
                  {clientData.prestamo.cuotas
                    .filter((cuota) => {
                      if (paymentFilter === 'pending') return !cuota.pagado;
                      if (paymentFilter === 'paid') return cuota.pagado;
                      return true;
                    })
                    .map((cuota, index, arr) => {
                      // Find if this is the immediate active next cuota
                      const isNextToPay = !cuota.pagado && (
                        index === 0 || 
                        clientData.prestamo!.cuotas.find(c => c.numero === cuota.numero - 1)?.pagado === true
                      );
                      
                      return (
                        <div key={cuota.id} className="relative group">
                          {/* Bullet indicators */}
                          <div className={`absolute left-[-31px] top-1.5 w-4 h-4 rounded-full border-2 transition-transform duration-300 ${
                            cuota.pagado
                              ? 'bg-emerald-500 border-emerald-500 scale-110 shadow-lg shadow-emerald-500/20'
                              : isNextToPay
                              ? 'bg-purple-600 border-purple-600 scale-125 animate-pulse shadow-lg shadow-purple-600/20'
                              : 'bg-white border-slate-300'
                          }`} />

                          <div className={`p-4 rounded-2xl border transition-all ${
                            cuota.pagado
                              ? 'bg-slate-50/50 border-slate-100 opacity-85'
                              : isNextToPay
                              ? 'bg-purple-50/20 border-purple-150 shadow-md shadow-purple-500/5'
                              : 'bg-white border-slate-100'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                                  cuota.pagado
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/50'
                                    : isNextToPay
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                  Cuota {cuota.numero}
                                </span>
                                <div>
                                  <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Fecha Vencimiento</span>
                                  <span className="block font-mono text-sm font-bold text-slate-700 mt-0.5">{cuota.fechaVencimiento}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-6 justify-between sm:justify-end">
                                <div className="text-right">
                                  <span className="block text-[9px] text-slate-400 uppercase font-bold">Valor Cuota</span>
                                  <span className="block text-sm font-extrabold text-slate-800 mt-0.5 font-mono">{formatCurrency(cuota.montoTotal)}</span>
                                </div>

                                <div className="text-right">
                                  <span className="block text-[9px] text-slate-400 uppercase font-bold">Estado</span>
                                  {cuota.pagado ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Pagada ({cuota.fechaPago})
                                    </span>
                                  ) : isNextToPay ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 mt-1">
                                      <Clock className="w-3.5 h-3.5 animate-spin-slow" />
                                      Siguiente
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-1">
                                      Futura
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {clientData.prestamo.cuotas.length === 0 && (
                    <div className="py-8 text-center text-slate-400 font-medium">
                      No hay cuotas programadas para mostrar.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* End of 2. Cronograma de Pagos */}
          </div>
        )}

        {/* ----------------- CASE: NO LOAN OR FULLY CANCELLED ----------------- */}
        {isPazYSalvo && (
          <div className="space-y-12" id="client-no-loan-section">
            {/* 1. Resumen General */}
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  Resumen General
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              
              {/* 1. Pre-Approved Circular Credit Meter */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-purple-100 p-6 rounded-3xl shadow-lg shadow-purple-100/30 relative overflow-hidden flex flex-col items-center justify-center space-y-6"
                id="digital-preapproved-circle-card"
              >
                {/* Decorative gradients */}
                <div className="absolute top-[-20%] left-[-20%] w-48 h-48 bg-emerald-50/50 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-20%] w-48 h-48 bg-purple-50/40 rounded-full blur-3xl pointer-events-none" />

                {/* Card Top */}
                <div className="w-full flex items-center justify-between border-b border-slate-50 pb-3 relative z-10">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Cupo de Crédito</span>
                    <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Pre-Aprobado • CrediULEP</span>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold font-mono border border-emerald-100">
                    Excelente
                  </div>
                </div>

                {/* SVG Concentric Rings */}
                <div className="relative flex items-center justify-center h-[200px] w-[200px] z-10">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                    <defs>
                      <linearGradient id="emeraldGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>

                    {/* Single Outer Ring representing 100% credit capacity */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="transparent"
                      stroke="#e2e8f0"
                      strokeWidth="10"
                    />
                    <motion.circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="transparent"
                      stroke="url(#emeraldGrad2)"
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 80}
                      initial={{ strokeDashoffset: 2 * Math.PI * 80 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      strokeLinecap="round"
                    />
                  </svg>

                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Disponible</span>
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                      {clientData ? formatCurrency(clientData.montoMaximo ?? 10000000) : "$10,000,000"}
                    </span>
                    <div className="flex items-center gap-1 mt-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      <span className="text-[8px] font-black text-emerald-700 uppercase tracking-wider">
                        100% Disponible
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full text-center space-y-1 pt-2 border-t border-slate-50 relative z-10 text-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Titular de Cuenta</span>
                  <p className="font-bold text-slate-800 text-sm tracking-wide uppercase">{clientData.nombre}</p>
                </div>
              </motion.div>

              {/* 2. Paz y Salvo Status Certificate */}
              <div className="bg-white border border-purple-100 p-6 rounded-3xl shadow-sm text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <Award className="w-7 h-7" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-slate-900">Estado de Cuenta Limpio</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed px-4">
                    Te encuentras al día y a paz y salvo. Tu historial financiero con nosotros es sobresaliente.
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-100/50 uppercase tracking-wider">
                  <Smile className="w-3.5 h-3.5" />
                  Excelente Comportamiento
                </div>
              </div>

            </div>
          </div>
        {/* End of 1. Resumen General */}

        {/* 2. Cronograma de Pagos */}
        <div className="space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Cronograma de Pagos
            </h2>
          </div>
          <div className="max-w-2xl mx-auto py-12 text-center bg-white border border-purple-100 p-8 rounded-3xl shadow-sm space-y-6">
            <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mx-auto">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">No tienes cuotas programadas</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Te encuentras a Paz y Salvo con la cooperativa. No hay un cronograma de amortización activo en este momento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const element = document.getElementById('simulator-section');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/10 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ir al Simulador</span>
                </button>
            </div>
          </div>
          {/* End of 2. Cronograma de Pagos */}

            {/* 3. Simulador de Pagos */}
            <div className="space-y-6" id="simulator-section">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Simulador de Pagos
                </h2>
              </div>
              <div className="max-w-4xl mx-auto">
                {renderSimulator()}
              </div>
            </div>
            {/* End of 3. Simulador de Pagos */}
          </div>
        )}
      </main>

      {/* ANUNCIO EN PANTALLA: PRIMER INGRESO (CAMBIAR CONTRASEÑA) */}
      <AnimatePresence>
        {showFirstTimeAd && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Decorative top header pattern */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-purple-600 to-purple-700" />
              
              <div className="flex flex-col items-center text-center space-y-4 pt-4">
                <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 animate-bounce">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Cambia tu contraseña por seguridad</h3>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">¡Protege tu cuenta de socio!</p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                  Hemos detectado que estás ingresando por primera vez o que aún utilizas tu número de cédula como contraseña de acceso.
                  <strong className="block mt-1 text-slate-800">Por tu seguridad, te solicitamos actualizarla por una contraseña única y personalizada.</strong>
                </p>

                <div className="w-full pt-4 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem(`seen_pw_ad_${clientData?.cedula}`, 'true');
                      setShowFirstTimeAd(false);
                      setShowPasswordChangeModal(true);
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-750 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-lg shadow-purple-600/15 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Cambiar Contraseña Ahora</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem(`seen_pw_ad_${clientData?.cedula}`, 'true');
                      setShowFirstTimeAd(false);
                    }}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer border border-slate-200/60"
                  >
                    Recordar más tarde
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CAMBIO DE CONTRASEÑA */}
      <AnimatePresence>
        {showPasswordChangeModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-100 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Cambiar Contraseña de Acceso</h3>
                </div>
                {!passwordChangeSuccess && (
                  <button
                    type="button"
                    onClick={() => setShowPasswordChangeModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {passwordChangeSuccess ? (
                <div className="p-8 text-center flex flex-col items-center space-y-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 animate-pulse">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-base font-black text-slate-950">¡Cambio Exitoso!</h4>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    Tu contraseña ha sido actualizada correctamente en el sistema. Utiliza tu nueva contraseña en tu próximo inicio de sesión.
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePasswordChangeSubmit} className="p-6 space-y-4">
                  {passwordChangeError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{passwordChangeError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Contraseña Actual *</label>
                    <input
                      type="password"
                      required
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder="Ingresa tu contraseña actual"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Nueva Contraseña *</label>
                    <input
                      type="password"
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Confirmar Nueva Contraseña *</label>
                    <input
                      type="password"
                      required
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Repite tu nueva contraseña"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-500/10 transition-all text-xs tracking-wide cursor-pointer active:scale-[0.98] mt-2"
                  >
                    Guardar Nueva Contraseña
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
