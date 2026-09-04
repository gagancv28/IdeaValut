import { getApiBaseUrl } from '../utils/apiConfig';

const BASE_URL = getApiBaseUrl();

/**
 * Register a new founder account.
 * @param {{ email: string, password: string, companyName: string }} payload
 * @returns {Promise<{ user: object, message: string }>}
 */
export async function signupFounder({ email, password, companyName }) {
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, companyName }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Throw the server's error message so callers can display it
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }

  return data;
}

/**
 * Log in an existing founder.
 * @param {{ email: string, password: string }} payload
 * @returns {Promise<{ user: object, companyName: string, message: string }>}
 */
export async function loginFounder({ email, password }) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Invalid credentials. Please try again.');
  }

  return data;
}


/**
 * GET /api/status — health check
 */
export async function checkStatus() {
  const res = await fetch(`${BASE_URL}/api/status`);
  return res.json();
}

/**
 * GET /api/platform-settings — Fetch platform settings
 */
export async function getPlatformSettings() {
  const res = await fetch(`${BASE_URL}/api/platform-settings`);
  if (!res.ok) {
    throw new Error("Failed to fetch platform settings.");
  }
  return res.json();
}
