// components/ui/ToastProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToasts((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), message, type },
    ]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 space-y-2 px-3 sm:left-auto sm:right-4 sm:max-w-sm sm:px-0"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          let borderColor = "border-gray-700";
          let textColor = "text-gray-100";

          if (toast.type === "success") {
            borderColor = "border-emerald-500/70";
            textColor = "text-emerald-100";
          } else if (toast.type === "error") {
            borderColor = "border-red-500/70";
            textColor = "text-red-100";
          }

          return (
            <div
              key={toast.id}
              role={toast.type === "error" ? "alert" : "status"}
              className={`gl-motion gl-fade-in mx-auto w-full min-w-0 max-w-sm rounded-xl border ${borderColor} bg-black/90 px-4 py-3 shadow-lg backdrop-blur sm:mx-0`}
            >
              <p className={`text-xs ${textColor}`}>{toast.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
