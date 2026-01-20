/**
 * Presence Service
 *
 * Tracks user presence in collaborative editing sessions.
 * Maintains awareness of who is currently viewing/editing documents.
 *
 * Features:
 * - Track active users per room
 * - Heartbeat mechanism for presence updates
 * - Auto-cleanup of stale presence
 * - Presence history for audit
 */

interface PresenceRecord {
  roomName: string;
  userId: string;
  userName: string;
  joinedAt: Date;
  lastSeen: Date;
}

export class PresenceService {
  private presence: Map<string, Map<string, PresenceRecord>> = new Map();

  // Cleanup stale presence every minute
  private cleanupInterval: NodeJS.Timeout;
  private readonly STALE_TIMEOUT = 60 * 1000; // 1 minute

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Mark user as joined
   */
  async userJoined(
    roomName: string,
    userId: string,
    userName: string
  ): Promise<void> {
    let roomPresence = this.presence.get(roomName);

    if (!roomPresence) {
      roomPresence = new Map();
      this.presence.set(roomName, roomPresence);
    }

    const record: PresenceRecord = {
      roomName,
      userId,
      userName,
      joinedAt: new Date(),
      lastSeen: new Date(),
    };

    roomPresence.set(userId, record);

    console.log(
      `[Presence] User ${userName} (${userId}) joined room ${roomName}`
    );
  }

  /**
   * Update user presence (heartbeat)
   */
  async updatePresence(
    roomName: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const roomPresence = this.presence.get(roomName);

    if (!roomPresence) {
      // User not in room, add them
      await this.userJoined(roomName, userId, userName);
      return;
    }

    const record = roomPresence.get(userId);

    if (record) {
      record.lastSeen = new Date();
    } else {
      // User not in room, add them
      await this.userJoined(roomName, userId, userName);
    }
  }

  /**
   * Mark user as left
   */
  async userLeft(roomName: string, userId: string): Promise<void> {
    const roomPresence = this.presence.get(roomName);

    if (roomPresence) {
      const record = roomPresence.get(userId);

      if (record) {
        console.log(
          `[Presence] User ${record.userName} (${userId}) left room ${roomName}`
        );
        roomPresence.delete(userId);
      }

      // Clean up empty rooms
      if (roomPresence.size === 0) {
        this.presence.delete(roomName);
      }
    }
  }

  /**
   * Get active users in a room
   */
  getActiveUsers(roomName: string): PresenceRecord[] {
    const roomPresence = this.presence.get(roomName);

    if (!roomPresence) {
      return [];
    }

    return Array.from(roomPresence.values());
  }

  /**
   * Get all rooms with active users
   */
  getActiveRooms(): string[] {
    return Array.from(this.presence.keys());
  }

  /**
   * Check if user is present in room
   */
  isUserPresent(roomName: string, userId: string): boolean {
    const roomPresence = this.presence.get(roomName);
    return roomPresence ? roomPresence.has(userId) : false;
  }

  /**
   * Get user count for a room
   */
  getUserCount(roomName: string): number {
    const roomPresence = this.presence.get(roomName);
    return roomPresence ? roomPresence.size : 0;
  }

  /**
   * Start cleanup interval for stale presence
   */
  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePresence();
    }, 60 * 1000); // Every minute
  }

  /**
   * Clean up stale presence records
   */
  private cleanupStalePresence() {
    const now = Date.now();
    let totalCleaned = 0;

    this.presence.forEach((roomPresence, roomName) => {
      const staleUsers: string[] = [];

      roomPresence.forEach((record, userId) => {
        const timeSinceLastSeen = now - record.lastSeen.getTime();

        if (timeSinceLastSeen > this.STALE_TIMEOUT) {
          staleUsers.push(userId);
        }
      });

      // Remove stale users
      staleUsers.forEach((userId) => {
        const record = roomPresence.get(userId);
        if (record) {
          console.log(
            `[Presence] Removing stale user ${record.userName} from room ${roomName}`
          );
          roomPresence.delete(userId);
          totalCleaned++;
        }
      });

      // Clean up empty rooms
      if (roomPresence.size === 0) {
        this.presence.delete(roomName);
      }
    });

    if (totalCleaned > 0) {
      console.log(`[Presence] Cleaned up ${totalCleaned} stale presence records`);
    }
  }

  /**
   * Shutdown service
   */
  shutdown() {
    clearInterval(this.cleanupInterval);
    this.presence.clear();
    console.log('[Presence] Service shutdown');
  }

  /**
   * Get presence statistics
   */
  getStats(): {
    totalRooms: number;
    totalUsers: number;
    roomStats: { roomName: string; userCount: number }[];
  } {
    const roomStats: { roomName: string; userCount: number }[] = [];
    let totalUsers = 0;

    this.presence.forEach((roomPresence, roomName) => {
      const userCount = roomPresence.size;
      roomStats.push({ roomName, userCount });
      totalUsers += userCount;
    });

    return {
      totalRooms: this.presence.size,
      totalUsers,
      roomStats,
    };
  }
}
