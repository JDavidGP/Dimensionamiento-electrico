// Pruebas de integración contra una Postgres real (DATABASE_URL del
// .env local) — sin mocks de la base de datos, igual criterio que el
// frontend (tests/ corre contra un build real, no contra stubs).
// Cada corrida usa un email único (random) para no chocar con datos de
// corridas anteriores, y borra lo que creó al final.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "./app.js";
import { pool } from "./db.js";

const sufijo = Math.random().toString(36).slice(2);
const email = `prueba-${sufijo}@dec.test`;
const password = "contraseña-de-prueba-123";

after(async () => {
  await pool.query("DELETE FROM usuarios WHERE email = $1", [email]);
  await pool.end();
});

test("registro rechaza contraseña corta", async () => {
  const resp = await request(app).post("/auth/registro").send({ email, password: "corta", nombre: "Prueba" });
  assert.equal(resp.status, 400);
});

test("registro crea usuario y devuelve token", async () => {
  const resp = await request(app).post("/auth/registro").send({ email, password, nombre: "Técnico de prueba" });
  assert.equal(resp.status, 201);
  assert.ok(resp.body.token);
  assert.equal(resp.body.usuario.email, email);
});

test("registro duplicado es rechazado", async () => {
  const resp = await request(app).post("/auth/registro").send({ email, password, nombre: "Otra vez" });
  assert.equal(resp.status, 409);
});

test("login con contraseña incorrecta falla", async () => {
  const resp = await request(app).post("/auth/login").send({ email, password: "equivocada" });
  assert.equal(resp.status, 401);
});

test("login correcto devuelve token", async () => {
  const resp = await request(app).post("/auth/login").send({ email, password });
  assert.equal(resp.status, 200);
  assert.ok(resp.body.token);
});

test("rutas de proyectos exigen autenticación", async () => {
  const resp = await request(app).get("/proyectos");
  assert.equal(resp.status, 401);
});

test("flujo completo: crear, listar, leer, actualizar y borrar un proyecto", async () => {
  const login = await request(app).post("/auth/login").send({ email, password });
  const token = login.body.token as string;
  const autorizacion = { Authorization: `Bearer ${token}` };

  const datosProyecto = { proyecto: { nombre: "Casa de prueba" }, circuitos: [{ id: "c1", nombre: "Iluminación" }] };

  const creado = await request(app)
    .post("/proyectos")
    .set(autorizacion)
    .send({ nombre: "Proyecto de prueba", datos: datosProyecto });
  assert.equal(creado.status, 201);
  const id = creado.body.id as string;

  const lista = await request(app).get("/proyectos").set(autorizacion);
  assert.equal(lista.status, 200);
  assert.ok(lista.body.some((p: { id: string }) => p.id === id));
  // La lista no debe traer el blob `datos` completo (solo metadatos).
  assert.equal(lista.body[0].datos, undefined);

  const leido = await request(app).get(`/proyectos/${id}`).set(autorizacion);
  assert.equal(leido.status, 200);
  assert.deepEqual(leido.body.datos, datosProyecto);

  const actualizado = await request(app)
    .put(`/proyectos/${id}`)
    .set(autorizacion)
    .send({ nombre: "Proyecto renombrado" });
  assert.equal(actualizado.status, 204);

  const releido = await request(app).get(`/proyectos/${id}`).set(autorizacion);
  assert.equal(releido.body.nombre, "Proyecto renombrado");
  // datos no se tocó al actualizar solo el nombre.
  assert.deepEqual(releido.body.datos, datosProyecto);

  const borrado = await request(app).delete(`/proyectos/${id}`).set(autorizacion);
  assert.equal(borrado.status, 204);

  const noEncontrado = await request(app).get(`/proyectos/${id}`).set(autorizacion);
  assert.equal(noEncontrado.status, 404);
});

test("un usuario no puede leer el proyecto de otro", async () => {
  const otroEmail = `prueba-otro-${sufijo}@dec.test`;
  const registroOtro = await request(app)
    .post("/auth/registro")
    .send({ email: otroEmail, password, nombre: "Otro usuario" });
  const tokenOtro = registroOtro.body.token as string;

  const login = await request(app).post("/auth/login").send({ email, password });
  const token = login.body.token as string;

  const creado = await request(app)
    .post("/proyectos")
    .set({ Authorization: `Bearer ${token}` })
    .send({ nombre: "Privado", datos: {} });
  const id = creado.body.id as string;

  const intento = await request(app)
    .get(`/proyectos/${id}`)
    .set({ Authorization: `Bearer ${tokenOtro}` });
  assert.equal(intento.status, 404);

  await pool.query("DELETE FROM usuarios WHERE email = $1", [otroEmail]);
});
