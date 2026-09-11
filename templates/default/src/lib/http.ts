/**
 * Small helpers shared by the route handlers: typed errors and a wrapper that turns
 * them into JSON responses with a proper status code.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequest extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class Unauthorized extends HttpError {
  constructor(message: string) {
    super(403, message);
  }
}

export class NotFound extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

/** Configuration (.env) is missing or invalid. */
export class EnvError extends HttpError {
  constructor(public readonly errors: string[]) {
    super(503, `Application is not configured: ${errors.join('; ')}`);
  }
}

/** The Document Server could not be reached or returned an unexpected response. */
export class DocumentServerError extends HttpError {
  constructor(message: string) {
    super(502, message);
  }
}

type Handler<TContext> = (request: Request, context: TContext) => Promise<Response>;

/** Wraps a route handler and converts thrown errors into `{ error: string }` JSON. */
export function handleRoute<TContext = unknown>(handler: Handler<TContext>): Handler<TContext> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status >= 500) console.error(`[api] ${error.message}`);
        return Response.json({ error: error.message }, { status: error.status });
      }
      console.error('[api] Unexpected error', error);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/** Builds a `Content-Disposition: attachment` header that survives non-ASCII names. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
