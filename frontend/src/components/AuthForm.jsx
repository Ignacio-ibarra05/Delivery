import { useState } from "react";
import { login, register } from "../api";

const INITIAL_REG = {
  rut: "", first_name: "", last_name: "",
  email: "", password: "", confirmar: "",
  birth_date: "",
};

export default function AuthForm({ onLogin }) {
  const [modo, setModo] = useState("login"); // "login" | "register"
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState(INITIAL_REG);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Login ─────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setExito("");
    setLoading(true);
    try {
      const res = await login(loginData.email, loginData.password);
      if (res.error) { setError(res.error); return; }
      onLogin(res.token, res.rol, loginData.email);
    } catch {
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // ── Registro ──────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault();
    setError(""); setExito("");

    if (regData.password !== regData.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (regData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const { confirmar, ...datos } = regData;
      const res = await register(datos);
      if (res.error) { setError(res.error); return; }
      setExito(res.message);
      setRegData(INITIAL_REG);
      setTimeout(() => { setModo("login"); setExito(""); }, 2500);
    } catch {
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>
          {modo === "login" ? "Bienvenido" : "Crear cuenta"}
        </h1>
        <p style={s.subtitle}>
          {modo === "login"
            ? "Ingresa tus credenciales para continuar"
            : "Completa el formulario para registrarte como CLIENT"}
        </p>

        {/* ── FORMULARIO LOGIN ── */}
        {modo === "login" && (
          <form onSubmit={handleLogin} style={s.form}>
            <Field label="Correo electrónico">
              <input
                type="email" placeholder="correo@ejemplo.cl"
                value={loginData.email} required style={s.input}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              />
            </Field>
            <Field label="Contraseña">
              <input
                type="password" placeholder="••••••••"
                value={loginData.password} required style={s.input}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              />
            </Field>
            {error && <Alerta tipo="error">{error}</Alerta>}
            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        )}

        {/* ── FORMULARIO REGISTRO ── */}
        {modo === "register" && (
          <form onSubmit={handleRegister} style={s.form}>
            <div style={s.row}>
              <Field label="first_name">
                <input
                  type="text" placeholder="Juan"
                  value={regData.first_name} required style={s.input}
                  onChange={(e) => setRegData({ ...regData, first_name: e.target.value })}
                />
              </Field>
              <Field label="Last Name">
                <input
                  type="text" placeholder="Pérez González"
                  value={regData.last_name} required style={s.input}
                  onChange={(e) => setRegData({ ...regData, last_name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="RUT">
              <input
                type="text" placeholder="12.345.678-9"
                value={regData.rut} required style={s.input}
                onChange={(e) => setRegData({ ...regData, rut: e.target.value })}
              />
            </Field>
            <Field label="Correo electrónico">
              <input
                type="email" placeholder="correo@ejemplo.cl"
                value={regData.email} required style={s.input}
                onChange={(e) => setRegData({ ...regData, email: e.target.value })}
              />
            </Field>
            <Field label="Fecha de nacimiento">
              <input
                type="date"
                value={regData.birth_date} style={s.input}
                onChange={(e) => setRegData({ ...regData, birth_date: e.target.value })}
              />
            </Field>
            <div style={s.row}>
              <Field label="Contraseña">
                <input
                  type="password" placeholder="Mínimo 6 caracteres"
                  value={regData.password} required style={s.input}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                />
              </Field>
              <Field label="Confirmar contraseña">
                <input
                  type="password" placeholder="Repite la contraseña"
                  value={regData.confirmar} required style={s.input}
                  onChange={(e) => setRegData({ ...regData, confirmar: e.target.value })}
                />
              </Field>
            </div>
            {error  && <Alerta tipo="error">{error}</Alerta>}
            {exito  && <Alerta tipo="exito">{exito}</Alerta>}
            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? "Creando cuenta..." : "Registrarme como CLIENT"}
            </button>
          </form>
        )}

        <button
          onClick={() => { setModo(modo === "login" ? "register" : "login"); setError(""); setExito(""); }}
          style={s.toggle}
        >
          {modo === "login"
            ? "¿No tienes cuenta? Regístrate"
            : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14, flex: 1 }}>
      <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Alerta({ tipo, children }) {
  const colores = {
    error: { bg: "#fff0f0", color: "#c0392b" },
    exito: { bg: "#f0fff4", color: "#2d6a4f" },
  };
  const c = colores[tipo];
  return (
    <div style={{ background: c.bg, color: c.color, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
      {children}
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif", padding: 20 },
  card: { background: "#fff", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 520, boxShadow: "0 4px 32px rgba(0,0,0,0.08)", textAlign: "center" },
  logo: { fontSize: 40, marginBottom: 14 },
  title: { margin: "0 0 8px", fontSize: 24, fontWeight: 700, color: "#1a1a1a" },
  subtitle: { margin: "0 0 28px", fontSize: 13, color: "#999" },
  form: { textAlign: "left" },
  row: { display: "flex", gap: 12 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none", boxSizing: "border-box" },
  btn: { width: "100%", padding: 12, background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  toggle: { marginTop: 18, background: "none", border: "none", color: "#777", fontSize: 13, cursor: "pointer", textDecoration: "underline" },
};
