import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { query } from '../db/pool';
import { ChatService } from './chat.service';
import { logger } from '../config/logger';
import { JWTPayload } from '../types';

interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
  userId?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private userChannels: Map<string, Set<string>> = new Map(); // userId -> Set of channelIds
  private typingUsers: Map<string, Map<string, number>> = new Map(); // channelId -> Map<userId, timestamp>

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow all origins for development (same as Express CORS config)
          callback(null, true);
        },
        credentials: true,
      },
      path: '/socket.io',
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const payload = verifyAccessToken(token);

        // Verify user exists and is active
        const userResult = await query(
          'SELECT id, email, is_active FROM auth_schema.users WHERE id = $1',
          [payload.userId]
        );

        if (userResult.rows.length === 0) {
          return next(new Error('User not found'));
        }

        if (!userResult.rows[0].is_active) {
          return next(new Error('User is inactive'));
        }

        socket.user = payload;
        socket.userId = payload.userId;
        next();
      } catch (error: any) {
        logger.error('WebSocket authentication error', error);
        next(new Error('Invalid or expired token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', async (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      logger.info(`WebSocket client connected: ${userId}`);

      // Initialize user's channel set
      if (!this.userChannels.has(userId)) {
        this.userChannels.set(userId, new Set());
      }

      // Join user to all accessible channels
      try {
        const channels = await ChatService.getChannelsForUser(userId);
        for (const channel of channels) {
          socket.join(`channel:${channel.id}`);
          this.userChannels.get(userId)!.add(channel.id);
        }
        logger.info(`User ${userId} joined ${channels.length} channels`);
      } catch (error) {
        logger.error('Error joining channels on connection', error);
      }

      // Handle joining a specific channel
      socket.on('join_channel', async (data: { channel_id: string }) => {
        try {
          const canAccess = await ChatService.canUserAccessChannel(data.channel_id, userId);
          if (canAccess) {
            socket.join(`channel:${data.channel_id}`);
            this.userChannels.get(userId)!.add(data.channel_id);
            socket.emit('channel_joined', { channel_id: data.channel_id });
            logger.info(`User ${userId} joined channel ${data.channel_id}`);
          } else {
            socket.emit('error', { message: 'Access denied to channel' });
          }
        } catch (error: any) {
          logger.error('Error joining channel', error);
          socket.emit('error', { message: 'Failed to join channel' });
        }
      });

      // Handle leaving a channel
      socket.on('leave_channel', (data: { channel_id: string }) => {
        socket.leave(`channel:${data.channel_id}`);
        this.userChannels.get(userId)?.delete(data.channel_id);
        socket.emit('channel_left', { channel_id: data.channel_id });
        logger.info(`User ${userId} left channel ${data.channel_id}`);
      });

      // Handle typing indicators
      socket.on('typing_start', async (data: { channel_id: string }) => {
        try {
          const canAccess = await ChatService.canUserAccessChannel(data.channel_id, userId);
          if (canAccess) {
            if (!this.typingUsers.has(data.channel_id)) {
              this.typingUsers.set(data.channel_id, new Map());
            }
            this.typingUsers.get(data.channel_id)!.set(userId, Date.now());
            
            // Get user info
            const userResult = await query(
              'SELECT id, first_name, last_name FROM auth_schema.users WHERE id = $1',
              [userId]
            );
            
            if (userResult.rows.length > 0) {
              socket.to(`channel:${data.channel_id}`).emit('user_typing', {
                channel_id: data.channel_id,
                user: {
                  id: userId,
                  first_name: userResult.rows[0].first_name,
                  last_name: userResult.rows[0].last_name,
                },
              });
            }
          }
        } catch (error) {
          logger.error('Error handling typing start', error);
        }
      });

      socket.on('typing_stop', (data: { channel_id: string }) => {
        if (this.typingUsers.has(data.channel_id)) {
          this.typingUsers.get(data.channel_id)!.delete(userId);
          socket.to(`channel:${data.channel_id}`).emit('user_stopped_typing', {
            channel_id: data.channel_id,
            user_id: userId,
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${userId}`);
        // Clean up typing indicators
        this.typingUsers.forEach((users, channelId) => {
          users.delete(userId);
        });
        this.userChannels.delete(userId);
      });
    });
  }

  // Broadcast message to a channel
  async broadcastMessage(channelId: string, message: any) {
    this.io.to(`channel:${channelId}`).emit('new_message', message);
    logger.info(`Broadcasted message to channel ${channelId}`);
  }

  // Get Socket.IO instance (for external use)
  getIO(): SocketIOServer {
    return this.io;
  }
}

