/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Sparkles, LogIn, AlertCircle, Shield, User, KeyRound, RefreshCw } from 'lucide-react';
import { Client, UserSession } from '../types';

interface LoginViewProps {
  clients: Client[];
  onLoginSuccess: (session: UserSession) => void;
  syncError?: string | null;
}

export default function LoginView({ clients, onLoginSuccess, syncError }: LoginViewProps) {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptDataTreatment, setAcceptDataTreatment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Math Captcha state
  const [captchaNum1, setCaptchaNum1] = useState(Math.floor(Math.random() * 9) + 1);
  const [captchaNum2, setCaptchaNum2] = useState(Math.floor(Math.random() * 9) + 1);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const generateCaptcha = () => {
    setCaptchaNum1(Math.floor(Math.random() * 9) + 1);
    setCaptchaNum2(Math.floor(Math.random() * 9) + 1);
    setCaptchaAnswer('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cedula.trim() || !password.trim()) {
      setError('Por favor complete todos los campos.');
      return;
    }

    // Verify Captcha
    const expectedSum = captchaNum1 + captchaNum2;
    if (parseInt(captchaAnswer.trim()) !== expectedSum) {
      setError('El CAPTCHA de seguridad es incorrecto. Inténtalo de nuevo.');
      generateCaptcha();
      return;
    }

    // Verify Personal Data Treatment Checkbox
    if (!acceptDataTreatment) {
      setError('Debe aceptar el tratamiento y lectura de datos personales para continuar.');
      return;
    }

    setIsLoading(true);

    // Simulate standard smooth auth response time
    setTimeout(() => {
      // Check Admin credentials
      if (cedula.trim() === '902050377' && password === '902050377-7@#Ff') {
        onLoginSuccess({
          role: 'admin',
          nombre: 'Gestor de Cartera',
        });
        setIsLoading(false);
        return;
      }

      // Check Client credentials
      const foundClient = clients.find(
         (c) => c.cedula === cedula.trim() && c.contrasena === password
      );

      if (foundClient) {
        onLoginSuccess({
          role: 'client',
          cedula: foundClient.cedula,
          nombre: foundClient.nombre,
        });
      } else {
        setError('Cédula de Ciudadanía o Contraseña incorrectas.');
        generateCaptcha();
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center lg:py-12 px-4 sm:px-6 lg:px-8 z-10" id="login-root">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-5xl bg-white/90 backdrop-blur-xl border border-purple-100 shadow-[0_25px_50px_-12px_rgba(109,40,217,0.08)] rounded-[32px] overflow-hidden grid grid-cols-1 lg:grid-cols-12"
        id="login-container"
      >
        {/* Left Column: Premium Banking Feature / Banner (Visible on Desktop) */}
        <div className="hidden lg:flex lg:col-span-6 bg-gradient-to-br from-purple-900 via-purple-950 to-indigo-950 text-white p-12 flex-col justify-between relative overflow-hidden">
          {/* Subtle elegant glowing vectors */}
          <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-purple-600/20 rounded-full blur-[80px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-indigo-600/15 rounded-full blur-[80px]" />
          
          {/* Logo / Header */}
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 font-black text-white text-xl">
                C
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xl tracking-tight block">CrediULEP</span>
                  <span className="relative flex h-2 w-2 mt-0.5" title={syncError ? 'Base de datos offline' : 'Base de datos conectada'} id="login-sidebar-db-light">
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
                <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Banca Corporativa</span>
              </div>
            </div>
          </div>

          {/* Core Promotion Bulletins */}
          <div className="relative z-10 my-8 space-y-8">
            <div className="space-y-2">
              <span className="text-purple-300 text-xs font-bold uppercase tracking-widest block">Portal Oficial</span>
              <h2 className="text-3xl font-black tracking-tight leading-tight">
                Gestiona tu crédito con la agilidad que mereces.
              </h2>
              <p className="text-sm text-purple-200/80 font-medium">
                Accede a tu estado de cuenta, simula nuevos montos y mantente al día con tu cronograma de amortización interactivo.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2 bg-white/5 rounded-xl border border-white/10 text-purple-300 mt-0.5 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-150">Conexión Segura Encriptada</h4>
                  <p className="text-xs text-purple-200/60 mt-0.5 font-medium">Tus datos personales y financieros están resguardados por protocolos bancarios avanzados.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="p-2 bg-white/5 rounded-xl border border-white/10 text-purple-300 mt-0.5 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-150">Tasas de Interés Preferenciales</h4>
                  <p className="text-xs text-purple-200/60 mt-0.5 font-medium">Benefíciate de tasas exclusivas de afiliado con amortización transparente sin cuotas de manejo ocultas.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="p-2 bg-white/5 rounded-xl border border-white/10 text-purple-300 mt-0.5 shrink-0">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-150">Fácil Acceso 24/7</h4>
                  <p className="text-xs text-purple-200/60 mt-0.5 font-medium">Revisa el estado de tus deudas, consulta tus cuotas pasadas y contacta soporte en cualquier momento.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer of the promo panel */}
          <div className="relative z-10 border-t border-white/10 pt-4 flex items-center justify-between text-[10px] text-purple-300/60 font-semibold uppercase tracking-wider">
            <span>Soporte CrediULEP</span>
            <span>Vigilado Financieramente</span>
          </div>
        </div>

        {/* Right Column: Secure Login Form */}
        <div className="col-span-1 lg:col-span-6 py-12 px-8 sm:px-12 flex flex-col justify-between bg-white">
          {/* Logo only visible on mobile */}
          <div className="text-center mb-6 lg:hidden flex flex-col items-center justify-center gap-2" id="login-header">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl border border-purple-100 flex items-center justify-center font-black text-purple-700 text-2xl shadow-sm">
              C
            </div>
            <div className="flex items-center gap-2 justify-center">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 mt-1">
                CrediULEP
              </h1>
              <span className="relative flex h-2 w-2 mt-2" title={syncError ? 'Base de datos offline' : 'Base de datos conectada'} id="login-mobile-db-light">
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
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Portal de Socios</p>
          </div>

          <div className="my-auto space-y-6">
            <div className="text-left hidden lg:block">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Acceso Seguro</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Ingresa tu número de identificación y contraseña asignada para ingresar al portal bancario.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-600" />
                  Cédula de Ciudadanía
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej: 1020304050"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    disabled={isLoading}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10 rounded-2xl py-3 px-4 text-slate-800 placeholder-slate-400 font-semibold transition-all duration-300 outline-none text-base"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                  Contraseña Bancaria
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10 rounded-2xl py-3 pl-4 pr-11 text-slate-800 placeholder-slate-400 font-semibold transition-all duration-300 outline-none text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* CAPTCHA section */}
              <div className="space-y-2 bg-purple-50/40 p-4 rounded-2xl border border-purple-100/60">
                <label className="text-[10px] font-bold text-purple-700 tracking-wider uppercase flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-purple-600" />
                  Verificación de Seguridad
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="bg-white px-4 py-2 rounded-xl font-mono text-sm font-black text-purple-700 select-none tracking-wider border border-purple-100 shadow-sm flex items-center gap-2">
                    <span>{captchaNum1}</span>
                    <span className="text-purple-400 font-bold">+</span>
                    <span>{captchaNum2}</span>
                    <span className="text-purple-400 font-bold">=</span>
                  </div>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="p-2 hover:bg-purple-100 text-purple-600 rounded-xl transition-colors border border-purple-100 bg-white shadow-sm cursor-pointer"
                    title="Cambiar CAPTCHA"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                  </button>
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Resultado"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      disabled={isLoading}
                      className="w-full bg-white border border-purple-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-xl py-2 px-3 text-slate-800 placeholder-slate-400 font-semibold text-center text-sm outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Data Treatment (Habeas Data) Acceptance Checkbox */}
              <div className="flex items-start gap-3.5 bg-purple-50/20 hover:bg-purple-50/35 border border-purple-100/40 hover:border-purple-200/50 p-4 rounded-2xl transition-all duration-300">
                <div className="flex items-center mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    id="accept-data-treatment"
                    checked={acceptDataTreatment}
                    onChange={(e) => setAcceptDataTreatment(e.target.checked)}
                    disabled={isLoading}
                    className="w-4.5 h-4.5 text-purple-600 bg-white border-purple-200 rounded-lg focus:ring-purple-500 focus:ring-offset-0 cursor-pointer accent-purple-600"
                  />
                </div>
                <label htmlFor="accept-data-treatment" className="text-xs text-slate-500 font-semibold leading-relaxed cursor-pointer select-none">
                  Acepto el <strong className="font-bold text-slate-700">Tratamiento y Lectura de Datos Personales</strong> (Habeas Data) conforme a la Ley 1581 de Protección de Datos. Autorizo a CrediULEP para la consulta y reporte de mis obligaciones.
                </label>
              </div>

              {/* Error message */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-start gap-3"
                    id="login-error-alert"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-sm font-semibold">
                      <span className="font-bold text-red-600">Error:</span> {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 active:from-purple-700 active:to-purple-800 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-purple-600/10 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-2"
                id="login-submit-btn"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 text-white/90" />
                    <span>Ingresar de forma Segura</span>
                  </>
                )}
              </motion.button>
            </form>
          </div>

          {/* Security and Access Disclaimer */}
          <div className="mt-8 pt-5 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              🔒 Acceso Restringido y Monitoreado
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">
              Este sistema cumple con los estándares bancarios internacionales de privacidad.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
