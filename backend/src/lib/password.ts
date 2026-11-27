import bcrypt from "bcryptjs";

const RONDAS_SAL = 12;

export function hashearPassword(password: string): Promise<string> {
  return bcrypt.hash(password, RONDAS_SAL);
}

export function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
