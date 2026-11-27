import type { NextFunction, Request, Response } from "express";

// Express 4 no reenvía automáticamente una promesa rechazada de un
// handler async a next(err) — sin esto, un error (ej. un UUID
// malformado en req.params.id) deja la request colgada en vez de
// responder con un error claro.
type HandlerAsync = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function manejarAsync(handler: HandlerAsync) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
