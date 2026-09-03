'use client';

import { use } from 'react';
import { GuestMeetingRoom } from '@/components/meetings/GuestMeetingRoom';

/**
 * 게스트 화상회의 입장 페이지 (공개·비로그인)
 * /meet/<방ID>
 */
export default function GuestMeetPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = use(params);
  return <GuestMeetingRoom room={room} />;
}
