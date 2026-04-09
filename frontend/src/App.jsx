import { useState } from "react";
import AuthForm from "./components/AuthForm";
import ClienteView from "./components/ClienteView";
import TrabajadorView from "./components/TrabajadorView";
import AdminView from "./components/AdminView";

export default function App() {
  const [session, setSession] = useState(null); // { token, rol, email }

  function handleLogin(token, rol, email) {
    localStorage.setItem("token", token);
    setSession({ token, rol, email });
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setSession(null);
  }

  if (!session) {
    return <AuthForm onLogin={handleLogin} />;
  }

  if (session.rol === "CLIENTE") {
    return <ClienteView email={session.email} onLogout={handleLogout} />;
  }

  if (session.rol === "TRABAJADOR") {
    return <TrabajadorView email={session.email} onLogout={handleLogout} />;
  }

  if (session.rol === "ADMIN") {
    return <AdminView email={session.email} onLogout={handleLogout} />;
  }

  return <p>Rol desconocido: {session.rol}</p>;
}
