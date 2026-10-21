'use client';

import { useState } from 'react';
import type { VersionItem } from '@/components/documents/page-types';

interface UseVersionPanelParams {
  openCreateModal: () => void;
}

export function useVersionPanel({ openCreateModal }: UseVersionPanelParams) {
  const [versionPanelDocId, setVersionPanelDocId] = useState<string | null>(null);
  const [versionItems, setVersionItems] = useState<VersionItem[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [newVersionDocId, setNewVersionDocId] = useState<string | null>(null);

  const openVersionPanel = async (docId: string) => {
    setVersionPanelDocId(docId);
    setVersionLoading(true);
    setVersionItems([]);
    try {
      const res = await fetch(`/api/documents/${docId}/versions`);
      const data = await res.json();
      setVersionItems(data.versions ?? []);
    } catch {
    }
    setVersionLoading(false);
  };

  const handleVersionNew = (docId: string) => { setNewVersionDocId(docId); setVersionPanelDocId(null); openCreateModal(); };

  return {
    versionPanelDocId,
    versionItems,
    versionLoading,
    newVersionDocId,
    setVersionPanelDocId,
    setVersionItems,
    setVersionLoading,
    setNewVersionDocId,
    openVersionPanel,
    handleVersionNew,
  };
}
