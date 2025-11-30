import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
  theme: 'light' | 'dark';
}

export function ToastProvider({ children, theme }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const isDark = theme === 'dark';

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = (type: ToastType) => {
    if (isDark) {
      switch (type) {
        case 'success':
          return 'bg-green-900/90 border-green-500 text-green-100';
        case 'error':
          return 'bg-red-900/90 border-red-500 text-red-100';
        case 'warning':
          return 'bg-yellow-900/90 border-yellow-500 text-yellow-100';
        case 'info':
        default:
          return 'bg-[#2d1f45]/90 border-[#5C3E94] text-slate-200';
      }
    } else {
      switch (type) {
        case 'success':
          return 'bg-green-50 border-green-500 text-green-800';
        case 'error':
          return 'bg-red-50 border-red-500 text-red-800';
        case 'warning':
          return 'bg-yellow-50 border-yellow-500 text-yellow-800';
        case 'info':
        default:
          return 'bg-[#D7D3BF] border-[#A59D84] text-slate-800';
      }
    }
  };

  const getIconColor = (type: ToastType) => {
    if (isDark) {
      switch (type) {
        case 'success':
          return 'text-green-400';
        case 'error':
          return 'text-red-400';
        case 'warning':
          return 'text-yellow-400';
        case 'info':
        default:
          return 'text-[#F25912]';
      }
    } else {
      switch (type) {
        case 'success':
          return 'text-green-600';
        case 'error':
          return 'text-red-600';
        case 'warning':
          return 'text-yellow-600';
        case 'info':
        default:
          return 'text-[#A59D84]';
      }
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container - Sol alt köşe */}
      <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -100, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={`
                pointer-events-auto
                flex items-center gap-3 
                px-4 py-3 
                rounded-xl 
                border-l-4
                shadow-lg
                backdrop-blur-sm
                min-w-[280px] max-w-[400px]
                ${getStyles(toast.type)}
              `}
              style={{
                boxShadow: isDark 
                  ? '0 4px 20px rgba(0, 0, 0, 0.5)' 
                  : '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}
            >
              <span className={getIconColor(toast.type)}>
                {getIcon(toast.type)}
              </span>
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className={`
                  p-1 rounded-full transition-colors
                  ${isDark 
                    ? 'hover:bg-white/10' 
                    : 'hover:bg-black/10'
                  }
                `}
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
