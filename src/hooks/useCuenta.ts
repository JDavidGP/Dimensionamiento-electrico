// Estado de cuenta/backend — deliberadamente separado de useCircuitos.ts
// (que ya es grande y es pura lógica de cálculo/edición): esto es
// sesión + sincronización con la nube, un tema aparte. App.tsx es quien
// conecta ambos (ej. pasarle a guardarProyectoEnNube el estado armado
// por useCircuitos, o aplicar con aplicarProyectoCargado lo que
// abrirProyectoDesdeNube trae).
import { useState } from "react";
import {
  registrarse,
  iniciarSesion,
  listarProyectosRemotos,
  obtenerProyectoRemoto,
  crearProyectoRemoto,
  actualizarProyectoRemoto,
  borrarProyectoRemoto,
  CONFIG_CUENTA_DEFECTO,
  ErrorCuenta,
} from "../modules/cuenta/clienteBackend.ts";
import type { Usuario, ProyectoRemotoMeta } from "../modules/cuenta/tipos.ts";
import { ApplicationMediator as App } from "../core/ApplicationMediator.ts";
import type { DatosSerializarProyecto, ProyectoSerializado } from "../modules/persistencia/tipos.ts";

const CLAVE_BASE_URL = "dec-cuenta-base-url";
const CLAVE_TOKEN = "dec-cuenta-token";
const CLAVE_USUARIO = "dec-cuenta-usuario";

// localStorage puede fallar (modo privado, cuota) — no es crítico acá,
// mismo criterio que ToggleTema.tsx/ImportarProyectoPDF.tsx.
function leerGuardado(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    // Ídem.
  }
}

export function useCuenta() {
  const [baseUrl, setBaseUrlState] = useState(() => leerGuardado(CLAVE_BASE_URL) ?? CONFIG_CUENTA_DEFECTO.baseUrl);
  const [token, setToken] = useState<string | null>(() => leerGuardado(CLAVE_TOKEN));
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const crudo = leerGuardado(CLAVE_USUARIO);
    if (!crudo) return null;
    try {
      return JSON.parse(crudo) as Usuario;
    } catch {
      return null;
    }
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [proyectosRemotos, setProyectosRemotos] = useState<ProyectoRemotoMeta[]>([]);
  // Id del proyecto en la nube que representa el proyecto ABIERTO ahora
  // mismo — mientras esté vinculado, "Guardar en la nube" actualiza en
  // vez de crear una copia nueva cada vez que se toca el botón. Se
  // desvincula al abrir un archivo local o crear un proyecto nuevo
  // (ver desvincularProyectoRemoto, llamado desde App.tsx).
  const [proyectoRemotoVinculadoId, setProyectoRemotoVinculadoId] = useState<string | null>(null);

  function setBaseUrl(valor: string): void {
    setBaseUrlState(valor);
    guardar(CLAVE_BASE_URL, valor);
  }

  function mensajeError(err: unknown, porDefecto: string): string {
    return err instanceof ErrorCuenta ? err.message : porDefecto;
  }

  function sesionIniciada(resultado: { token: string; usuario: Usuario }): void {
    setToken(resultado.token);
    setUsuario(resultado.usuario);
    guardar(CLAVE_TOKEN, resultado.token);
    guardar(CLAVE_USUARIO, JSON.stringify(resultado.usuario));
  }

  async function registrarCuenta(email: string, password: string, nombre: string): Promise<void> {
    setCargando(true);
    setError("");
    try {
      sesionIniciada(await registrarse(baseUrl, { email, password, nombre }));
    } catch (err) {
      setError(mensajeError(err, "No se pudo crear la cuenta."));
    } finally {
      setCargando(false);
    }
  }

  async function iniciarSesionCuenta(email: string, password: string): Promise<void> {
    setCargando(true);
    setError("");
    try {
      sesionIniciada(await iniciarSesion(baseUrl, { email, password }));
    } catch (err) {
      setError(mensajeError(err, "No se pudo iniciar sesión."));
    } finally {
      setCargando(false);
    }
  }

  function cerrarSesion(): void {
    setToken(null);
    setUsuario(null);
    setProyectosRemotos([]);
    setProyectoRemotoVinculadoId(null);
    guardar(CLAVE_TOKEN, null);
    guardar(CLAVE_USUARIO, null);
  }

  function desvincularProyectoRemoto(): void {
    setProyectoRemotoVinculadoId(null);
  }

  async function refrescarProyectosRemotos(): Promise<void> {
    if (!token) return;
    setCargando(true);
    setError("");
    try {
      setProyectosRemotos(await listarProyectosRemotos(baseUrl, token));
    } catch (err) {
      setError(mensajeError(err, "No se pudieron listar los proyectos."));
    } finally {
      setCargando(false);
    }
  }

  async function guardarProyectoEnNube(nombre: string, estado: DatosSerializarProyecto): Promise<void> {
    if (!token) return;
    setCargando(true);
    setError("");
    try {
      const serializado = App.persistencia.serializar(estado);
      if (proyectoRemotoVinculadoId) {
        await actualizarProyectoRemoto(baseUrl, token, proyectoRemotoVinculadoId, { nombre, datos: serializado });
      } else {
        const creado = await crearProyectoRemoto(baseUrl, token, { nombre, datos: serializado });
        setProyectoRemotoVinculadoId(creado.id);
      }
      await refrescarProyectosRemotos();
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar en la nube."));
    } finally {
      setCargando(false);
    }
  }

  async function abrirProyectoDesdeNube(id: string): Promise<ProyectoSerializado | null> {
    if (!token) return null;
    setCargando(true);
    setError("");
    try {
      const remoto = await obtenerProyectoRemoto(baseUrl, token, id);
      setProyectoRemotoVinculadoId(remoto.id);
      return App.persistencia.deserializar(remoto.datos);
    } catch (err) {
      setError(mensajeError(err, "No se pudo abrir el proyecto."));
      return null;
    } finally {
      setCargando(false);
    }
  }

  async function borrarProyectoEnNube(id: string): Promise<void> {
    if (!token) return;
    setCargando(true);
    setError("");
    try {
      await borrarProyectoRemoto(baseUrl, token, id);
      if (proyectoRemotoVinculadoId === id) setProyectoRemotoVinculadoId(null);
      await refrescarProyectosRemotos();
    } catch (err) {
      setError(mensajeError(err, "No se pudo borrar el proyecto."));
    } finally {
      setCargando(false);
    }
  }

  return {
    baseUrl,
    setBaseUrl,
    token,
    usuario,
    cargando,
    error,
    proyectosRemotos,
    proyectoRemotoVinculadoId,
    registrarCuenta,
    iniciarSesionCuenta,
    cerrarSesion,
    desvincularProyectoRemoto,
    refrescarProyectosRemotos,
    guardarProyectoEnNube,
    abrirProyectoDesdeNube,
    borrarProyectoEnNube,
  };
}
