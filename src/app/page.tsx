'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export default function RootPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router, token]);

  return (
    <div className="min-h-screen bg-clio-bg flex items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-navy border-t-transparent rounded-full" />
    </div>
  );
}
