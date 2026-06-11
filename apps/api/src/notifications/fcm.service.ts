import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  initialized = false;

  onModuleInit() {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — FCM push notifications disabled');
      return;
    }
    try {
      initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize Firebase Admin', err);
    }
  }

  async sendToTokens(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    if (!this.initialized || tokens.length === 0) return;
    try {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
    } catch (err) {
      this.logger.error('FCM sendEachForMulticast failed', err);
    }
  }
}
