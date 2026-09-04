// src/utils/apiConfig.js
// Dynamic API Base URL resolver that works seamlessly on localhost, mobile network IP, or custom domains.

export const getApiBaseUrl = () => {
  if (typeof window !== "undefined" && window.location.hostname) {
    const host = window.location.hostname;
    return import.meta.env.VITE_API_URL || `http://${host}:3001`;
  }
  return import.meta.env.VITE_API_URL || "http://localhost:3001";
};

export const API_BASE_URL = getApiBaseUrl();
