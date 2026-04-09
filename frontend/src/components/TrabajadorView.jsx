import { useState, useEffect, useRef } from "react";
import { getPedidosPendientes, aceptarPedido } from "../api";

// ── Ubicación base del repartidor (Costanera Center, Santiago) ──
const TRABAJADOR_LAT = -33.4172;
const TRABAJADOR_LNG = -70.6065;
const TRABAJADOR_LUGAR = "Costanera Center";

// ── Ubicación base del cliente (Parque Titanium) ──
const CLIENTE_LAT = -33.4197;
const CLIENTE_LNG = -70.6058;
const CLIENTE_LUGAR = "Parque Titanium";

function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const DIST_TOTAL = distanciaKm(TRABAJADOR_LAT, TRABAJADOR_LNG, CLIENTE_LAT, CLIENTE_LNG);
const TIEMPO_EST = Math.round((DIST_TOTAL / 20) * 60);

// ── Mapa Leaflet que muestra la ruta trabajador → cliente ──
function MapaRutaLeaflet() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (mapInstanceRef.current || !window.L) return;
    const L = window.L;

    const centerLat = (TRABAJADOR_LAT + CLIENTE_LAT) / 2;
    const centerLng = (TRABAJADOR_LNG + CLIENTE_LNG) / 2;

    const map = L.map(mapRef.current, { center: [centerLat, centerLng], zoom: 15 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Marcador del trabajador (repartidor)
    L.marker([TRABAJADOR_LAT, TRABAJADOR_LNG], {
      icon: L.divIcon({
        className: "",
        html: `<div style="background:#f4a261;color:#fff;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:22px;border:3px solid #fff;box-shadow:0 3px 10px rgba(244,162,97,0.5);">🛵</div>`,
        iconSize: [42,42], iconAnchor: [21,21],
      })
    }).addTo(map).bindPopup(`<b>🛵 Tu posición</b><br>${TRABAJADOR_LUGAR}`).openPopup();

    // Marcador del cliente
    L.marker([CLIENTE_LAT, CLIENTE_LNG], {
      icon: L.divIcon({
        className: "",
        html: `<div style="background:#e63946;color:#fff;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:22px;border:3px solid #fff;box-shadow:0 3px 10px rgba(230,57,70,0.5);">📦</div>`,
        iconSize: [42,42], iconAnchor: [21,21],
      })
    }).addTo(map).bindPopup(`<b>📦 Destino del cliente</b><br>${CLIENTE_LUGAR}`);

    // Línea de ruta entre los dos puntos
    const rutaCoords = [
      [TRABAJADOR_LAT, TRABAJADOR_LNG],
      [-33.4180, -70.6062],
      [-33.4185, -70.6060],
      [-33.4190, -70.6059],
      [CLIENTE_LAT, CLIENTE_LNG],
    ];

    L.polyline(rutaCoords, {
      color: "#2d6a4f",
      weight: 5,
      opacity: 0.85,
      dashArray: "10,6",
      lineCap: "round",
    }).addTo(map);

    // Ajustar zoom para ver ambos puntos
    map.fitBounds([
      [TRABAJADOR_LAT, TRABAJADOR_LNG],
      [CLIENTE_LAT, CLIENTE_LNG],
    ], { padding: [40, 40] });

    mapInstanceRef.current = map;
  }, []);

  return (
    <div style={rm.mapaWrap}>
      <div style={rm.mapaTitle}>🗺️ Ruta de entrega</div>
      <div ref={mapRef} style={{ width: "100%", height: 300 }} />
      <div style={rm.leyenda}>
        <span style={rm.leyItem}><span style={{...rm.dot, background:"#f4a261"}} /> Tu posición ({TRABAJADOR_LUGAR})</span>
        <span style={rm.leyItem}><span style={{...rm.dot, background:"#e63946"}} /> Cliente ({CLIENTE_LUGAR})</span>
        <span style={rm.leyItem}><span style={{...rm.dot, background:"#2d6a4f"}} /> Ruta estimada</span>
      </div>
    </div>
  );
}

