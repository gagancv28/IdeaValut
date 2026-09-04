// src/utils/toast.js
// Event-based toast dispatch utility

export const toast = {
  success: (message) => {
    window.dispatchEvent(new CustomEvent("show-toast", { detail: { message, type: "success" } }));
  },
  error: (message) => {
    window.dispatchEvent(new CustomEvent("show-toast", { detail: { message, type: "error" } }));
  }
};
