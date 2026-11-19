import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/** const toast = useToast(); toast.show('Saved'); toast.error('Could not save'); */
export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value;
}
