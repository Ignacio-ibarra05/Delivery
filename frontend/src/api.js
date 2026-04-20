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

// Registro público — solo crea CLIENTs
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

// ── delivery ───────────────────────────────────────────
export async function getdeliveryPendientes() {
  const res = await fetch(`${API_URL}/orders/delivery/pendientes`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function aceptarPedido(pedidoId) {
  const res = await fetch(`${API_URL}/orders/delivery/${pedidoId}/aceptar`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return res.json();
}

// Acepta el pedido enviando las coordenadas del trabajador y la sucursal
export async function aceptarPedidoConCoords(pedidoId, coords) {
  const res = await fetch(`${API_URL}/orders/delivery/${pedidoId}/aceptar`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(coords),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error || `Error ${res.status}` };
  }
  return data;
}

export async function crearPedido(items) {
  const res = await fetch(`${API_URL}/orders/delivery`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return res.json();
}

// Devuelve el pedido activo del CLIENT (PENDIENTE o EN_CAMINO), o null si no hay ninguno
export async function getMiPedidoActivo() {
  const res = await fetch(`${API_URL}/orders/delivery/mi-activo`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Marca el pedido como entregado (solo trabajador)
// {{base_url}}/api/orders/delivery/{{pedido_id}}/entregar
export async function entregarPedido(pedidoId) {
  const res = await fetch(`${API_URL}/orders/delivery/${pedidoId}/entregar`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error || `Error ${res.status}` };
  }
  return data;
}

// Puntúa el pedido entregado (CLIENT); rating puede ser 0-5 o null si no quiere puntuar
export async function puntuarPedido(pedidoId, rating) {
  const res = await fetch(`${API_URL}/orders/delivery/${pedidoId}/puntuar`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ rating }),
  });
  return res.json();
}

// Devuelve el pedido recién entregado sin puntuar del CLIENT (últimos 10 min), o null
export async function getMiPedidoEntregado() {
  const res = await fetch(`${API_URL}/orders/delivery/mi-entregado`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Cancela el pedido del CLIENT (solo si está en estado PENDIENTE)
export async function cancelarPedido(pedidoId) {
  const res = await fetch(`${API_URL}/orders/delivery/${pedidoId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.json();
}

// ── Admin: consultas ──────────────────────────────────
export async function getAdminuser() {
  const res = await fetch(`${API_URL}/orders/admin/user`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function getAdminworker() {
  const res = await fetch(`${API_URL}/orders/admin/worker`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function getAdmindelivery() {
  const res = await fetch(`${API_URL}/orders/admin/delivery`, {
    headers: authHeaders(),
  });
  return res.json();
}

// ── Admin: eliminar usuario por email ────────────────
export async function adminEliminarUsuario(email) {
  const res = await fetch(`${API_URL}/orders/admin/user/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.json();
}

// ── Admin: eliminar pedido por id ─────────────────────
export async function adminEliminarPedido(id) {
  const res = await fetch(`${API_URL}/orders/admin/delivery/${id}`, {
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
