'use client';

import { useCallback, useEffect, useState } from 'react';

function avatarKey(username: string) {
  return `userAvatar_${username || 'default'}`;
}

/** Client-only profile photo stored as a data URL in localStorage, keyed per username. */
export function useAvatar(username: string) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    // localStorage only exists client-side; read it once after mount/username-change to sync with that external store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvatarUrl(localStorage.getItem(avatarKey(username)));
  }, [username]);

  const setAvatar = useCallback(
    (dataUrl: string) => {
      localStorage.setItem(avatarKey(username), dataUrl);
      setAvatarUrl(dataUrl);
    },
    [username]
  );

  const removeAvatar = useCallback(() => {
    localStorage.removeItem(avatarKey(username));
    setAvatarUrl(null);
  }, [username]);

  return { avatarUrl, setAvatar, removeAvatar };
}
