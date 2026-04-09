const API_URL = "http://localhost:8080/api";

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ── Auth ──────────────────────────────────────────────
export async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

// Registro público — solo crea clientes
export async function register(datos) {
  const res = await fetch(`${API_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return res.json();
}

// ── Productos ─────────────────────────────────────────
export async function getProductos() {
  const res = await fetch(`${API_URL}/orders/productos`, {
    headers: authHeaders(),
  });
  return res.json();
}

// ── Pedidos ───────────────────────────────────────────
export async function getPedidosPendientes() {
  const res = await fetch(`${API_URL}/orders/pedidos/pendientes`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function aceptarPedido(pedidoId) {
  const res = await fetch(`${API_URL}/orders/pedidos/${pedidoId}/aceptar`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return res.json();
}

export async function crearPedido(items) {
  const res = await fetch(`${API_URL}/orders/pedidos`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return res.json();
}

// ── Admin: consultas ──────────────────────────────────
export async function getAdminUsuarios() {
  const res = await fetch(`${API_URL}/orders/admin/usuarios`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function getAdminTrabajadores() {
  const res = await fetch(`${API_URL}/orders/admin/trabajadores`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function getAdminPedidos() {
  const res = await fetch(`${API_URL}/orders/admin/pedidos`, {
    headers: authHeaders(),
  });
  return res.json();
}

// ── Admin: crear usuario con cualquier rol ────────────
export async function adminCrearUsuario(datos) {
  const res = await fetch(`${API_URL}/users/admin/crear-usuario`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(datos),
  });
  return res.json();
}
