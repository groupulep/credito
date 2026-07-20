import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, Server, Sparkles, CheckCircle2 } from 'lucide-react';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { label: 'Estableciendo canal encriptado TLS 1.3', icon: Lock, status: 'secure' },
    { label: 'Verificando firmas de seguridad CrediULEP', icon: ShieldCheck, status: 'verifying' },
    { label: 'Sincronizando estado de cuenta con la nube', icon: Server, status: 'syncing' },
  ];

  // Simular progreso de carga fluido y elegante para dar sensación de robustez y auditoría bancaria segura
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = Math.random() * 12 + 5;
        return Math.min(prev + increment, 100);
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // Cambiar el paso activo basado en el porcentaje de progreso
  useEffect(() => {
    if (progress < 35) {
      setActiveStep(0);
    } else if (progress < 70) {
      setActiveStep(1);
    } else {
      setActiveStep(2);
    }
  }, [progress]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center font-sans overflow-hidden relative select-none" id="loading-root-screen">
      {/* Decorative ambient subtle corporate radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-100/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-indigo-100/25 rounded-full blur-[100px] pointer-events-none" />

      {/* Main secure frame */}
      <div className="relative max-w-md w-full px-6 z-10 flex flex-col items-center">
        
        {/* Superior Safety Badge Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 px-4 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100 flex items-center gap-2 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          Conexión Segura Bancaria Detectada
        </motion.div>

        {/* Dynamic Glowing Vault Core (Concentric Loading Circles) */}
        <div className="relative w-44 h-44 flex items-center justify-center mb-8">
          
          {/* Pulsing outer glowing ring */}
          <motion.div
            animate={{ scale: [0.96, 1.04, 0.96], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full border border-purple-200/50"
          />

          {/* Rotating dashed ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-3 rounded-full border border-dashed border-purple-400/40"
          />

          {/* Inner rotating solid ring with gap */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-6 rounded-full border-2 border-t-purple-600 border-r-transparent border-b-purple-100 border-l-transparent"
          />

          {/* Core Shield Sphere with beautiful inner drop shadows */}
          <div className="absolute inset-10 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-950 flex items-center justify-center shadow-xl shadow-purple-900/10 border border-white/10 overflow-hidden">
            {/* Linear light reflection pass */}
            <motion.div
              animate={{ x: ['-100%', '150%'] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' }}
              className="absolute top-0 bottom-0 left-0 w-8 bg-white/15 skew-x-12 filter blur-sm pointer-events-none"
            />
            <Lock className="w-8 h-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
          </div>
        </div>

        {/* Elegant Micro Branding */}
        <div className="text-center space-y-1 mb-8">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">CrediULEP</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Portal Oficial de Cartera</p>
        </div>

        {/* Progress Metrics Panel */}
        <div className="w-full bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_12px_30px_rgba(109,40,217,0.03)] space-y-5">
          
          {/* Progress Indicator Head */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />
              Sincronizando Sistema...
            </span>
            <span className="font-mono text-purple-700 font-black">{Math.round(progress)}%</span>
          </div>

          {/* Custom Sleek Progress Bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-600 to-indigo-700 rounded-full"
              style={{ width: `${progress}%` }}
              layoutId="progressBar"
            />
          </div>

          {/* High-Fidelity Step Verification Checklist */}
          <div className="pt-2 border-t border-slate-50 space-y-3">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = idx < activeStep || progress === 100;
              const isActive = idx === activeStep && progress < 100;
              const isPending = idx > activeStep && progress < 100;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-purple-50/50 border border-purple-100/50' 
                      : 'border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg border transition-all ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-150'
                        : isActive
                        ? 'bg-purple-50 text-purple-600 border-purple-100'
                        : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      <StepIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[11px] font-bold tracking-wide transition-colors ${
                      isCompleted
                        ? 'text-slate-700'
                        : isActive
                        ? 'text-purple-950 font-black'
                        : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>

                  <div className="flex items-center">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50/50 shrink-0" />
                    ) : isActive ? (
                      <svg className="animate-spin h-3.5 w-3.5 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security / Legal Footer Notice */}
        <div className="mt-12 text-center space-y-1 opacity-60">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Vigilado Superfinanciera de Colombia
          </p>
          <p className="text-[8px] text-slate-400 font-medium">
            Sistema Encriptado bajo estándares bancarios internacionales. Todos los derechos reservados.
          </p>
        </div>

      </div>
    </div>
  );
}
