import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { instanceToPlain } from 'class-transformer';
import type { Request } from 'express';
import { isIP } from 'node:net';
import { from, Observable } from 'rxjs';
import { mergeMap, switchMap } from 'rxjs/operators';
import {
  DataSource,
  EntityMetadata,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';

import { AuditLogsService } from './audit-logs.service.js';
import {
  AUDITED_ROUTES,
  IGNORED_DIFF_KEYS,
  SECRET_KEYS,
  SKIPPED_ROUTES,
} from './audit.constants.js';
import type { AuditAction } from './audit.constants.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

type Plain = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Writes one audit_logs row for every successful create / update / delete:
// who did it, what changed (old -> new), on which row, and from which IP.
// Failed requests are not logged (nothing changed).
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogs: AuditLogsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const routePath: string | undefined = req.route?.path;
    if (
      !WRITE_METHODS.has(req.method) ||
      !routePath ||
      SKIPPED_ROUTES.has(routePath)
    ) {
      return next.handle();
    }

    const table = AUDITED_ROUTES[routePath.split('/')[1]];
    const metadata = table
      ? this.dataSource.entityMetadatas.find((m) => m.tableName === table)
      : undefined;
    if (!metadata) {
      return next.handle();
    }

    const params = req.params as Record<string, string>;
    const action = this.actionOf(req.method, params);
    const actorId = req.user?.id ?? null;
    const where = this.targetOf(params, routePath, actorId, metadata);

    return from(this.load(metadata, where)).pipe(
      switchMap((before) =>
        next.handle().pipe(
          mergeMap(async (response) => {
            await this.write({
              req,
              routePath,
              action,
              actorId,
              metadata,
              before,
              response,
            });
            return response;
          }),
        ),
      ),
    );
  }

  // POST /appointments -> CREATE, POST /payments/:id/confirm -> UPDATE
  private actionOf(
    method: string,
    params: Record<string, string>,
  ): AuditAction {
    if (method === 'DELETE') return 'DELETE';
    if (method === 'POST' && Object.keys(params).length === 0) return 'CREATE';
    return 'UPDATE';
  }

  // Which existing row this request changes (null for a create)
  private targetOf(
    params: Record<string, string>,
    routePath: string,
    actorId: string | null,
    metadata: EntityMetadata,
  ): FindOptionsWhere<ObjectLiteral> | null {
    if (params.id) {
      return UUID.test(params.id) ? { id: params.id } : null;
    }
    const isOwnProfile =
      routePath.split('/').includes('me') || routePath.startsWith('/auth/');
    if (!isOwnProfile || !actorId) {
      return null;
    }
    if (metadata.tableName === 'users') {
      return { id: actorId };
    }
    return metadata.findRelationWithPropertyPath('user')
      ? { user: { id: actorId } }
      : null;
  }

  private async load(
    metadata: EntityMetadata,
    where: FindOptionsWhere<ObjectLiteral> | null,
  ): Promise<Plain | null> {
    if (!where) return null;
    try {
      const row = await this.dataSource
        .getRepository(metadata.target)
        .findOne({ where, loadRelationIds: true });
      return row ? this.clean(row) : null;
    } catch {
      return null;
    }
  }

  private async write(input: {
    req: Request & { user?: AuthUser };
    routePath: string;
    action: AuditAction;
    actorId: string | null;
    metadata: EntityMetadata;
    before: Plain | null;
    response: unknown;
  }) {
    const { req, routePath, action, metadata, before, response } = input;

    const entityId =
      (before?.id as string | undefined) ??
      this.idFromResponse(response, metadata) ??
      null;

    let after: Plain | null = null;
    if (action !== 'DELETE') {
      after = entityId ? await this.load(metadata, { id: entityId }) : null;
      after ??= this.clean(req.body ?? {});
    }

    let oldValues = before;
    let newValues = after;
    if (action === 'CREATE') {
      oldValues = null;
    } else if (action === 'UPDATE' && before && after) {
      [oldValues, newValues] = this.diff(before, after);
    } else if (action === 'DELETE') {
      newValues = null;
    }

    // Registration has no logged-in user yet: the new account is the actor
    const actorId =
      input.actorId ??
      this.idOf((response as Plain | null)?.user) ??
      (metadata.tableName === 'users' ? entityId : null);

    await this.auditLogs.record({
      actorUserId: actorId,
      action: `${action} ${routePath}`.slice(0, 100),
      entityName: String(metadata.name),
      entityId,
      oldValues,
      newValues,
      ipAddress: this.ipOf(req),
    });
  }

  // { id } or { message, appointment: { id } } or { user, doctor: { id } }
  private idFromResponse(
    response: unknown,
    metadata: EntityMetadata,
  ): string | null {
    if (!response || typeof response !== 'object') return null;
    const body = response as Plain;
    const own = this.idOf(body);
    if (own) return own;

    const name = String(metadata.name);
    const preferred = body[name.charAt(0).toLowerCase() + name.slice(1)];
    return (
      this.idOf(preferred) ??
      Object.values(body)
        .map((value) => this.idOf(value))
        .find((id) => id !== null) ??
      null
    );
  }

  private idOf(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    const id = (value as Plain).id;
    return typeof id === 'string' && UUID.test(id) ? id : null;
  }

  // Plain JSON, with @Exclude() fields and anything secret removed
  private clean(value: unknown): Plain {
    const plain = JSON.parse(JSON.stringify(instanceToPlain(value))) as Plain;
    for (const key of Object.keys(plain)) {
      if (SECRET_KEYS.has(key)) delete plain[key];
    }
    return plain;
  }

  // Only the fields that changed
  private diff(before: Plain, after: Plain): [Plain, Plain] {
    const oldValues: Plain = {};
    const newValues: Plain = {};
    for (const key of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      if (IGNORED_DIFF_KEYS.has(key)) continue;
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        oldValues[key] = before[key] ?? null;
        newValues[key] = after[key] ?? null;
      }
    }
    return [oldValues, newValues];
  }

  private ipOf(req: Request): string | null {
    const ip = (req.ip ?? req.socket?.remoteAddress ?? '').replace(
      /^::ffff:/,
      '',
    );
    return isIP(ip) ? ip : null;
  }
}
