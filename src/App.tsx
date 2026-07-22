/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Client, UserSession } from './types';
import { getDatabase, saveDatabase } from './utils';
import { fetchClientsFromFirebase, saveClientToFirebase, deleteClientFromFirebase, subscribeToClients } from './lib/firebase';
import CosmicBackground from './components/CosmicBackground';
import LoginView from './components/LoginView';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';
import LoadingScreen from './components/LoadingScreen';
import { MessageCircle } from 'lucide-react';

// Service Worker push notification helper
export function sendPushNotification(title: string, body: string) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: { title, body, url: window.location.origin }
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/logo-192.png'
    });
  } else {
    console.log(`[Notification Fallback] Title: ${title}, Body: ${body}`);
  }
}

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [prevClientData, setPrevClientData] = useState<Client | null>(null);

  // Initialize data and real-time subscription on mount
  useEffect(() => {
    // Immediate load from local storage cache
    const cachedDb = getDatabase();
    setClients(cachedDb);

    // Register Service Worker for push notifications
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('Service Worker registrado con éxito:', reg.scope);
          })
          .catch((err) => {
            console.error('Error al registrar Service Worker:', err);
          });
      });
    }

    // Live subscription to Firestore database
    const unsubscribe = subscribeToClients(
      (firebaseDb) => {
        // Merge firebaseDb with local cached DB to ensure no newly created local client is lost if snapshot triggers before write completes
        const localDb = getDatabase();
        const firebaseMap = new Map(firebaseDb.map((c) => [c.cedula, c]));
        const merged: Client[] = [...firebaseDb];

        for (const localClient of localDb) {
          if (!firebaseMap.has(localClient.cedula)) {
            merged.push(localClient);
            // Background push local client to Firebase
            saveClientToFirebase(localClient).catch((err) => console.error('Syncing local client error:', err));
          }
        }

        setClients(merged);
        saveDatabase(merged);
        setSyncError(null);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to Firestore. Using local cache fallback.', error);
        setLoading(false);
      }
    );

    // Retrieve previous session if any
    const savedSession = localStorage.getItem('crediulep_session');
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        console.error('Error parsing cached session', e);
      }
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Track updates in logged-in client data to trigger push notifications
  useEffect(() => {
    if (!session || session.role !== 'client' || clients.length === 0) {
      setPrevClientData(null);
      return;
    }

    const currentClient = clients.find(c => c.cedula === session.cedula);
    if (!currentClient) return;

    if (!prevClientData) {
      // Establish initial baseline (deep copy to avoid reference sharing)
      setPrevClientData(JSON.parse(JSON.stringify(currentClient)));
      return;
    }

    // 1. Detect credit status updates
    const prevStatus = prevClientData.prestamo?.estado;
    const currentStatus = currentClient.prestamo?.estado;

    if (currentStatus && prevStatus && prevStatus !== currentStatus) {
      const statusLabels: Record<string, string> = {
        vigente: 'Vigente (Al día) ✅',
        atrasado: 'Atrasado ⚠️',
        cancelado: 'Cancelado/Pagado 🎉'
      };
      const label = statusLabels[currentStatus] || currentStatus;
      sendPushNotification(
        'Actualización de tu Crédito',
        `El estado de tu crédito ha sido actualizado a: ${label}.`
      );
    }

    // 2. Detect loan terms updates (monto or payment additions)
    const prevMonto = prevClientData.prestamo?.montoOriginal;
    const currentMonto = currentClient.prestamo?.montoOriginal;
    if (prevMonto && currentMonto && prevMonto !== currentMonto) {
      sendPushNotification(
        'Modificación en tu Crédito',
        `El monto original de tu crédito ha sido modificado por el administrador.`
      );
    }

    // 3. Detect new admin messages
    const prevMsgs = prevClientData.mensajes || [];
    const currentMsgs = currentClient.mensajes || [];

    if (currentMsgs.length > prevMsgs.length) {
      // Find new messages
      const newMsgs = currentMsgs.slice(prevMsgs.length);
      const lastAdminMsg = [...newMsgs].reverse().find(m => m.remitente === 'admin');
      
      if (lastAdminMsg) {
        sendPushNotification(
          'Nuevo mensaje del Administrador',
          lastAdminMsg.texto
        );
      }
    }

    // Update baseline
    setPrevClientData(JSON.parse(JSON.stringify(currentClient)));
  }, [clients, session]);

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
          const savePromises = next.map(async (nextClient) => {
            const prevClient = prevMap.get(nextClient.cedula);
            if (!prevClient || JSON.stringify(prevClient) !== JSON.stringify(nextClient)) {
              console.log(`[Smart Sync] Saving updated/new client: ${nextClient.nombre} (${nextClient.cedula})`);
              await saveClientToFirebase(nextClient);
            }
          });

          // 2. Delete removed clients
          const deletePromises = prev.map(async (prevClient) => {
            if (!nextMap.has(prevClient.cedula)) {
              console.log(`[Smart Sync] Deleting client: ${prevClient.nombre} (${prevClient.cedula})`);
              await deleteClientFromFirebase(prevClient.cedula);
            }
          });

          await Promise.allSettled([...savePromises, ...deletePromises]);
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
        setClients={handleSetClients}
        onLogout={handleLogout}
        syncError={syncError}
      />
      {whatsAppButton}
    </div>
  );
}
