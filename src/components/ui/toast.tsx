'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';

type ToastVariant = 'success' | 'error';

type ToastData = { id: string; message: string; variant: ToastVariant };

type ToastContextType = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            open
            className={`fixed bottom-24 right-4 z-50 flex w-[calc(100vw-32px)] items-center gap-3 rounded-xl px-4 py-3 shadow-lg sm:bottom-6 sm:w-auto sm:max-w-sm ${
              toast.variant === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            } data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full`}
          >
            <span className="text-base">{toast.variant === 'success' ? '✅' : '❌'}</span>
            <ToastPrimitive.Description className="flex-1 text-sm font-medium text-white">{toast.message}</ToastPrimitive.Description>
            <ToastPrimitive.Close className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/20 hover:text-white">
              <X size={14} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