// ── Modal con detalle del pedido y ruta Leaflet ──
function ModalPedido({ pedido, onCerrar, onAceptar, onIgnorar, aceptando }) {
  const totalPedido = pedido.items
    ? pedido.items.reduce((s, i) => s + (i.precio || 0) * i.cantidad, 0)
    : 0;

  return (
    <div style={mo.overlay} onClick={onCerrar}>
      <div style={mo.modal} onClick={e => e.stopPropagation()}>
        <div style={mo.modalHeader}>
          <div>
            <p style={mo.modalId}>Pedido #{pedido.id.slice(0,8).toUpperCase()}</p>
            <p style={mo.modalFecha}>{new Date(pedido.created_at).toLocaleString("es-CL")}</p>
          </div>
          <button onClick={onCerrar} style={mo.closeBtn}>✕</button>
        </div>

        <div style={mo.modalBody}>
          {/* Info cliente */}
          <div style={mo.seccion}>
            <p style={mo.secLabel}>👤 Cliente</p>
            <p style={mo.secValor}>{pedido.cliente_nombre || pedido.cliente_email}</p>
            <p style={mo.secSub}>{pedido.cliente_email}</p>
            <p style={mo.secSub}>📍 {CLIENTE_LUGAR}</p>
          </div>

          {/* Detalle del pedido */}
          {pedido.items && pedido.items.length > 0 && (
            <div style={mo.seccion}>
              <p style={mo.secLabel}>🧾 Detalle del pedido</p>
              <div style={mo.itemsList}>
                {pedido.items.map((item, i) => (
                  <div key={i} style={mo.itemRow}>
                    <span>{item.nombre} ×{item.cantidad}</span>
                    <span style={mo.itemPrecio}>${((item.precio||0)*item.cantidad).toLocaleString("es-CL")}</span>
                  </div>
                ))}
              </div>
              <div style={mo.totalRow}>
                <span style={mo.totalLabel}>💰 Total del pedido</span>
                <strong style={mo.totalValor}>${totalPedido.toLocaleString("es-CL")}</strong>
              </div>
            </div>
          )}

          {/* Info distancia */}
          <div style={mo.seccion}>
            <p style={mo.secLabel}>🛵 Ruta de entrega</p>
            <div style={mo.rutaInfo}>
              <div style={mo.rutaDato}>
                <span style={mo.rutaIcon}>📏</span>
                <div>
                  <p style={mo.rutaNum}>{DIST_TOTAL.toFixed(2)} km</p>
                  <p style={mo.rutaSub}>Distancia total</p>
                </div>
              </div>
              <div style={mo.rutaDivider} />
              <div style={mo.rutaDato}>
                <span style={mo.rutaIcon}>⏱️</span>
                <div>
                  <p style={mo.rutaNum}>~{TIEMPO_EST} min</p>
                  <p style={mo.rutaSub}>Tiempo estimado</p>
                </div>
              </div>
            </div>

            {/* Mapa Leaflet de la ruta */}
            <MapaRutaLeaflet />
          </div>
        </div>

        <div style={mo.modalFooter}>
          <button
            onClick={() => onIgnorar(pedido.id)}
            style={mo.ignorarBtn}
            title="Ignorar este pedido — quedará disponible para otro repartidor"
          >
            ✗ Ignorar pedido
          </button>
          <button
            onClick={() => onAceptar(pedido.id)}
            disabled={aceptando}
            style={mo.aceptarBtn}
          >
            {aceptando ? "Aceptando…" : "✓ Aceptar y tomar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vista principal del trabajador ──
export default function TrabajadorView({ email, onLogout }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aceptando, setAceptando] = useState(null);
  const [error, setError] = useState("");
  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  // pedidos ignorados localmente (el trabajador los oculta, pero siguen disponibles en la BD)
  const [ignorados, setIgnorados] = useState(new Set());

  async function cargarPedidos() {
    setLoading(true);
    try {
      const data = await getPedidosPendientes();
      if (data.error) { setError(data.error); return; }
      setPedidos(data);
    } catch {
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarPedidos(); }, []);

  async function handleAceptar(id) {
    setAceptando(id);
    try {
      const res = await aceptarPedido(id);
      if (res.error) { setError(res.error); return; }
      setPedidos(prev => prev.filter(p => p.id !== id));
      setPedidoDetalle(null);
    } catch {
      setError("Error al aceptar el pedido.");
    } finally {
      setAceptando(null);
    }
  }

  function handleIgnorar(id) {
    // Ocultar pedido localmente — sigue disponible en BD para otros repartidores
    setIgnorados(prev => new Set([...prev, id]));
    setPedidoDetalle(null);
  }

  const pedidosVisibles = pedidos.filter(p => !ignorados.has(p.id));

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.headerLogo}>🛵 Panel de Repartidor</span>
          <div style={s.headerRight}>
            <div style={s.trabajadorInfo}>
              <span style={s.trabajadorLoc}>📍 {TRABAJADOR_LUGAR}</span>
              <span style={s.headerEmail}>{email}</span>
            </div>
            <button onClick={onLogout} style={s.logoutBtn}>Salir</button>
          </div>
        </div>
      </header>

      <div style={s.container}>
        <div style={s.topBar}>
          <h2 style={s.title}>Pedidos disponibles</h2>
          <button onClick={cargarPedidos} style={s.refreshBtn}>↻ Actualizar</button>
        </div>

        {ignorados.size > 0 && (
          <div style={s.ignoradosBanner}>
            <span>Has ignorado {ignorados.size} pedido{ignorados.size > 1 ? "s" : ""} — siguen disponibles para otros repartidores.</span>
            <button onClick={() => setIgnorados(new Set())} style={s.mostrarIgnoradosBtn}>
              Mostrar todos
            </button>
          </div>
        )}

        {error && <div style={s.errorBox}>{error}</div>}

        {loading ? (
          <p style={s.muted}>Cargando pedidos…</p>
        ) : pedidosVisibles.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>📭</div>
            <p style={s.emptyText}>No hay pedidos pendientes en este momento.</p>
            <p style={s.emptySubtext}>Haz clic en "Actualizar" para verificar de nuevo.</p>
          </div>
        ) : (
          <div style={s.list}>
            {pedidosVisibles.map((pedido) => {
              const totalPedido = pedido.items
                ? pedido.items.reduce((s, i) => s + (i.precio||0) * i.cantidad, 0)
                : 0;
              return (
                <div key={pedido.id} style={s.card} onClick={() => setPedidoDetalle(pedido)}>
                  <div style={s.cardHeader}>
                    <div>
                      <p style={s.pedidoId}>Pedido #{pedido.id.slice(0,8).toUpperCase()}</p>
                      <p style={s.pedidoFecha}>{new Date(pedido.created_at).toLocaleString("es-CL")}</p>
                    </div>
                    <span style={s.badge}>PENDIENTE</span>
                  </div>
                  <div style={s.cardBody}>
                    <div style={s.cardRow}>
                      <div>
                        <p style={s.clienteLabel}>Cliente</p>
                        <p style={s.clienteEmail}>{pedido.cliente_nombre || pedido.cliente_email}</p>
                      </div>
                      {totalPedido > 0 && (
                        <div style={s.totalBadge}>
                          <p style={s.totalLabel}>Total</p>
                          <p style={s.totalValor}>${totalPedido.toLocaleString("es-CL")}</p>
                        </div>
                      )}
                    </div>
                    {pedido.items && pedido.items.length > 0 && (
                      <div style={s.items}>
                        {pedido.items.map((item, i) => (
                          <div key={i} style={s.itemRow}>
                            <span>{item.nombre} ×{item.cantidad}</span>
                            <span style={s.itemPrecio}>${((item.precio||0)*item.cantidad).toLocaleString("es-CL")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={s.rutaResumen}>
                      <span style={s.rutaTag}>📍 {DIST_TOTAL.toFixed(2)}km · ~{TIEMPO_EST} min</span>
                      <span style={s.verRutaLink}>Ver ruta en mapa →</span>
                    </div>
                  </div>
                  <div style={s.cardFooter}>
                    <button
                      onClick={e => { e.stopPropagation(); handleIgnorar(pedido.id); }}
                      style={s.ignorarBtn}
                    >
                      ✗ Ignorar
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleAceptar(pedido.id); }}
                      disabled={aceptando === pedido.id}
                      style={s.aceptarBtn}
                    >
                      {aceptando === pedido.id ? "Aceptando…" : "✓ Aceptar pedido"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pedidoDetalle && (
        <ModalPedido
          pedido={pedidoDetalle}
          onCerrar={() => setPedidoDetalle(null)}
          onAceptar={handleAceptar}
          onIgnorar={handleIgnorar}
          aceptando={aceptando === pedidoDetalle.id}
        />
      )}
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────
const rm = {
  mapaWrap: { background:"#f9f9f6", borderRadius:12, overflow:"hidden", border:"1px solid #e8e8e2", marginTop:12 },
  mapaTitle: { padding:"10px 16px", fontWeight:700, fontSize:13, color:"#555", borderBottom:"1px solid #e8e8e2" },
  leyenda: { display:"flex", gap:16, padding:"10px 16px", borderTop:"1px solid #e8e8e2", flexWrap:"wrap" },
  leyItem: { display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#666" },
  dot: { width:8, height:8, borderRadius:"50%", display:"inline-block" },
};
const mo = {
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modal: { background:"#fff", borderRadius:16, width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" },
  modalHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"20px 24px", borderBottom:"1px solid #f0f0f0" },
  modalId: { margin:"0 0 4px", fontWeight:800, fontSize:18, color:"#1a1a1a" },
  modalFecha: { margin:0, fontSize:12, color:"#aaa" },
  closeBtn: { background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#888", padding:"4px 8px" },
  modalBody: { padding:"0 24px 8px" },
  seccion: { padding:"16px 0", borderBottom:"1px solid #f5f5f2" },
  secLabel: { margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:0.8 },
  secValor: { margin:"0 0 2px", fontSize:15, fontWeight:700, color:"#1a1a1a" },
  secSub: { margin:"0 0 2px", fontSize:13, color:"#666" },
  itemsList: { background:"#f9f9f6", borderRadius:8, padding:"10px 14px", display:"flex", flexDirection:"column", gap:6 },
  itemRow: { display:"flex", justifyContent:"space-between", fontSize:13, color:"#444" },
  itemPrecio: { fontWeight:600, color:"#2d6a4f" },
  totalRow: { display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10, padding:"10px 14px", background:"#f0fdf4", borderRadius:8, border:"1px solid #bbf7d0" },
  totalLabel: { margin:0, fontSize:13, fontWeight:600, color:"#166534" },
  totalValor: { fontSize:20, color:"#166534" },
  rutaInfo: { display:"flex", alignItems:"center", background:"#f9f9f6", borderRadius:10, overflow:"hidden", border:"1px solid #e8e8e2" },
  rutaDato: { flex:1, display:"flex", alignItems:"center", gap:10, padding:"12px 16px" },
  rutaIcon: { fontSize:22 },
  rutaNum: { margin:"0 0 2px", fontWeight:800, fontSize:18, color:"#1a1a1a" },
  rutaSub: { margin:0, fontSize:11, color:"#888" },
  rutaDivider: { width:1, height:40, background:"#e8e8e2" },
  modalFooter: { display:"flex", gap:10, padding:"16px 24px", borderTop:"1px solid #f0f0f0" },
  ignorarBtn: { flex:1, padding:"10px", background:"#fff5f5", color:"#c0392b", border:"1.5px solid #fecaca", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:14 },
  aceptarBtn: { flex:2, padding:"10px", background:"#2d6a4f", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:14 },
};
const s = {
  page: { minHeight:"100vh", background:"#f7f7f3", fontFamily:"'Segoe UI',sans-serif" },
  header: { background:"#1a1a1a", color:"#fff", padding:"0 32px", height:56, display:"flex", alignItems:"center" },
  headerInner: { width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center" },
  headerLogo: { fontWeight:700, fontSize:18 },
  headerRight: { display:"flex", alignItems:"center", gap:16 },
  trabajadorInfo: { display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 },
  trabajadorLoc: { fontSize:11, color:"#f4a261", fontWeight:600 },
  headerEmail: { fontSize:13, color:"#aaa" },
  logoutBtn: { background:"none", border:"1px solid #555", color:"#ccc", borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:13 },
  container: { maxWidth:760, margin:"0 auto", padding:32 },
  topBar: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 },
  title: { margin:0, fontSize:22, fontWeight:700, color:"#1a1a1a" },
  refreshBtn: { background:"#fff", border:"1.5px solid #e0e0e0", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:14, fontWeight:600 },
  ignoradosBanner: { display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"10px 16px", marginBottom:16, fontSize:13, color:"#92400e" },
  mostrarIgnoradosBtn: { background:"none", border:"none", color:"#b45309", fontWeight:700, cursor:"pointer", fontSize:13 },
  list: { display:"flex", flexDirection:"column", gap:16 },
  card: { background:"#fff", borderRadius:12, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden", cursor:"pointer", transition:"transform .1s, box-shadow .1s" },
  cardHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"16px 20px", borderBottom:"1px solid #f0f0f0" },
  pedidoId: { margin:"0 0 4px", fontWeight:700, fontSize:15, color:"#1a1a1a" },
  pedidoFecha: { margin:0, fontSize:12, color:"#aaa" },
  badge: { background:"#fff7ed", color:"#c2410c", fontWeight:700, fontSize:11, padding:"4px 10px", borderRadius:99, border:"1px solid #fed7aa" },
  cardBody: { padding:"16px 20px" },
  cardRow: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 },
  clienteLabel: { margin:"0 0 2px", fontSize:11, fontWeight:600, color:"#aaa", textTransform:"uppercase", letterSpacing:0.5 },
  clienteEmail: { margin:0, fontSize:14, color:"#333", fontWeight:600 },
  totalBadge: { textAlign:"right" },
  totalLabel: { margin:"0 0 2px", fontSize:11, color:"#aaa", textTransform:"uppercase", fontWeight:600 },
  totalValor: { margin:0, fontSize:18, fontWeight:800, color:"#2d6a4f" },
  items: { display:"flex", flexDirection:"column", gap:4, background:"#f9f9f6", borderRadius:8, padding:"10px 14px", marginBottom:10 },
  itemRow: { display:"flex", justifyContent:"space-between", fontSize:13 },
  itemPrecio: { fontWeight:600, color:"#2d6a4f" },
  rutaResumen: { display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 },
  rutaTag: { fontSize:12, color:"#888", background:"#f5f5f0", borderRadius:99, padding:"3px 10px" },
  verRutaLink: { fontSize:12, color:"#2d6a4f", fontWeight:700, cursor:"pointer" },
  cardFooter: { padding:"14px 20px", borderTop:"1px solid #f0f0f0", display:"flex", gap:10 },
  ignorarBtn: { flex:1, padding:"10px", background:"#fff5f5", color:"#c0392b", border:"1.5px solid #fecaca", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13 },
  aceptarBtn: { flex:2, padding:"10px", background:"#2d6a4f", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:14 },
  muted: { color:"#aaa", fontSize:14 },
  errorBox: { background:"#fff0f0", color:"#c0392b", borderRadius:8, padding:"10px 14px", fontSize:13, marginBottom:16 },
  emptyState: { textAlign:"center", padding:"60px 0" },
  emptyIcon: { fontSize:48, marginBottom:12 },
  emptyText: { color:"#555", fontSize:15, fontWeight:600 },
  emptySubtext: { color:"#aaa", fontSize:13, marginTop:4 },
};
