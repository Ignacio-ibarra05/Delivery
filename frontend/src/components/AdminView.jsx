import { useState, useEffect } from "react";
import { getAdminuser, getAdminworker, getAdmindelivery, adminCrearUsuario, adminEliminarUsuario, adminEliminarPedido } from "../api";

const TABS = [
  { key: "user",    label: "user" },
  { key: "worker", label: "worker" },
  { key: "delivery",     label: "delivery" },
  { key: "crear",       label: "Crear usuario" },
];

export default function AdminView({ email, onLogout }) {
  const [tab, setTab] = useState("user");
  const [data, setData] = useState({ user: [], worker: [], delivery: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchers = {
    user:     getAdminuser,
    worker: getAdminworker,
    delivery:      getAdmindelivery,
  };

  function recargarTab() {
    if (tab === "crear") return;
    setLoading(true);
    setError("");
    fetchers[tab]()
      .then((res) => {
        if (res.error) { setError(res.error); return; }
        setData((d) => ({ ...d, [tab]: res }));
      })
      .catch(() => setError("Error al cargar los datos."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { recargarTab(); }, [tab]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.headerLogo}>Panel de Administración</span>
          <div style={s.headerRight}>
            <span style={s.headerEmail}>{email}</span>
            <button onClick={onLogout} style={s.logoutBtn}>Salir</button>
          </div>
        </div>
      </header>

      <div style={s.container}>
        <div style={s.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(""); }}
              style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        {tab === "crear" ? (
          <CrearUsuarioForm />
        ) : loading ? (
          <p style={s.muted}>Cargando...</p>
        ) : (
          <>
            {tab === "user"     && <Tablauser     rows={data.user}     onRecargar={recargarTab} />}
            {tab === "worker" && <Tablaworker rows={data.worker} onRecargar={recargarTab} />}
            {tab === "delivery"      && <Tabladelivery      rows={data.delivery}      onRecargar={recargarTab} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Formulario crear usuario (admin) ────────────────────────────
const INITIAL = {
  rut: "", first_name: "", last_name: "", email: "",
  password: "", birth_date: "",
  rol: "CLIENT", contract_date: "",
};

function CrearUsuarioForm() {
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  function set(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setExito("");
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.rol !== "WORKER") delete payload.contract_date;
      if (!payload.birth_date) delete payload.birth_date;

      const res = await adminCrearUsuario(payload);
      if (res.error) { setError(res.error); return; }
      setExito(res.message);
      setForm(INITIAL);
    } catch {
      setError("Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.formCard}>
      <h3 style={s.formTitle}>Crear nuevo usuario</h3>
      <p style={s.formSubtitle}>
        Como administrador puedes crear cuentas con cualquier rol del sistema.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Rol primero para que el formulario adapte los campos */}
        <div style={s.fieldGroup}>
          <label style={s.label}>Rol</label>
          <div style={s.rolBtns}>
            {["CLIENT", "WORKER", "ADMIN"].map((r) => (
              <button
                key={r} type="button"
                onClick={() => setForm((f) => ({ ...f, rol: r }))}
                style={{ ...s.rolBtn, ...(form.rol === r ? s.rolBtnActive : {}) }}
              >
                {r === "CLIENT" ? "Client" : r === "WORKER" ? "Worker" : "Admin"}
              </button>
            ))}
          </div>
        </div>

        <div style={s.grid2}>
          <div style={s.fieldGroup}>
            <label style={s.label}>first_name</label>
            <input type="text" required value={form.first_name} onChange={set("first_name")} style={s.input} placeholder="Juan" />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Last Name</label>
            <input type="text" required value={form.last_name} onChange={set("last_name")} style={s.input} placeholder="Pérez González" />
          </div>
        </div>

        <div style={s.grid2}>
          <div style={s.fieldGroup}>
            <label style={s.label}>RUT</label>
            <input type="text" required value={form.rut} onChange={set("rut")} style={s.input} placeholder="12.345.678-9" />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Fecha de nacimiento</label>
            <input type="date" value={form.birth_date} onChange={set("birth_date")} style={s.input} />
          </div>
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>Correo electrónico</label>
          <input type="email" required value={form.email} onChange={set("email")} style={s.input} placeholder="correo@ejemplo.cl" />
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>Contraseña inicial</label>
          <input type="password" required value={form.password} onChange={set("password")} style={s.input} placeholder="Mínimo 6 caracteres" />
        </div>

        {form.rol === "WORKER" && (
          <div style={s.fieldGroup}>
            <label style={s.label}>Fecha de contratación</label>
            <input type="date" value={form.contract_date} onChange={set("contract_date")} style={s.input} />
          </div>
        )}

        {error && <div style={s.errorBox}>{error}</div>}
        {exito && <div style={s.exitoBox}>{exito}</div>}

        <button type="submit" disabled={loading} style={s.submitBtn}>
          {loading ? "Creando..." : `Crear ${form.rol.toLowerCase()}`}
        </button>
      </form>
    </div>
  );
}

// ── Tablas ───────────────────────────────────────────────────────
function Tablauser({ rows, onRecargar }) {
  const [eliminando, setEliminando] = useState(null);
  const [errorElim, setErrorElim] = useState("");

  async function handleEliminar(email) {
    if (!confirm(`¿Eliminar al usuario ${email}? Esta acción no se puede deshacer.`)) return;
    setEliminando(email);
    setErrorElim("");
    try {
      const res = await adminEliminarUsuario(email);
      if (res.error) { setErrorElim(res.error); return; }
      onRecargar();
    } catch { setErrorElim("Error al eliminar el usuario."); }
    finally { setEliminando(null); }
  }

  return (
    <>
      {errorElim && <div style={s.errorBox}>{errorElim}</div>}
      <Tabla
        titulo={`user registrados (${rows.length})`}
        columnas={["First Name", "Last Name", "Email", "RUT", "State", "Created", ""]}
        filas={rows.map((r) => [
          r.first_name, r.last_name, r.email, r.rut,
          <Pill activo={r.state}>{r.state ? "Activo" : "Inactivo"}</Pill>,
          new Date(r.created_at).toLocaleDateString("es-CL"),
          <button
            onClick={() => handleEliminar(r.email)}
            disabled={eliminando === r.email}
            style={s.elimBtn}
          >{eliminando === r.email ? "…" : "Eliminar"}</button>,
        ])}
      />
    </>
  );
}

function Tablaworker({ rows, onRecargar }) {
  const [eliminando, setEliminando] = useState(null);
  const [errorElim, setErrorElim] = useState("");

  async function handleEliminar(email) {
    if (!confirm(`¿Eliminar al trabajador ${email}? Esta acción no se puede deshacer.`)) return;
    setEliminando(email);
    setErrorElim("");
    try {
      const res = await adminEliminarUsuario(email);
      if (res.error) { setErrorElim(res.error); return; }
      onRecargar();
    } catch { setErrorElim("Error al eliminar el trabajador."); }
    finally { setEliminando(null); }
  }

  return (
    <>
      {errorElim && <div style={s.errorBox}>{errorElim}</div>}
      <Tabla
        titulo={`worker (${rows.length})`}
        columnas={["first_name", "Email", "RUT", "Disponible", "Estado", "Contratado", ""]}
        filas={rows.map((r) => [
          r.first_name + " " + r.last_name, r.email, r.rut,
          <Pill activo={r.available}>{r.available ? "Disponible" : "Ocupado"}</Pill>,
          <Pill activo={r.state}>{r.state ? "Activo" : "Inactivo"}</Pill>,
          r.contract_date ? new Date(r.contract_date).toLocaleDateString("es-CL") : "—",
          <button
            onClick={() => handleEliminar(r.email)}
            disabled={eliminando === r.email}
            style={s.elimBtn}
          >{eliminando === r.email ? "…" : "Eliminar"}</button>,
        ])}
      />
    </>
  );
}

function Tabladelivery({ rows, onRecargar }) {
  const [eliminando, setEliminando] = useState(null);
  const [errorElim, setErrorElim] = useState("");

  async function handleEliminar(id) {
    if (!confirm(`¿Eliminar el pedido #${id.slice(0,8).toUpperCase()}? Esta acción no se puede deshacer.`)) return;
    setEliminando(id);
    setErrorElim("");
    try {
      const res = await adminEliminarPedido(id);
      if (res.error) { setErrorElim(res.error); return; }
      onRecargar();
    } catch { setErrorElim("Error al eliminar el pedido."); }
    finally { setEliminando(null); }
  }

  return (
    <>
      {errorElim && <div style={s.errorBox}>{errorElim}</div>}
      <Tabla
        titulo={`delivery (${rows.length})`}
        columnas={["ID", "CLIENT", "Trabajador", "Estado", "Fecha", ""]}
        filas={rows.map((r) => [
          <code style={{ fontSize: 11 }}>#{r.id.slice(0, 8).toUpperCase()}</code>,
          r.client_email || "—",
          r.worker_email || <span style={{ color: "#bbb" }}>Sin asignar</span>,
          <EstadoPill estado={r.state} />,
          new Date(r.created_at).toLocaleString("es-CL"),
          <button
            onClick={() => handleEliminar(r.id)}
            disabled={eliminando === r.id}
            style={s.elimBtn}
          >{eliminando === r.id ? "…" : "Eliminar"}</button>,
        ])}
      />
    </>
  );
}

function Tabla({ titulo, columnas, filas }) {
  return (
    <div>
      <h3 style={s.tableTitle}>{titulo}</h3>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>{columnas.map((c) => <th key={c} style={s.th}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={columnas.length} style={{ ...s.td, color: "#aaa", textAlign: "center", padding: 32 }}>Sin datos</td></tr>
            ) : filas.map((fila, i) => (
              <tr key={i} style={i % 2 === 0 ? {} : { background: "#fafafa" }}>
                {fila.map((c, j) => <td key={j} style={s.td}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ activo, children }) {
  return (
    <span style={{ ...s.pill, background: activo ? "#f0fff4" : "#fff0f0", color: activo ? "#2d6a4f" : "#c0392b", border: `1px solid ${activo ? "#b7ebd0" : "#f5c2c2"}` }}>
      {children}
    </span>
  );
}

function EstadoPill({ estado }) {
  const map = {
    PENDING: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
    EN_ROUTE: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    DELIVERED: { bg: "#f0fff4", color: "#2d6a4f", border: "#b7ebd0" },
    CANCELLED: { bg: "#fff0f0", color: "#c0392b", border: "#f5c2c2" },
    PUBLICADO: { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff" },
  };
  const st = map[estado] || map.PENDING;
  return <span style={{ ...s.pill, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{estado}</span>;
}

const s = {
  page: { minHeight: "100vh", background: "#f7f7f3", fontFamily: "'Segoe UI', sans-serif" },
  header: { background: "#1a1a1a", color: "#fff", padding: "0 32px", height: 56, display: "flex", alignItems: "center" },
  headerInner: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" },
  headerLogo: { fontWeight: 700, fontSize: 18 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  headerEmail: { fontSize: 13, color: "#aaa" },
  logoutBtn: { background: "none", border: "1px solid #555", color: "#ccc", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 13 },
  container: { maxWidth: 1100, margin: "0 auto", padding: 32 },
  tabs: { display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" },
  tab: { padding: "10px 20px", borderRadius: 8, border: "1.5px solid #e0e0e0", background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#555" },
  tabActive: { background: "#1a1a1a", color: "#fff", border: "1.5px solid #1a1a1a" },
  tableTitle: { margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#1a1a1a" },
  tableWrap: { background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "#f7f7f3", padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #ececec" },
  td: { padding: "12px 16px", fontSize: 14, color: "#333", borderBottom: "1px solid #f5f5f5" },
  pill: { display: "inline-block", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 600 },
  muted: { color: "#aaa", fontSize: 14 },
  errorBox: { background: "#fff0f0", color: "#c0392b", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 },
  exitoBox: { background: "#f0fff4", color: "#2d6a4f", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 },
  // Crear usuario form
  formCard: { background: "#fff", borderRadius: 12, padding: "32px 36px", maxWidth: 620, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  formTitle: { margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#1a1a1a" },
  formSubtitle: { margin: "0 0 28px", fontSize: 13, color: "#999" },
  fieldGroup: { marginBottom: 16 },
  label: { display: "block", marginBottom: 5, fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none", boxSizing: "border-box" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  rolBtns: { display: "flex", gap: 10 },
  rolBtn: { flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid #e0e0e0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#555" },
  rolBtnActive: { background: "#1a1a1a", color: "#fff", border: "1.5px solid #1a1a1a" },
  submitBtn: { width: "100%", padding: 12, background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8 },
  elimBtn: { padding: "4px 12px", background: "#fff5f5", color: "#c0392b", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 },
};
