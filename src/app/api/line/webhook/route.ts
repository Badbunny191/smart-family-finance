/**
 * LINE Webhook Handler
 * 
 * Receives webhook events from LINE Messaging API.
 * Currently logs LINE User IDs for setup/testing purposes.
 * 
 * POST /api/line/webhook
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ============================================================
// TYPES
// ============================================================

interface LINEWebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    userId: string;
  };
  replyToken?: string;
  [key: string]: unknown;
}

interface LINEWebhookBody {
  events: LINEWebhookEvent[];
  destination: string;
}

// ============================================================
// HANDLER
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: LINEWebhookBody = await request.json();
    
    console.log('[LINE Webhook] Received webhook request');
    console.log('[LINE Webhook] Destination:', body.destination);

    if (body.events && body.events.length > 0) {
      for (const event of body.events) {
        console.log('[LINE Webhook] Event type:', event.type);
        
        if (event.source?.userId) {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('Received LINE User ID:');
          console.log(event.source.userId);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LINE Webhook] Error processing request:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// ALLOWED METHODS
// ============================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'LINE Webhook endpoint',
    usage: 'POST with LINE webhook events',
    example: {
      method: 'POST',
      body: {
        destination: 'Uxxxxx',
        events: [
          {
            type: 'message',
            timestamp: 12345678901234,
            source: {
              type: 'user',
              userId: 'Uxxxxxxxxxxxxxxxx'
            },
            replyToken: 'nHuyWiB4yP5Q5NJjRWRHKeo_Ah28UVWqm7dhlVrSVOo',
            message: {
              type: 'text',
              id: '1234567890',
              text: 'Hello'
            }
          }
        ]
      }
    }
  });
}
