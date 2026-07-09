import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

/* ------------------------------------------------------------------
   Storage shim.
   The guide component was written against Claude's artifact storage
   API (window.storage). In a normal browser we back it with
   localStorage so auto-save keeps working locally. Each browser
   profile keeps its own saved build state.
------------------------------------------------------------------- */
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const value = localStorage.getItem(key);
      if (value === null) throw new Error(`Key not found: ${key}`);
      return { key, value, shared: false };
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    delete: async (key) => {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    list: async (prefix = "") => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix, shared: false };
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
