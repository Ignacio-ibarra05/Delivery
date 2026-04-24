import { useState, useEffect, useRef } from "react";
import { getdeliveryPendientes, aceptarPedidoConCoords, entregarPedido } from "../api";

// ── Ubicación base del repartidor (Costanera Center, Santiago) ──
const TRABAJADOR_LAT = -33.4172;
const TRABAJADOR_LNG = -70.6065;
const TRABAJADOR_LUGAR = "Costanera Center";

// ── Ubicación base del CLIENT (Parque Titanium) ──
const CLIENT_LAT = -33.4197;
const CLIENT_LNG = -70.6058;
const CLIENT_LUGAR = "Parque Titanium";

// ── Restaurantes (mismos que CLIENTView) ──
const RESTAURANTES = [
  { id: "r1", first_name: "La Piazza Roma", lat: -33.4175, lng: -70.6080 },
  { id: "r2", first_name: "Burger House",   lat: -33.4210, lng: -70.6030 },
  { id: "r3", first_name: "Wok & Roll",     lat: -33.4165, lng: -70.6045 },
];

function getSucursalParaPedido(pedido) {
  if (pedido.local_lat && pedido.local_lng) {
    let closest = RESTAURANTES[0];
    let minDist = Infinity;
    RESTAURANTES.forEach(r => {
      const d = Math.abs(r.lat - Number(pedido.local_lat)) + Math.abs(r.lng - Number(pedido.local_lng));
      if (d < minDist) { minDist = d; closest = r; }
    });
    return closest;
  }
  return RESTAURANTES[0];
}

function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Mapa de ruta ──
function MapaRuta({ trabajadorLat, trabajadorLng, sucursalLat, sucursalLng, CLIENTLat, CLIENTLng, sucursalfirst_name, height = 300 }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    function initMap() {
      if (!window.L || !mapRef.current || mapInstanceRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [(trabajadorLat + CLIENTLat) / 2, (trabajadorLng + CLIENTLng) / 2],
        zoom: 14,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const mkStyle = (bg, emoji) =>
        L.divIcon({ className: "", html: `<div style="background:${bg};color:#fff;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.25);">${emoji}</div>`, iconSize:[44,44], iconAnchor:[22,22] });
      L.marker([trabajadorLat, trabajadorLng], { icon: mkStyle("#f4a261","🛵") }).addTo(map).bindPopup(`<b>Tu posición</b><br>${TRABAJADOR_LUGAR}`).openPopup();
      L.marker([sucursalLat, sucursalLng],     { icon: mkStyle("#2d6a4f","🍽️") }).addTo(map).bindPopup(`<b>${sucursalfirst_name}</b><br>Punto de recogida`);
      L.marker([CLIENTLat, CLIENTLng],        { icon: mkStyle("#e63946","📦") }).addTo(map).bindPopup(`<b>Destino del CLIENTE</b><br>${CLIENT_LUGAR}`);
      if (L.Routing) {
        L.Routing.control({ waypoints:[L.latLng(trabajadorLat,trabajadorLng),L.latLng(sucursalLat,sucursalLng),L.latLng(CLIENTLat,CLIENTLng)], routeWhileDragging:false, addWaypoints:false, draggableWaypoints:false, fitSelectedRoutes:true, show:false, createMarker:()=>null, lineOptions:{styles:[{color:"#f4a261",weight:5,opacity:0.85}]}, router:L.Routing.osrmv1({serviceUrl:"https://router.project-osrm.org/route/v1",profile:"driving"}) }).addTo(map);
      } else {
        L.polyline([[trabajadorLat,trabajadorLng],[sucursalLat,sucursalLng],[CLIENTLat,CLIENTLng]],{color:"#f4a261",weight:5,opacity:0.85,dashArray:"10,6",lineCap:"round"}).addTo(map);
      }
      map.fitBounds([[trabajadorLat,trabajadorLng],[sucursalLat,sucursalLng],[CLIENTLat,CLIENTLng]],{padding:[40,40]});
      mapInstanceRef.current = map;
    }
    if (window.L) initMap();
    else { const iv = setInterval(()=>{ if(window.L){clearInterval(iv);initMap();} },100); return ()=>clearInterval(iv); }
  }, []);

  return (
    <div style={rm.mapaWrap}>
      <div style={rm.mapaTitle}>🗺️ Ruta de entrega</div>
      <div ref={mapRef} style={{ width:"100%", height }} />
      <div style={rm.leyenda}>
        <span style={rm.leyItem}><span style={{...rm.dot,background:"#f4a261"}}/> Tu posición ({TRABAJADOR_LUGAR})</span>
        <span style={rm.leyItem}><span style={{...rm.dot,background:"#2d6a4f"}}/> {sucursalfirst_name}</span>
        <span style={rm.leyItem}><span style={{...rm.dot,background:"#e63946"}}/> CLIENTE ({CLIENT_LUGAR})</span>
      </div>
    </div>
  );
}

