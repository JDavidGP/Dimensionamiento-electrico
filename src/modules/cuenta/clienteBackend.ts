// Cliente para el backend propio de DEC (cuentas + guardar/cargar
// proyectos en la nube) — usuario, 2026-11-27: "armemos el backend",
// alcance acordado de "solo cuentas + guardar/cargar proyectos", nunca
// mueve el cálculo eléctrico al servidor. Mismo criterio que
// modules/iaLocal/ollamaClient.ts: módulo puro en cuanto a lógica
// (arma la petición, traduce la respuesta) pero SÍ hace fetch — por
// eso vive en modules/ y se llama directo desde el hook/componente,
// sin pasar por ApplicationMediator (igual que ollamaClient).
import type { Usuario, ProyectoRemotoMeta, ProyectoRemoto } from "./tipos.ts";

export const CONFIG_CUENTA_DEFECTO = {
  baseUrl: "http://localhost:3001",
};

export class ErrorCuenta extends Error {}

interface FilaProyectoMeta {
  id: string;
  nombre: string;
  creado_en: string;
  actualizado_en: string;
}

interface FilaProyecto extends FilaProyectoMeta {
  datos: unknown;
}

async function peticion<T>(baseUrl: string, ruta: string, opciones: RequestInit = {}): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}${ruta}`, {
      ...opciones,
      headers: { "Content-Type": "application/json", ...(opciones.headers as Record<string, string> | undefined) },
    });
  } catch {
    throw new ErrorCuenta("No se pudo conectar con el servidor — revisá la URL configurada y que esté corriendo.");
  }
  if (resp.status === 204) return undefined as T;

  let cuerpo: unknown = null;
  try {
    cuerpo = await resp.json();
  } catch {
    // Respuesta sin cuerpo JSON (no debería pasar en este backend, pero
    // no vale la pena reventar la UI por eso).
  }
  if (!resp.ok) {
    const mensaje = (cuerpo as { error?: string } | null)?.error ?? `Error del servidor (${resp.status}).`;
    throw new ErrorCuenta(mensaje);
  }
  return cuerpo as T;
}

function autorizacion(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function metaDesdeFila(fila: FilaProyectoMeta): ProyectoRemotoMeta {
  return { id: fila.id, nombre: fila.nombre, creadoEn: fila.creado_en, actualizadoEn: fila.actualizado_en };
}

export function registrarse(baseUrl: string, datos: { email: string; password: string; nombre: string }): Promise<{ token: string; usuario: Usuario }> {
  return peticion(baseUrl, "/auth/registro", { method: "POST", body: JSON.stringify(datos) });
}

export function iniciarSesion(baseUrl: string, datos: { email: string; password: string }): Promise<{ token: string; usuario: Usuario }> {
  return peticion(baseUrl, "/auth/login", { method: "POST", body: JSON.stringify(datos) });
}

export async function listarProyectosRemotos(baseUrl: string, token: string): Promise<ProyectoRemotoMeta[]> {
  const filas = await peticion<FilaProyectoMeta[]>(baseUrl, "/proyectos", { headers: autorizacion(token) });
  return filas.map(metaDesdeFila);
}

export async function obtenerProyectoRemoto(baseUrl: string, token: string, id: string): Promise<ProyectoRemoto> {
  const fila = await peticion<FilaProyecto>(baseUrl, `/proyectos/${id}`, { headers: autorizacion(token) });
  return { ...metaDesdeFila(fila), datos: fila.datos };
}

export function crearProyectoRemoto(baseUrl: string, token: string, datos: { nombre: string; datos: unknown }): Promise<{ id: string }> {
  return peticion(baseUrl, "/proyectos", { method: "POST", headers: autorizacion(token), body: JSON.stringify(datos) });
}

export function actualizarProyectoRemoto(baseUrl: string, token: string, id: string, cambios: { nombre?: string; datos?: unknown }): Promise<void> {
  return peticion(baseUrl, `/proyectos/${id}`, { method: "PUT", headers: autorizacion(token), body: JSON.stringify(cambios) });
}

export function borrarProyectoRemoto(baseUrl: string, token: string, id: string): Promise<void> {
  return peticion(baseUrl, `/proyectos/${id}`, { method: "DELETE", headers: autorizacion(token) });
}
