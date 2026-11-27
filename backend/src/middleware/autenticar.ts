import type { Request, Response, NextFunction } from "express";
import { verificarToken } from "../lib/jwt.js";

// Agrega usuarioId a Request una vez verificado el Bearer token —
// evita castear `req` a `any` en cada ruta protegida.
declare module "express-serve-static-core" {
  interface Request {
    usuarioId?: string;
  }
}

export function autenticar(req: Request, res: Response, next: NextFunction): void {
  const encabezado = req.headers.authorization;
  if (!encabezado?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Falta el token de autenticación." });
    return;
  }
  const token = encabezado.slice("Bearer ".length);
  try {
    const payload = verificarToken(token);
    req.usuarioId = payload.usuarioId;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado." });
  }
}
