import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useAsyncStorage<T>(key: string, state: T, onHydrated: (value: T) => void) {
  const [isHydrated, setIsHydrated] = useState(false);
  const hasRestored = useRef(false);

  const hydrate = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed: T = JSON.parse(stored);
        onHydrated(parsed);
        hasRestored.current = true;
      }
    } catch (error) {
      console.warn(`[useAsyncStorage] Failed to load data for key "${key}":`, error);
    } finally {
      setIsHydrated(true);
    }
  }, [key, onHydrated]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persist = async () => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.warn(`[useAsyncStorage] Failed to save data for key "${key}":`, error);
      }
    };

    if (hasRestored.current) {
      persist();
    } else {
      hasRestored.current = true;
      persist();
    }
  }, [isHydrated, key, state]);

  return { isHydrated };
}