// ── Pantalla: pedido entregado correctamente (trabajador) ──
function EntregadoView({ onVolver }) {
  useEffect(() => {
    const t = setTimeout(onVolver, 3000);
    return () => clearTimeout(t);
  }, [onVolver]);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:20, padding:32 }}>
      <div style={{ fontSize:72 }}>✅</div>
      <p style={{ fontSize:28, fontWeight:800, color:"#2d6a4f", margin:0 }}>Pedido entregado</p>
      <p style={{ fontSize:14, color:"#888", margin:0 }}>Volviendo al inicio…</p>
    </div>
  );
}

function PedidoAceptadoView({ pedido, sucursal, onNuevoPedido }) {
  const [entregando, setEntregando] = useState(false);
  const [entregado, setEntregado] = useState(false);
  const [error, setError] = useState("");
  const totalPedido = pedido.items ? pedido.items.reduce((s,i)=>s+(Number(i.price)||0)*Number(i.amount),0) : 0;
  const distTotal = distanciaKm(TRABAJADOR_LAT, TRABAJADOR_LNG, CLIENT_LAT, CLIENT_LNG);
  const tiempoEst = Math.round((distTotal / 20) * 60);

  async function handleEntregar() {
    if (!confirm("¿Confirmas que ya entregaste el pedido al CLIENTE?")) return;
    setEntregando(true);
    setError("");
    try {
      const res = await entregarPedido(pedido.id);
      if (res.error) { setError(res.error); return; }
      setEntregado(true);
    } catch {
      setError("Error al registrar la entrega.");
    } finally {
      setEntregando(false);
    }
  }

  if (entregado) {
    return <EntregadoView onVolver={onNuevoPedido} />;
  }

  return (
    <div style={ac.container}>
      <div style={ac.confirmBanner}>
        <div style={ac.checkIcon}>✓</div>
        <div>
          <p style={ac.confirmTitle}>¡Pedido aceptado!</p>
          <p style={ac.confirmSub}>Pedido #{pedido.id.slice(0,8).toUpperCase()} · {new Date(pedido.created_at||Date.now()).toLocaleString("es-CL")}</p>
        </div>
      </div>

      <div style={ac.rutaCard}>
        <div style={ac.rutaSteps}>
          {[["#f4a261","🛵","Tu posición",TRABAJADOR_LUGAR],["#2d6a4f","🍽️","Recoger en",sucursal.first_name],["#e63946","📦","Entregar en",CLIENT_LUGAR]].map(([bg,em,lbl,val],i,arr)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={ac.step}>
                <div style={{...ac.stepDot,background:bg}}>{em}</div>
                <div><p style={ac.stepLabel}>{lbl}</p><p style={ac.stepVal}>{val}</p></div>
              </div>
              {i<arr.length-1&&<span style={ac.arrow}>→</span>}
            </div>
          ))}
        </div>
        <div style={ac.rutaStats}>
          <div style={ac.stat}><p style={ac.statNum}>{distTotal.toFixed(2)} km</p><p style={ac.statLabel}>Distancia total</p></div>
          <div style={ac.statDiv}/>
          <div style={ac.stat}><p style={ac.statNum}>~{tiempoEst} min</p><p style={ac.statLabel}>Tiempo estimado</p></div>
        </div>
      </div>

      {pedido.items&&pedido.items.length>0&&(
        <div style={ac.resumenCard}>
          <p style={ac.resumenTit}>Detalle del pedido</p>
          {pedido.items.map((item,i)=>(
            <div key={i} style={ac.resumenRow}><span>{item.name} ×{Number(item.amount)}</span><span style={ac.resumenPrecio}>${((Number(item.price)||0)*Number(item.amount)).toLocaleString("es-CL")}</span></div>
          ))}
          <div style={ac.resumenTotal}><span>Total</span><strong>${totalPedido.toLocaleString("es-CL")}</strong></div>
        </div>
      )}

      <MapaRuta
        trabajadorLat={TRABAJADOR_LAT} trabajadorLng={TRABAJADOR_LNG}
        sucursalLat={sucursal.lat} sucursalLng={sucursal.lng}
        CLIENTLat={CLIENT_LAT} CLIENTLng={CLIENT_LNG}
        sucursalfirst_name={sucursal.first_name} height={420}
      />

      {error && <div style={{background:"#fff0f0",color:"#c0392b",borderRadius:8,padding:"10px 14px",fontSize:13}}>{error}</div>}

      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={onNuevoPedido} style={ac.nuevoBtn}>← Volver a delivery disponibles</button>
        <button onClick={handleEntregar} disabled={entregando} style={ac.entregarBtn}>
          {entregando ? "Registrando entrega…" : "📦 Entregar pedido"}
        </button>
      </div>
    </div>
  );
}

