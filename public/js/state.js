/* Shared app state */
export const state = {
  user: null,
  access: null,
  refresh: sessionStorage.getItem('odg_refresh') || null,
  sidebarCollapsed: localStorage.getItem('odg_sidebar') === '1',
  globalSearch: '',
};

export function setSession({ user, accessToken, refreshToken }) {
  state.user = user;
  state.access = accessToken;
  state.refresh = refreshToken;
  sessionStorage.setItem('odg_refresh', refreshToken);
}

export function clearSession() {
  state.user = null;
  state.access = null;
  state.refresh = null;
  sessionStorage.removeItem('odg_refresh');
}

export function can(permission) {
  return state.user?.permissions?.includes(permission);
}

export function toggleSidebarCollapsed() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  localStorage.setItem('odg_sidebar', state.sidebarCollapsed ? '1' : '0');
}
