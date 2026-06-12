import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

export function useOrderSound() {
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    Audio.Sound.createAsync(require('../../assets/sounds/new-order.mp3'))
      .then(({ sound }) => { soundRef.current = sound; })
      .catch(() => {});
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const play = async () => {
    try {
      if (!soundRef.current) return;
      await soundRef.current.setPositionAsync(0);
      await soundRef.current.playAsync();
    } catch {}
  };

  return { play };
}
