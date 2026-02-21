import { NextFunction, Request, Response } from 'express';

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  return res.json({ data, meta, error: null });
}

export function fail(
  res: Response,
  status: number,
  error: string,
  errorCode?: string,
  details?: Record<string, unknown>,
) {
  (res.locals as any).errorCode = errorCode || null;
  return res.status(status).json({ data: null, error, errorCode: errorCode || null, details: details || null });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