// ── Modal con detalle y preview de ruta ──
function ModalPedido({ pedido, onCerrar, onAceptar, onIgnorar, aceptando }) {
  const sucursal = getSucursalParaPedido(pedido);
  const totalPedido = pedido.items ? pedido.items.reduce((s,i)=>s+(Number(i.price)||0)*Number(i.amount),0) : 0;
  const distTotal = distanciaKm(TRABAJADOR_LAT,TRABAJADOR_LNG,CLIENT_LAT,CLIENT_LNG);
  const tiempoEst = Math.round((distTotal/20)*60);

  return (
    <div style={mo.overlay} onClick={onCerrar}>
      <div style={mo.modal} onClick={e=>e.stopPropagation()}>
        <div style={mo.modalHeader}>
          <div><p style={mo.modalId}>Pedido #{pedido.id.slice(0,8).toUpperCase()}</p><p style={mo.modalFecha}>{new Date(pedido.created_at).toLocaleString("es-CL")}</p></div>
          <button onClick={onCerrar} style={mo.closeBtn}>✕</button>
        </div>
        <div style={mo.modalBody}>
          <div style={mo.seccion}>
            <p style={mo.secLabel}>CLIENTE</p>
            <p style={mo.secValor}>{pedido.client_first_name||pedido.client_email}</p>
            <p style={mo.secSub}>{pedido.client_email}</p>
            <p style={mo.secSub}> {CLIENT_LUGAR}</p>
          </div>
          {pedido.items&&pedido.items.length>0&&(
            <div style={mo.seccion}>
              <p style={mo.secLabel}>Detalle del pedido</p>
              <div style={mo.itemsList}>{pedido.items.map((item,i)=><div key={i} style={mo.itemRow}><span>{item.name} ×{Number(item.amount)}</span><span style={mo.itemPrecio}>${((Number(item.price)||0)*Number(item.amount)).toLocaleString("es-CL")}</span></div>)}</div>
              <div style={mo.totalRow}><span style={mo.totalLabel}>Total</span><strong style={mo.totalValor}>${totalPedido.toLocaleString("es-CL")}</strong></div>
            </div>
          )}
          <div style={mo.seccion}>
            <p style={mo.secLabel}>Ruta de entrega</p>
            <div style={mo.rutaInfo}>
              <div style={mo.rutaDato}><div><p style={mo.rutaNum}>{distTotal.toFixed(2)} km</p><p style={mo.rutaSub}>Distancia total</p></div></div>
              <div style={mo.rutaDivider}/>
              <div style={mo.rutaDato}><div><p style={mo.rutaNum}>~{tiempoEst} min</p><p style={mo.rutaSub}>Tiempo estimado</p></div></div>
            </div>
            <MapaRuta
              trabajadorLat={TRABAJADOR_LAT} trabajadorLng={TRABAJADOR_LNG}
              sucursalLat={sucursal.lat} sucursalLng={sucursal.lng}
              CLIENTLat={CLIENT_LAT} CLIENTLng={CLIENT_LNG}
              sucursalfirst_name={sucursal.first_name} height={300}
            />
          </div>
        </div>
        <div style={mo.modalFooter}>
          <button onClick={()=>onIgnorar(pedido.id)} style={mo.ignorarBtn}>Ignorar pedido</button>
          <button onClick={()=>onAceptar(pedido)} disabled={aceptando} style={mo.aceptarBtn}>{aceptando?"Aceptando…":"Aceptar y tomar pedido"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Vista principal del trabajador ──
export default function TrabajadorView({ email, onLogout }) {
  const [delivery, setdelivery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aceptando, setAceptando] = useState(null);
  const [error, setError] = useState("");
  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  const [ignorados, setIgnorados] = useState(new Set());
  const [pedidoActivo, setPedidoActivo] = useState(null);
  const [sucursalActiva, setSucursalActiva] = useState(null);

  async function cargardelivery() {
    setLoading(true);
    try {
      const data = await getdeliveryPendientes();
      if (data.error) { setError(data.error); return; }
      setdelivery(data);
    } catch { setError("No se pudieron cargar los delivery."); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargardelivery(); }, []);

  async function handleAceptar(pedidoOrId) {
    const pedidoObj = typeof pedidoOrId === "object" ? pedidoOrId : delivery.find(p=>p.id===pedidoOrId);
    const id = pedidoObj?.id ?? pedidoOrId;
    setAceptando(id);
    try {
      const sucursal = getSucursalParaPedido(pedidoObj || {});
      const res = await aceptarPedidoConCoords(id, {
        worker_lat: TRABAJADOR_LAT,
        worker_lng: TRABAJADOR_LNG,
        local_lat: sucursal.lat,
        local_lng: sucursal.lng,
      });
      if (res.error) { setError(res.error); return; }
      setdelivery(prev => prev.filter(p => p.id !== id));
      setPedidoDetalle(null);
      setPedidoActivo({ ...pedidoObj, ...res });
      setSucursalActiva(sucursal);
    } catch { setError("Error al aceptar el pedido."); }
    finally { setAceptando(null); }
  }

  function handleIgnorar(id) { setIgnorados(prev => new Set([...prev, id])); setPedidoDetalle(null); }

  if (pedidoActivo && sucursalActiva) {
    return (
      <div style={s.page}>
        <header style={s.header}>
          <div style={s.headerInner}>
            <span style={s.headerLogo}>Panel de Repartidor</span>
            <div style={s.headerRight}>
              <div style={s.trabajadorInfo}><span style={s.trabajadorLoc}>{TRABAJADOR_LUGAR}</span><span style={s.headerEmail}>{email}</span></div>
              <button onClick={onLogout} style={s.logoutBtn}>Salir</button>
            </div>
          </div>
        </header>
        <PedidoAceptadoView pedido={pedidoActivo} sucursal={sucursalActiva} onNuevoPedido={()=>{ setPedidoActivo(null); setSucursalActiva(null); cargardelivery(); }} />
      </div>
    );
  }

  const deliveryVisibles = delivery.filter(p => !ignorados.has(p.id));

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.headerLogo}>Panel de Repartidor</span>
          <div style={s.headerRight}>
            <div style={s.trabajadorInfo}><span style={s.trabajadorLoc}>{TRABAJADOR_LUGAR}</span><span style={s.headerEmail}>{email}</span></div>
            <button onClick={onLogout} style={s.logoutBtn}>Salir</button>
          </div>
        </div>
      </header>
      <div style={s.container}>
        <div style={s.topBar}>
          <h2 style={s.title}>delivery disponibles</h2>
          <button onClick={cargardelivery} style={s.refreshBtn}>↻ Actualizar</button>
        </div>
        {ignorados.size>0&&<div style={s.ignoradosBanner}><span>Has ignorado {ignorados.size} pedido{ignorados.size>1?"s":""} — siguen disponibles para otros repartidores.</span><button onClick={()=>setIgnorados(new Set())} style={s.mostrarIgnoradosBtn}>Mostrar todos</button></div>}
        {error&&<div style={s.errorBox}>{error}</div>}
        {loading ? <p style={s.muted}>Cargando delivery…</p> : deliveryVisibles.length===0 ? (
          <div style={s.emptyState}><p style={s.emptyText}>No hay delivery pendientes en este momento.</p><p style={s.emptySubtext}>Haz clic en "Actualizar" para verificar de nuevo.</p></div>
        ) : (
          <div style={s.list}>
            {deliveryVisibles.map(pedido=>{
              const total = pedido.items?pedido.items.reduce((s,i)=>s+(Number(i.price)||0)*Number(i.amount),0):0;
              const dist = distanciaKm(TRABAJADOR_LAT,TRABAJADOR_LNG,CLIENT_LAT,CLIENT_LNG);
              const tEst = Math.round((dist/20)*60);
              return (
                <div key={pedido.id} style={s.card} onClick={()=>setPedidoDetalle(pedido)}>
                  <div style={s.cardHeader}><div><p style={s.pedidoId}>Pedido #{pedido.id.slice(0,8).toUpperCase()}</p><p style={s.pedidoFecha}>{new Date(pedido.created_at).toLocaleString("es-CL")}</p></div><span style={s.badge}>PENDIENTE</span></div>
                  <div style={s.cardBody}>
                    <div style={s.cardRow}>
                      <div><p style={s.CLIENTLabel}>CLIENTE</p><p style={s.CLIENTEmail}>{pedido.client_first_name||pedido.client_email}</p></div>
                      {total>0&&<div style={s.totalBadge}><p style={s.totalLabel}>Total</p><p style={s.totalValor}>${total.toLocaleString("es-CL")}</p></div>}
                    </div>
                    {pedido.items&&pedido.items.length>0&&<div style={s.items}>{pedido.items.map((item,i)=><div key={i} style={s.itemRow}><span>{item.name} ×{Number(item.amount)}</span><span style={s.itemPrecio}>${((Number(item.price)||0)*Number(item.amount)).toLocaleString("es-CL")}</span></div>)}</div>}
                    <div style={s.rutaResumen}><span style={s.rutaTag}>{dist.toFixed(2)}km · ~{tEst} min</span><span style={s.verRutaLink}>Ver ruta en mapa →</span></div>
                  </div>
                  <div style={s.cardFooter}>
                    <button onClick={e=>{e.stopPropagation();handleIgnorar(pedido.id);}} style={s.ignorarBtn}>✗ Ignorar</button>
                    <button onClick={e=>{e.stopPropagation();handleAceptar(pedido);}} disabled={aceptando===pedido.id} style={s.aceptarBtn}>{aceptando===pedido.id?"Aceptando…":"Aceptar pedido"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {pedidoDetalle&&<ModalPedido pedido={pedidoDetalle} onCerrar={()=>setPedidoDetalle(null)} onAceptar={handleAceptar} onIgnorar={handleIgnorar} aceptando={aceptando===pedidoDetalle.id}/>}
    </div>
  );
}

// ── Estilos ──
const rm={mapaWrap:{background:"#f9f9f6",borderRadius:12,overflow:"hidden",border:"1px solid #e8e8e2",marginTop:12},mapaTitle:{padding:"10px 16px",fontWeight:700,fontSize:13,color:"#555",borderBottom:"1px solid #e8e8e2"},leyenda:{display:"flex",gap:16,padding:"10px 16px",borderTop:"1px solid #e8e8e2",flexWrap:"wrap"},leyItem:{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#666"},dot:{width:8,height:8,borderRadius:"50%",display:"inline-block"}};
const mo={overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16},modal:{background:"#fff",borderRadius:16,width:"100%",maxWidth:600,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"},modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 24px",borderBottom:"1px solid #f0f0f0"},modalId:{margin:"0 0 4px",fontWeight:800,fontSize:18,color:"#1a1a1a"},modalFecha:{margin:0,fontSize:12,color:"#aaa"},closeBtn:{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#888",padding:"4px 8px"},modalBody:{padding:"0 24px 8px"},seccion:{padding:"16px 0",borderBottom:"1px solid #f5f5f2"},secLabel:{margin:"0 0 6px",fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:0.8},secValor:{margin:"0 0 2px",fontSize:15,fontWeight:700,color:"#1a1a1a"},secSub:{margin:"0 0 2px",fontSize:13,color:"#666"},itemsList:{background:"#f9f9f6",borderRadius:8,padding:"10px 14px",display:"flex",flexDirection:"column",gap:6},itemRow:{display:"flex",justifyContent:"space-between",fontSize:13,color:"#444"},itemPrecio:{fontWeight:600,color:"#2d6a4f"},totalRow:{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,padding:"10px 14px",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0"},totalLabel:{margin:0,fontSize:13,fontWeight:600,color:"#166534"},totalValor:{fontSize:20,color:"#166534"},rutaInfo:{display:"flex",alignItems:"center",background:"#f9f9f6",borderRadius:10,overflow:"hidden",border:"1px solid #e8e8e2"},rutaDato:{flex:1,display:"flex",alignItems:"center",gap:10,padding:"12px 16px"},rutaNum:{margin:"0 0 2px",fontWeight:800,fontSize:18,color:"#1a1a1a"},rutaSub:{margin:0,fontSize:11,color:"#888"},rutaDivider:{width:1,height:40,background:"#e8e8e2"},modalFooter:{display:"flex",gap:10,padding:"16px 24px",borderTop:"1px solid #f0f0f0"},ignorarBtn:{flex:1,padding:"10px",background:"#fff5f5",color:"#c0392b",border:"1.5px solid #fecaca",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14},aceptarBtn:{flex:2,padding:"10px",background:"#2d6a4f",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}};
const ac={container:{maxWidth:800,margin:"0 auto",padding:32,display:"flex",flexDirection:"column",gap:20},confirmBanner:{display:"flex",alignItems:"center",gap:16,background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:14,padding:"20px 24px"},checkIcon:{fontSize:28,background:"#2d6a4f",color:"#fff",borderRadius:"50%",width:52,height:52,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:900},confirmTitle:{margin:"0 0 4px",fontWeight:800,fontSize:20,color:"#1a1a1a"},confirmSub:{margin:0,fontSize:13,color:"#666"},rutaCard:{background:"#fff",borderRadius:14,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",overflow:"hidden"},rutaSteps:{display:"flex",alignItems:"center",justifyContent:"space-around",padding:"20px 24px",flexWrap:"wrap",gap:8},step:{display:"flex",alignItems:"center",gap:10},stepDot:{width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:"3px solid #fff",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"},stepLabel:{margin:"0 0 2px",fontSize:11,color:"#aaa",textTransform:"uppercase",fontWeight:700,letterSpacing:0.5},stepVal:{margin:0,fontSize:14,fontWeight:700,color:"#1a1a1a"},arrow:{fontSize:22,color:"#ccc",fontWeight:700},rutaStats:{display:"flex",alignItems:"center",borderTop:"1px solid #f0f0f0",padding:"14px 24px"},stat:{flex:1,textAlign:"center"},statNum:{margin:"0 0 4px",fontWeight:800,fontSize:22,color:"#1a1a1a"},statLabel:{margin:0,fontSize:12,color:"#888"},statDiv:{width:1,height:40,background:"#e8e8e2"},resumenCard:{background:"#fff",borderRadius:14,padding:"20px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},resumenTit:{margin:"0 0 14px",fontWeight:700,fontSize:15,color:"#1a1a1a"},resumenRow:{display:"flex",justifyContent:"space-between",fontSize:13,color:"#444",padding:"6px 0",borderBottom:"1px solid #f5f5f5"},resumenPrecio:{fontWeight:600,color:"#2d6a4f"},resumenTotal:{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700,marginTop:12,paddingTop:12,borderTop:"2px solid #1a1a1a"},nuevoBtn:{alignSelf:"flex-start",background:"#fff",border:"1.5px solid #e0e0e0",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,fontSize:14,color:"#555"},entregarBtn:{padding:"12px 28px",background:"#2d6a4f",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:15,boxShadow:"0 2px 10px rgba(45,106,79,0.3)"}};
const s={page:{minHeight:"100vh",background:"#f7f7f3",fontFamily:"'Segoe UI',sans-serif"},header:{background:"#1a1a1a",color:"#fff",padding:"0 32px",height:56,display:"flex",alignItems:"center"},headerInner:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"},headerLogo:{fontWeight:700,fontSize:18},headerRight:{display:"flex",alignItems:"center",gap:16},trabajadorInfo:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2},trabajadorLoc:{fontSize:11,color:"#f4a261",fontWeight:600},headerEmail:{fontSize:13,color:"#aaa"},logoutBtn:{background:"none",border:"1px solid #555",color:"#ccc",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:13},container:{maxWidth:760,margin:"0 auto",padding:32},topBar:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24},title:{margin:0,fontSize:22,fontWeight:700,color:"#1a1a1a"},refreshBtn:{background:"#fff",border:"1.5px solid #e0e0e0",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:14,fontWeight:600},ignoradosBanner:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#92400e"},mostrarIgnoradosBtn:{background:"none",border:"none",color:"#b45309",fontWeight:700,cursor:"pointer",fontSize:13},list:{display:"flex",flexDirection:"column",gap:16},card:{background:"#fff",borderRadius:12,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",overflow:"hidden",cursor:"pointer"},cardHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"16px 20px",borderBottom:"1px solid #f0f0f0"},pedidoId:{margin:"0 0 4px",fontWeight:700,fontSize:15,color:"#1a1a1a"},pedidoFecha:{margin:0,fontSize:12,color:"#aaa"},badge:{background:"#fff7ed",color:"#c2410c",fontWeight:700,fontSize:11,padding:"4px 10px",borderRadius:99,border:"1px solid #fed7aa"},cardBody:{padding:"16px 20px"},cardRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12},CLIENTLabel:{margin:"0 0 2px",fontSize:11,fontWeight:600,color:"#aaa",textTransform:"uppercase",letterSpacing:0.5},CLIENTEmail:{margin:0,fontSize:14,color:"#333",fontWeight:600},totalBadge:{textAlign:"right"},totalLabel:{margin:"0 0 2px",fontSize:11,color:"#aaa",textTransform:"uppercase",fontWeight:600},totalValor:{margin:0,fontSize:18,fontWeight:800,color:"#2d6a4f"},items:{display:"flex",flexDirection:"column",gap:4,background:"#f9f9f6",borderRadius:8,padding:"10px 14px",marginBottom:10},itemRow:{display:"flex",justifyContent:"space-between",fontSize:13},itemPrecio:{fontWeight:600,color:"#2d6a4f"},rutaResumen:{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4},rutaTag:{fontSize:12,color:"#888",background:"#f5f5f0",borderRadius:99,padding:"3px 10px"},verRutaLink:{fontSize:12,color:"#2d6a4f",fontWeight:700,cursor:"pointer"},cardFooter:{padding:"14px 20px",borderTop:"1px solid #f0f0f0",display:"flex",gap:10},ignorarBtn:{flex:1,padding:"10px",background:"#fff5f5",color:"#c0392b",border:"1.5px solid #fecaca",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13},aceptarBtn:{flex:2,padding:"10px",background:"#2d6a4f",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14},muted:{color:"#aaa",fontSize:14},errorBox:{background:"#fff0f0",color:"#c0392b",borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:16},emptyState:{textAlign:"center",padding:"60px 0"},emptyText:{color:"#555",fontSize:15,fontWeight:600},emptySubtext:{color:"#aaa",fontSize:13,marginTop:4}};
