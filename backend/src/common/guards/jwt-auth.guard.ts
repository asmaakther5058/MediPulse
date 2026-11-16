import {
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    if (isPublic) {
      return true;
    }

    // @OptionalAuth(): anonymous callers pass; a token, if sent, must be valid
    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isOptional && !context.switchToHttp().getRequest().headers?.authorization) {
      return true;
    }

    return super.canActivate(context);
  }
}