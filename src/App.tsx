/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Client, UserSession } from './types';
import { getDatabase, saveDatabase } from './utils';
import { fetchClientsFromFirebase, saveClientToFirebase, deleteClientFromFirebase } from './lib/firebase';
import CosmicBackground from './components/CosmicBackground';
import LoginView from './components/LoginView';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';
import LoadingScreen from './components/LoadingScreen';
import { MessageCircle } from 'lucide-react';

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    async function initData() {
      // Load from local storage cache as immediate fallback
      const cachedDb = getDatabase();
      setClients(cachedDb);

      // Fallback to Firebase Firestore
      try {
        const firebaseDb = await fetchClientsFromFirebase();
        setClients(firebaseDb);
        // Sync cache
        saveDatabase(firebaseDb);
        setSyncError(null);
      } catch (error) {
        console.error('Failed to load from Firebase. Using local cache fallback.', error);
        setSyncError('Failed to load from Firebase');
      } finally {
        setLoading(false);
      }
    }

    initData();

    // Retrieve previous session if any
    const savedSession = localStorage.getItem('crediulep_session');
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        console.error('Error parsing cached session', e);
      }
    }
  }, []);

  // Sync state database changes back to utils & Firebase
  const handleSetClients = (updater: React.SetStateAction<Client[]>) => {
    setClients((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveDatabase(next);
      
      // Safely perform targeted Firestore updates in the background
      setTimeout(async () => {
        try {
          const prevMap = new Map(prev.map(c => [c.cedula, c]));
          const nextMap = new Map(next.map(c => [c.cedula, c]));

          // 1. Save new or modified clients
          for (const nextClient of next) {
            const prevClient = prevMap.get(nextClient.cedula);
            if (!prevClient || JSON.stringify(prevClient) !== JSON.stringify(nextClient)) {
              console.log(`[Smart Sync] Saving updated/new client: ${nextClient.nombre} (${nextClient.cedula})`);
              await saveClientToFirebase(nextClient);
            }
          }

          // 2. Delete removed clients
          for (const prevClient of prev) {
            if (!nextMap.has(prevClient.cedula)) {
              console.log(`[Smart Sync] Deleting client: ${prevClient.nombre} (${prevClient.cedula})`);
              await deleteClientFromFirebase(prevClient.cedula);
            }
          }
          setSyncError(null);
        } catch (error) {
          console.error('[Smart Sync] Error syncing changes to Firebase:', error);
          setSyncError('no se copian en base de datos');
        }
      }, 0);
      
      return next;
    });
  };

  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem('crediulep_session', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('crediulep_session');
  };

  const adminPhone = '573001234567';

  const getWhatsAppSupportLink = () => {
    const clientInfo = session && session.role !== 'admin' ? clients.find(c => c.cedula === session.cedula) : null;
    let text = 'Hola CrediULEP, deseo realizar una consulta.';
    if (clientInfo) {
      text = `Hola CrediULEP, soy ${clientInfo.nombre} con Cédula ${clientInfo.cedula}. Deseo realizar una consulta.`;
    }
    return `https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(text)}`;
  };

  const whatsAppButton = (
    <a
      href={getWhatsAppSupportLink()}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-full shadow-[0_4px_14px_rgba(16,185,129,0.4)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.6)] transition-all duration-300 group"
      title="Contactar soporte por WhatsApp"
      id="whatsapp-floating-btn"
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-30 animate-ping pointer-events-none"></span>
      <MessageCircle className="w-6 h-6 relative z-10 transition-transform group-hover:scale-110" />
    </a>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  // Auth Routing
  if (!session) {
    return (
      <div className="relative min-h-screen font-sans">
        <CosmicBackground />
        <LoginView clients={clients} onLoginSuccess={handleLogin} syncError={syncError} />
        {whatsAppButton}
      </div>
    );
  }

  if (session.role === 'admin') {
    return (
      <div className="font-sans relative min-h-screen">
        <AdminDashboard
          clients={clients}
          setClients={handleSetClients}
          onLogout={handleLogout}
          syncError={syncError}
        />
        {whatsAppButton}
      </div>
    );
  }

  // Default: Client dashboard
  return (
    <div className="font-sans relative min-h-screen">
      <ClientDashboard
        session={session}
        clients={clients}
        onLogout={handleLogout}
        syncError={syncError}
      />
      {whatsAppButton}
    </div>
  );
}
