import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/ws' })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token as string;
      if (!token) throw new Error('No token');
      const payload = this.jwtService.verify<{ userId: string; businessId: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      client.join(`business:${payload.businessId}`);
      client.data.businessId = payload.businessId;
    } catch {
      client.disconnect();
    }
  }

  emitToRoom(businessId: string, event: string, data: unknown): void {
    if (!this.server) return;
    this.server.to(`business:${businessId}`).emit(event, data);
  }
}
