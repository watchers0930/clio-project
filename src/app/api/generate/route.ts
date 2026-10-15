import { NextRequest } from 'next/server';
import { generateDocument } from '@/lib/generation/generate-document';
export const maxDuration = 300;
export async function POST(request: NextRequest) { return generateDocument(request); }
