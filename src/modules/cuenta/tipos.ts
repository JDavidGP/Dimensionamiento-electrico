export interface Usuario {
  id: string;
  email: string;
  nombre: string;
}

export interface ProyectoRemotoMeta {
  id: string;
  nombre: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProyectoRemoto extends ProyectoRemotoMeta {
  datos: unknown;
}
