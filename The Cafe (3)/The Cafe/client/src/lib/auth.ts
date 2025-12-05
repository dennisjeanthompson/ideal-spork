import { User } from "@shared/schema";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

let authState: AuthState = {
  user: null,
  isAuthenticated: false,
};

const listeners: Set<(state: AuthState) => void> = new Set();

export function getAuthState(): AuthState {
  return authState;
}

export function setAuthState(newState: Partial<AuthState>) {
  authState = { ...authState, ...newState };
  listeners.forEach(listener => listener(authState));
}

export function subscribeToAuth(listener: (state: AuthState) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isManager(): boolean {
  return authState.user?.role === "manager";
}

export function isAdmin(): boolean {
  return authState.user?.role === "admin";
}

// Check if user has manager-level access (manager or admin)
export function hasManagerAccess(): boolean {
  return authState.user?.role === "manager" || authState.user?.role === "admin";
}

export function isEmployee(): boolean {
  return authState.user?.role === "employee";
}

export function getCurrentUser(): User | null {
  return authState.user;
}

export function logout() {
  setAuthState({ user: null, isAuthenticated: false });
}
