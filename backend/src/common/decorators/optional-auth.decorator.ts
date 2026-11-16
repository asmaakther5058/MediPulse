import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

// Works without a token; when a valid "Authorization: Bearer" header is sent,
// req.user is filled in so the handler can decide what that caller may see.
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
