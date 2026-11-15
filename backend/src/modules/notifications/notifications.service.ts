import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Notification } from './entities/notification.entity.js';
import { User } from '../users/entities/user.entity.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

// In-app notifications (spec section 8). Other modules call notify()
// inside their own transaction so a notification is saved only if the
// action that caused it is saved too.
@Injectable()
export class NotificationsService {
  constructor(private readonly dataSource: DataSource) {}

  async notify(input: NotifyInput, manager: EntityManager = this.dataSource.manager) {
    const repo = manager.getRepository(Notification);

    return repo.save(
      repo.create({
        recipient: { id: input.userId } as User,
        notificationType: input.type,
        title: input.title,
        message: input.message,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
        isRead: false,
      }),
    );
  }

  // Same notification to every active user with a role (e.g. the center staff)
  async notifyRole(
    role: UserRole,
    input: Omit<NotifyInput, 'userId'>,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const users = await manager.getRepository(User).find({
      where: { role, isActive: true },
      select: { id: true },
    });

    for (const user of users) {
      await this.notify({ ...input, userId: user.id }, manager);
    }
  }

  private format(n: Notification) {
    return {
      id: n.id,
      type: n.notificationType,
      title: n.title,
      message: n.message,
      relatedEntityType: n.relatedEntityType,
      relatedEntityId: n.relatedEntityId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }

  async findMine(userId: string, query: NotificationQueryDto) {
    const { page, limit } = query;

    const [items, total] = await this.dataSource.getRepository(Notification).findAndCount({
      where: {
        recipient: { id: userId },
        ...(query.unreadOnly ? { isRead: false } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map((n) => this.format(n)), total, page, limit);
  }

  async unreadCount(userId: string) {
    const unread = await this.dataSource.getRepository(Notification).count({
      where: { recipient: { id: userId }, isRead: false },
    });

    return { unread };
  }

  async markRead(id: string, userId: string) {
    const repo = this.dataSource.getRepository(Notification);
    const notification = await repo.findOne({
      where: { id, recipient: { id: userId } },
    });

    // 404 (not 403) for other people's notifications
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    return this.format(await repo.save(notification));
  }

  async markAllRead(userId: string) {
    const result = await this.dataSource
      .getRepository(Notification)
      .update({ recipient: { id: userId }, isRead: false }, { isRead: true });

    return { updated: result.affected ?? 0 };
  }
}
