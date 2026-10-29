import { createContext, useContext } from 'react';

// Avisos (toasts) y confirmaciones propias de la app. El proveedor está en
// components/ui/FeedbackProvider.jsx.
export const FeedbackContext = createContext(null);

const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useToast/useConfirm requieren FeedbackProvider');
  return ctx;
};

// toast.success('Guardado') · toast.error('No se pudo…') · toast.info(...)
export const useToast = () => useFeedback().toast;

// const ok = await confirm({ title, message, confirmLabel, tone: 'danger' })
export const useConfirm = () => useFeedback().confirm;
