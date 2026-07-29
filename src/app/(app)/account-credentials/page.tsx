'use client';

import { useState, useEffect } from 'react';
import { LockGate } from '@/components/account-credentials/lock-gate';
import { CredentialsTable } from '@/components/account-credentials/credentials-table';

const SESSION_KEY = 'acl_unlocked_until';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30분

export default function AccountCredentialsPage() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const until = sessionStorage.getItem(SESSION_KEY);
    if (until && Date.now() < Number(until)) {
      setUnlocked(true);
    }
  }, []);

  const handleUnlocked = () => {
    sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS));
    setUnlocked(true);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 px-8 py-8 max-w-5xl w-full mx-auto">
      {unlocked ? (
        <CredentialsTable />
      ) : (
        <LockGate onUnlocked={handleUnlocked} />
      )}
    </div>
  );
}
