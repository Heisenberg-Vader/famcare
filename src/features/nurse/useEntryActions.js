import { useMemo } from 'react';
import { useAuth } from '../../auth/authContext.js';
import { useToast } from '../../components/toastContext.js';
import { createEntry, updateEntry } from '../../data/entries.js';
import { isOnline } from '../../hooks/useOnlineStatus.js';

/**
 * Create/update entries for a patient without awaiting the server. Success feedback is
 * immediate ("Saved, will sync" when offline); rejections arrive later as error toasts.
 * Each function returns true when the write was queued.
 */
export function useEntryActions(patientId) {
  const { user, profile } = useAuth();
  const toast = useToast();

  return useMemo(() => {
    const nurse = { uid: user.uid, name: profile?.fullName ?? user.displayName ?? user.email };
    const onError = (err) => toast.error(err.message);
    const saved = () => toast.success(isOnline() ? 'Saved' : 'Saved, will sync');
    const run = (fn) => {
      try {
        fn();
        saved();
        return true;
      } catch (err) {
        toast.error(err.message);
        return false;
      }
    };
    return {
      nurse,
      create: (type, payload, at = new Date()) =>
        run(() => createEntry({ patientId, type, payload, at, nurse, onError })),
      update: (entry, payload, at = entry.at) =>
        run(() => updateEntry({ patientId, entry, payload, at, onError })),
    };
  }, [patientId, user, profile, toast]);
}
