'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('clio_token');
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-clio-bg flex items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-navy border-t-transparent rounded-full" />
    </div>
  );
}
