import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditLog } from './entities/audit-log.entity.js';
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entityName: string;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger('Audit');

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  // Never throws: a failed audit write must not fail the user's request.
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          actor: entry.actorUserId ? { id: entry.actorUserId } : null,
          action: entry.action,
          entityName: entry.entityName,
          entityId: entry.entityId,
          oldValues: entry.oldValues,
          newValues: entry.newValues,
          ipAddress: entry.ipAddress,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Could not write audit log for ${entry.action}: ${(error as Error).message}`,
      );
    }
  }

  async findAll(query: AuditLogQueryDto) {
    const { page, limit } = query;
    const qb = this.auditRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action) {
      qb.andWhere('log.action LIKE :action', { action: `${query.action} %` });
    }
    if (query.entityName) {
      qb.andWhere('LOWER(log.entityName) = LOWER(:entityName)', {
        entityName: query.entityName,
      });
    }
    if (query.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    }
    if (query.actorUserId) {
      qb.andWhere('actor.id = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    }
    if (query.from) {
      qb.andWhere(
        `log.createdAt >= (:from::date)::timestamp AT TIME ZONE 'Asia/Dhaka'`,
        {
          from: query.from,
        },
      );
    }
    if (query.to) {
      qb.andWhere(
        `log.createdAt < ((:to::date + 1)::timestamp AT TIME ZONE 'Asia/Dhaka')`,
        { to: query.to },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    return paginate(
      rows.map((row) => this.format(row)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string) {
    const row = await this.auditRepo.findOne({
      where: { id },
      relations: { actor: true },
    });
    if (!row) {
      throw new NotFoundException('Audit log not found');
    }
    return this.format(row);
  }

  private format(row: AuditLog) {
    return {
      id: row.id,
      action: row.action,
      entityName: row.entityName,
      entityId: row.entityId,
      actor: row.actor
        ? {
            id: row.actor.id,
            fullName: row.actor.fullName,
            email: row.actor.email,
            role: row.actor.role,
          }
        : null,
      oldValues: row.oldValues,
      newValues: row.newValues,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
    };
  }
}
