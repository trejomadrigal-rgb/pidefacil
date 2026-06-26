import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

@Injectable()
export class RtdbService implements OnModuleInit {
  private readonly logger = new Logger(RtdbService.name);
  private initialized = false;

  onModuleInit() {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_DATABASE_URL) {
      this.logger.warn('FIREBASE_DATABASE_URL not set — chat disabled');
      return;
    }
    this.initialized = true;
  }

  async createChatRoom(orderId: string): Promise<void> {
    if (!this.initialized) return;
    try {
      const db = getDatabase(getApps()[0]);
      await db.ref(`chats/${orderId}`).set({ active: true, messages: {} });
    } catch (err) {
      this.logger.error(`Failed to create chat room for order ${orderId}`, err);
    }
  }

  async deleteChatRoom(orderId: string): Promise<void> {
    if (!this.initialized) return;
    try {
      const db = getDatabase(getApps()[0]);
      await db.ref(`chats/${orderId}`).remove();
    } catch (err) {
      this.logger.error(`Failed to delete chat room for order ${orderId}`, err);
    }
  }
}
