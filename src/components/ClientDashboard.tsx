/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { Client, UserSession, Installment } from '../types';
import { formatCurrency } from '../utils';

interface ClientDashboardProps {
  session: UserSession;
  clients: Client[];
  onLogout: () => void;
  syncError?: string | null;
}

export default function ClientDashboard({ session, clients, onLogout, syncError }: ClientDashboardProps) {
  // Find current client profile in reactive database
  const clientData = useMemo(() => {
    return clients.find((c) => c.cedula === session.cedula) || null;
  }, [clients, session]);

  const [requestedAmount, setRequestedAmount] = useState<number>(2000000); // Default to $2,000,000 COP
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [showProfile, setShowProfile] = useState<boolean>(false);

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

    const nombre = clientData.nombre;
    const cedula = clientData.cedula;
    const adminPhone = '573001234567'; // Default administrative number

    const text = `Hola CrediULEP, soy ${nombre} con Cédula ${cedula}. Me encuentro a paz y salvo y deseo solicitar formalmente un nuevo crédito por valor de ${formatCurrency(amount)}. Quedo atento a los requisitos y al estudio de mi solicitud. ¡Muchas gracias!`;

    const url = `https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noreferrer');
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

  const isPazYSalvo = !clientData.prestamo || clientData.prestamo.estado === 'cancelado';

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800" id="client-root">
      {/* Client Header bar */}
      <nav className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30" id="client-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-purple-800 flex items-center justify-center font-bold text-white shadow-md shadow-purple-500/25">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900 block leading-tight">CrediULEP</span>
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
              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Portal Afiliados</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2.5 text-right">
              <div>
                <span className="block text-sm font-bold text-slate-800">{clientData.nombre}</span>
                <span className="block text-xs text-slate-400">ID: {clientData.cedula}</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold text-xs rounded-xl transition-all border border-slate-100 hover:border-red-100 cursor-pointer"
              id="client-logout-btn"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline-block">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main client workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="client-main">
        {/* Welcome Jumbotron Card */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-purple-100 rounded-3xl p-6 md:p-8 shadow-lg shadow-purple-100/30 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
          id="client-welcome-card"
        >
          {/* Decorative glows */}
          <div className="absolute top-[-50%] left-[-20%] w-96 h-96 bg-purple-50/30 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-50%] right-[-10%] w-96 h-96 bg-violet-50/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="flex items-center gap-5 relative z-10">
            {/* Initials Badge */}
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-2xl md:text-3xl text-white shrink-0 shadow-md shadow-purple-500/25">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  Socio Activo
                </span>
                <span className="text-purple-300 font-bold text-xs">•</span>
                <span className="text-slate-500 font-medium text-xs">Cédula: {clientData.cedula}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-1.5 leading-tight tracking-tight">
                ¡Hola, {clientData.nombre}!
              </h2>
              <p className="text-slate-600 text-xs md:text-sm mt-1.5 font-medium">
                {isPazYSalvo
                  ? 'Te encuentras al día y a paz y salvo. ¡Sigue construyendo tu futuro con nosotros!'
                  : 'Gracias por tu puntualidad. Revisa el estado de tu amortización interactiva abajo.'}
              </p>
            </div>
          </div>

          <div className="relative z-10 shrink-0 flex flex-col gap-1 items-start md:items-end">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">Contacto en Base de Datos</span>
            <span className="text-sm font-bold text-purple-700 block">{clientData.correo}</span>
            <span className="text-xs text-slate-500 block font-mono">Tel: {clientData.telefono}</span>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                showProfile
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/10'
                  : 'bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border-slate-200 hover:border-purple-200'
              }`}
              id="toggle-profile-panel-btn"
            >
              <User className="w-4 h-4" />
              <span>{showProfile ? 'Cerrar Perfil' : 'Ver Mi Perfil'}</span>
            </button>
          </div>
        </motion.section>

        {/* Panel de Perfil del Cliente */}
        <AnimatePresence>
          {showProfile && (
            <motion.section
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bg-white border border-purple-100 rounded-3xl p-6 md:p-8 shadow-lg shadow-purple-100/20 relative overflow-hidden"
              id="client-profile-panel"
            >
              {/* Decorative backgrounds */}
              <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-purple-50/40 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-emerald-50/30 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-6">
                {/* Header of Profile */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100/50">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 tracking-tight font-sans">Mi Perfil Personal & Bancario</h3>
                      <p className="text-xs text-slate-400">Verifica tus datos de contacto y de cuenta registrados en el sistema</p>
                    </div>
                  </div>
                  
                  {/* Status label */}
                  <div className="flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-xs font-semibold">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Datos Verificados</span>
                  </div>
                </div>

                {/* Profile Grid Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Col 1: Datos Personales */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-purple-500" />
                      Información de Contacto
                    </h4>
                    
                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3.5">
                      <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-slate-100/50 pb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nombre</span>
                        <span className="col-span-2 text-xs font-bold text-slate-800">{clientData.nombre}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-slate-100/50 pb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Identificación</span>
                        <span className="col-span-2 text-xs font-bold text-slate-800 font-mono">C.C. {clientData.cedula}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-slate-100/50 pb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Celular / Tel</span>
                        <span className="col-span-2 text-xs font-bold text-slate-800 font-mono">{clientData.telefono}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-slate-100/50 pb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Correo</span>
                        <span className="col-span-2 text-xs font-bold text-slate-800">{clientData.correo}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-0.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dirección</span>
                        <span className="col-span-2 text-xs font-medium text-slate-700">{clientData.direccion}</span>
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Cuenta Bancaria & Seguridad */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-purple-500" />
                      Cuenta para Desembolsos y Pagos
                    </h4>

                    <div className="bg-purple-50/20 p-5 rounded-2xl border border-purple-100/40 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-white text-purple-600 rounded-xl shadow-sm border border-purple-100/50 shrink-0">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Banco o Entidad Financiera</span>
                          <span className="block text-sm font-extrabold text-purple-900 uppercase">
                            {clientData.banco || 'No especificado'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 border-t border-purple-100/30 pt-3">
                        <div className="p-2.5 bg-white text-purple-600 rounded-xl shadow-sm border border-purple-100/50 shrink-0 font-mono text-xs font-bold">
                          N°
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número de Cuenta Registrada</span>
                          <span className="block text-sm font-mono font-bold text-slate-800">
                            {clientData.numeroCuenta || 'No registrada'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Admin notice regarding safety and edit permission */}
                    <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100/30 flex items-start gap-2.5 text-[11px] text-amber-700">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong className="font-extrabold">Aviso de seguridad:</strong> Para proteger la integridad de tus fondos, estos datos son de <span className="underline">solo lectura</span> para el afiliado. Si necesitas actualizar tu banco, número de cuenta o algún dato de contacto, por favor ponte en contacto con un asesor para que el Administrador realice la modificación.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ----------------- CASE: ACTIVE LOAN ----------------- */}
        {!isPazYSalvo && loanStats && clientData.prestamo && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="client-active-loan-section">
            
            {/* Left Column (5 of 12 cols): Banking Card, Payment Status & Support */}
            <div className="lg:col-span-5 space-y-8">
              
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
                    <button
                      onClick={() => openWhatsAppTemplate('reportar_pago')}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-2xl font-bold shadow-md shadow-purple-500/10 active:scale-[0.98] transition-all text-sm cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Pagar</span>
                    </button>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-800">No tienes cuotas pendientes de pago</p>
                    <p className="text-xs text-slate-400 mt-0.5">Te encuentras totalmente al día.</p>
                  </div>
                )}
              </div>

              {/* 3. Direct Contact Support */}
              <div className="bg-white border border-purple-100 p-6 rounded-3xl shadow-sm space-y-5">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Buzón de Atención</h3>
                  <p className="text-[10px] text-slate-400">Canales autorizados de atención e intermediación</p>
                </div>

                <div className="space-y-2.5">
                  <button
                    onClick={() => openWhatsAppTemplate('consulta')}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-purple-50/30 rounded-2xl border border-slate-100 hover:border-purple-100 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">Consulta de Movimientos</span>
                        <span className="block text-[9px] text-slate-400">Auditar saldos históricos</span>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                  </button>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[9px] font-black text-slate-400 block uppercase tracking-widest">Soporte Corporativo</span>
                    <span className="text-xs font-bold text-purple-700 block mt-1">Lunes a Sábado 8:00 AM - 6:00 PM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (7 of 12 cols): Interactive Timeline Cronogram */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="bg-white border border-purple-100 p-6 rounded-3xl shadow-sm space-y-6">
                
                {/* Cronogram Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-5">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Cronograma de Amortización</h3>
                    <p className="text-xs text-slate-400">Desglose secuencial de cuotas generadas por la entidad</p>
                  </div>
                  
                  {/* Action Print */}
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200/50"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Imprimir Extracto</span>
                  </button>
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
        )}

        {/* ----------------- CASE: NO LOAN OR FULLY CANCELLED ----------------- */}
        {isPazYSalvo && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="client-no-loan-section">
            
            {/* Left Column (5 of 12 cols): Available credit badge & support */}
            <div className="lg:col-span-5 space-y-8">
              
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

                  {/* Centered text */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Disponible</span>
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                      $5,000,000
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

              {/* 3. Help Contact Channels */}
              <div className="bg-white border border-purple-100 p-6 rounded-3xl shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Atención Corporativa</h3>
                  <p className="text-[10px] text-slate-400">¿Tienes dudas sobre tu pre-aprobado?</p>
                </div>

                <button
                  onClick={() => openWhatsAppTemplate('consulta')}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-purple-50/50 rounded-2xl border border-slate-100 hover:border-purple-100 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-100 transition-colors">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 text-xs">Asistencia Financiera</span>
                      <span className="block text-[9px] text-slate-400">Consultar requisitos</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                </button>
              </div>
            </div>

            {/* Right Column (7 of 12 cols): Interactive Credit Simulator with Live Amortization Schedule! */}
            <div className="lg:col-span-7 space-y-6">
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
                      max="10000000"
                      step="100000"
                      value={requestedAmount}
                      onChange={(e) => setRequestedAmount(Number(e.target.value))}
                      className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      id="amount-slider"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold font-mono">
                      <span>{formatCurrency(500000)}</span>
                      <span>{formatCurrency(10000000)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-dashed border-purple-200/60 flex items-center justify-between text-xs text-purple-950 font-bold">
                    <span className="opacity-80">Cuota Fija Mensual Estimada (12 meses):</span>
                    <span className="font-mono text-purple-700 text-sm font-black bg-white px-3 py-1.5 rounded-xl border border-purple-100/50 shadow-sm">
                      {formatCurrency(Math.round((requestedAmount * 1.18) / 12))} / mes
                    </span>
                  </div>
                </div>

                {/* Live Proposed Installments Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Plan de Pagos Simulado (Amortización)</h4>
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                          <th className="p-3">Cuota</th>
                          <th className="p-3">Abono Capital</th>
                          <th className="p-3">Interés (1.5%)</th>
                          <th className="p-3 text-right">Monto Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 12 }).map((_, i) => {
                          const numero = i + 1;
                          const totalPayment = Math.round((requestedAmount * 1.18) / 12);
                          const interestPayment = Math.round(requestedAmount * 0.015);
                          const capitalPayment = totalPayment - interestPayment;

                          return (
                            <tr key={numero} className="border-b border-slate-50 text-xs font-medium hover:bg-slate-50/50 transition-colors">
                              <td className="p-3 font-bold text-slate-700">Mes {numero}</td>
                              <td className="p-3 font-mono text-slate-500">{formatCurrency(capitalPayment)}</td>
                              <td className="p-3 font-mono text-slate-500">{formatCurrency(interestPayment)}</td>
                              <td className="p-3 text-right font-bold text-purple-700 font-mono">{formatCurrency(totalPayment)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Primary Solicitation Button */}
                <button
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
                </button>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
