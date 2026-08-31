// PENDIENTE — requiere que exista el nivel "Tablero" (Fase 6), porque
// balancear fases significa repartir circuitos monofásicos entre las
// líneas L1/L2/L3 de UN tablero — no tiene sentido calcularlo mirando un
// solo circuito aislado, como si tienen las demás funciones de este
// motor.
//
// Idea de forma (a confirmar cuando se implemente):
//
// function balanceFases(circuitosDelTablero) {
//   // 1. Cada circuito monofásico/bifásico debe tener asignada una línea
//   //    (L1, L2 o L3) — probablemente un campo nuevo en el circuito.
//   // 2. Sumar potencia (o corriente) por línea.
//   // 3. Calcular el % de desbalance entre la línea más cargada y la
//   //    menos cargada: (max - min) / promedio * 100
//   // 4. Devolver advertencia si supera un umbral (típicamente 10-20%).
//   //
//   // return { porLinea: { L1: watts, L2: watts, L3: watts },
//   //          porcentajeDesbalance, advertencia };
// }
//
// export function balanceFases(circuitosDelTablero) {
//   throw new Error("balanceFases() aún no implementado — pendiente del nivel Tablero.");
// }
