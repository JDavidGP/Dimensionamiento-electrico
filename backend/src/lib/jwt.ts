import jwt from "jsonwebtoken";

const EXPIRACION = "7d";

export interface PayloadToken {
  usuarioId: string;
}

function secreto(): string {
  const valor = process.env.JWT_SECRET;
  if (!valor) throw new Error("Falta JWT_SECRET en el entorno.");
  return valor;
}

export function firmarToken(payload: PayloadToken): string {
  return jwt.sign(payload, secreto(), { expiresIn: EXPIRACION });
}

export function verificarToken(token: string): PayloadToken {
  return jwt.verify(token, secreto()) as PayloadToken;
}
