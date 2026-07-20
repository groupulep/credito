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

  if (loading) {
    return <LoadingScreen />;
  }

  // Auth Routing
  if (!session) {
    return (
      <div className="relative min-h-screen font-sans">
        <CosmicBackground />
        <LoginView clients={clients} onLoginSuccess={handleLogin} syncError={syncError} />
      </div>
    );
  }

  if (session.role === 'admin') {
    return (
      <div className="font-sans">
        <AdminDashboard
          clients={clients}
          setClients={handleSetClients}
          onLogout={handleLogout}
          syncError={syncError}
        />
      </div>
    );
  }

  // Default: Client dashboard
  return (
    <div className="font-sans">
      <ClientDashboard
        session={session}
        clients={clients}
        onLogout={handleLogout}
        syncError={syncError}
      />
    </div>
  );
}
