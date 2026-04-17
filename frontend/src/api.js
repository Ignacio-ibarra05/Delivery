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

// Acepta el pedido enviando las coordenadas del trabajador y la sucursal
export async function aceptarPedidoConCoords(pedidoId, coords) {
  const res = await fetch(`${API_URL}/orders/pedidos/${pedidoId}/aceptar`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(coords),
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

// Devuelve el pedido activo del cliente (PENDIENTE o EN_CAMINO), o null si no hay ninguno
export async function getMiPedidoActivo() {
  const res = await fetch(`${API_URL}/orders/pedidos/mi-activo`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Marca el pedido como entregado (solo trabajador)
export async function entregarPedido(pedidoId) {
  const res = await fetch(`${API_URL}/orders/pedidos/${pedidoId}/entregar`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return res.json();
}

// Puntúa el pedido entregado (cliente); rating puede ser 0-5 o null si no quiere puntuar
export async function puntuarPedido(pedidoId, rating) {
  const res = await fetch(`${API_URL}/orders/pedidos/${pedidoId}/puntuar`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ rating }),
  });
  return res.json();
}

// Devuelve el pedido recién entregado sin puntuar del cliente (últimos 10 min), o null
export async function getMiPedidoEntregado() {
  const res = await fetch(`${API_URL}/orders/pedidos/mi-entregado`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Cancela el pedido del cliente (solo si está en estado PENDIENTE)
export async function cancelarPedido(pedidoId) {
  const res = await fetch(`${API_URL}/orders/pedidos/${pedidoId}`, {
    method: "DELETE",
    headers: authHeaders(),
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

// ── Admin: eliminar usuario por email ────────────────
export async function adminEliminarUsuario(email) {
  const res = await fetch(`${API_URL}/orders/admin/usuarios/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.json();
}

// ── Admin: eliminar pedido por id ─────────────────────
export async function adminEliminarPedido(id) {
  const res = await fetch(`${API_URL}/orders/admin/pedidos/${id}`, {
    method: "DELETE",
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
