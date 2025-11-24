/**
 * Welcome Flow Component
 *
 * Maneja el flujo de autenticación para usuarios no autenticados:
 * - Welcome Screen (inicio)
 * - Login Screen
 * - SignUp Screen
 */

import React, { useState } from 'react';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import { ViewState } from '../types';

type WelcomeView = 'welcome' | 'login' | 'signup';

interface WelcomeFlowProps {
  onBrowseAsGuest?: () => void; // Opcional: permitir explorar sin cuenta
}

export function WelcomeFlow({ onBrowseAsGuest }: WelcomeFlowProps) {
  const [view, setView] = useState<WelcomeView>('welcome');

  // Welcome Screen
  if (view === 'welcome') {
    return (
      <WelcomeScreen
        onLogin={() => setView('login')}
        onSignUp={() => setView('signup')}
        onBrowse={onBrowseAsGuest}
      />
    );
  }

  // Login Screen
  if (view === 'login') {
    return (
      <LoginScreen
        onNavigate={(newView) => {
          if (newView === ViewState.SIGNUP) {
            setView('signup');
          } else if (newView === ViewState.HOME) {
            // Volver al welcome
            setView('welcome');
          }
          // Si el login es exitoso, AuthContext actualiza automáticamente
          // y el usuario verá el marketplace
        }}
      />
    );
  }

  // SignUp Screen
  if (view === 'signup') {
    return (
      <SignUpScreen
        onNavigate={(newView) => {
          if (newView === ViewState.LOGIN) {
            setView('login');
          } else if (newView === ViewState.HOME) {
            // Volver al welcome
            setView('welcome');
          }
          // Si el signup es exitoso, AuthContext actualiza automáticamente
        }}
      />
    );
  }

  return null;
}
