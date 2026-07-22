import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, AlertTriangle, Copy, Check, RefreshCw, Key, Link } from 'lucide-react';
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  testSupabaseConnection,
  SUPABASE_SQL_SETUP,
} from '../lib/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tableExists?: boolean;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getSupabaseConfig();
      setUrl(current.url);
      setKey(current.key);
      setTestResult(null);
      setSavedSuccess(false);

      if (isSupabaseConfigured()) {
        runTest(current.url, current.key);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runTest = async (testUrl?: string, testKey?: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(testUrl || url, testKey || key);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Error al probar conexión: ${err?.message || String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (url.trim()) {
      localStorage.setItem('crediulep_supabase_url', url.trim());
    } else {
      localStorage.removeItem('crediulep_supabase_url');
    }

    if (key.trim()) {
      localStorage.setItem('crediulep_supabase_key', key.trim());
    } else {
      localStorage.removeItem('crediulep_supabase_key');
    }

    setSavedSuccess(true);
    if (onConfigSaved) onConfigSaved();
    runTest(url, key);

    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const copySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Estado de Conexión Supabase</h3>
              <p className="text-xs text-slate-500">Base de Datos PostgreSQL en la Nube</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Current status banner */}
        {testResult ? (
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 ${
              testResult.success
                ? testResult.tableExists !== false
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {testResult.success ? (
              testResult.tableExists !== false ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-semibold">{testResult.message}</p>
              {testResult.tableExists === false && (
                <p className="text-xs text-amber-700">
                  Copia el script SQL a continuación y ejecútalo en el <strong>SQL Editor</strong> de tu panel de Supabase para crear la tabla <code>clients</code>.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 text-sm flex items-center justify-between">
            <span className="text-xs md:text-sm">
              {isSupabaseConfigured()
                ? 'Credenciales detectadas. Haz clic en "Probar Conexión" para verificar.'
                : 'No se han configurado credenciales de Supabase aún.'}
            </span>
            <button
              onClick={() => runTest()}
              disabled={testing}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              Probar
            </button>
          </div>
        )}

        {/* Credentials Form */}
        <div className="space-y-4 bg-slate-50/70 border border-slate-100 p-5 rounded-2xl">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-600" />
            Credenciales de Conexión
          </h4>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              VITE_SUPABASE_URL (URL del Proyecto)
            </label>
            <div className="relative">
              <Link className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="https://your-project.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              VITE_SUPABASE_ANON_KEY (Clave Anónima)
            </label>
            <textarea
              rows={2}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Credenciales guardadas exitosamente
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => runTest(url, key)}
                disabled={testing}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                Probar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl cursor-pointer shadow-sm transition-colors"
              >
                Guardar Credenciales
              </button>
            </div>
          </div>
        </div>

        {/* SQL Setup section */}
        <div className="space-y-3 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Script SQL para Supabase</h4>
              <p className="text-xs text-slate-500">Ejecuta esto en el SQL Editor de Supabase si la tabla aún no existe.</p>
            </div>
            <button
              type="button"
              onClick={copySql}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium text-xs rounded-xl border border-purple-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSql ? 'Copiado' : 'Copiar SQL'}
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-40 border border-slate-800">
            {SUPABASE_SQL_SETUP}
          </pre>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
