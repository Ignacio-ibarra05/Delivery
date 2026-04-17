import { useState, useEffect, useRef } from "react";
import { crearPedido, getProductos, cancelarPedido, getMiPedidoActivo, getMiPedidoEntregado, puntuarPedido } from "../api";

// ── Coordenadas fijas del cliente (Parque Titanium, Santiago Centro) ──
const CLIENTE_LAT = -33.4197;
const CLIENTE_LNG = -70.6058;
const RADIO_KM = 2;

const RESTAURANTES_BASE = [
  { id: "r1", nombre: "La Piazza Roma",  tipo: "Italiana", lat: -33.4175, lng: -70.6080, rating: 4.8, tiempo: "25–35 min" },
  { id: "r2", nombre: "Burger House",    tipo: "Americana", lat: -33.4210, lng: -70.6030, rating: 4.5, tiempo: "15–25 min" },
  { id: "r3", nombre: "Wok & Roll",      tipo: "China",    lat: -33.4165, lng: -70.6045, rating: 4.3, tiempo: "20–35 min" },
];

function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Mapa Leaflet con rutas calculadas por OSRM ──
function MapaRestaurantesLeaflet({ restaurantes, seleccionado, onSeleccionar }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const routingControlRef = useRef(null);
  const [infoRuta, setInfoRuta] = useState(null);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current.invalidateSize(), 100);
    }
  });

  useEffect(() => {
    if (mapInstanceRef.current) return;

    function initMap() {
      if (!window.L || !mapRef.current) return;
      if (mapInstanceRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, { center: [CLIENTE_LAT, CLIENTE_LNG], zoom: 14 });
      setupMap(L, map);
    }

    function setupMap(L, map) {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      L.marker([CLIENTE_LAT, CLIENTE_LNG], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#e63946;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:13px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-weight:700;">Tú</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18],
        })
      }).addTo(map).bindPopup("<b>Tu ubicación</b><br>Parque Titanium");

      L.circle([CLIENTE_LAT, CLIENTE_LNG], {
        radius: RADIO_KM * 1000, color: "#2d6a4f", fillColor: "#2d6a4f",
        fillOpacity: 0.05, weight: 1.5, dashArray: "8,6",
      }).addTo(map);

      restaurantes.forEach((r) => {
        const marker = L.marker([r.lat, r.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:#fff;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:2.5px solid #2d6a4f;box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:pointer;">🍽️</div>`,
            iconSize: [40, 40], iconAnchor: [20, 20],
          })
        }).addTo(map)
          .bindPopup(`<b>${r.nombre}</b><br>${r.tipo}<br>${r.rating} · ${r.tiempo}`);
        marker.on("click", () => onSeleccionar(r));
        markersRef.current[r.id] = marker;
      });

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    }

    if (window.L) {
      initMap();
    } else {
      const interval = setInterval(() => {
        if (window.L) { clearInterval(interval); initMap(); }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    restaurantes.forEach((r) => {
      const marker = markersRef.current[r.id];
      if (!marker) return;
      const activo = seleccionado?.id === r.id;
      marker.setIcon(L.divIcon({
        className: "",
        html: `<div style="background:${activo ? "#2d6a4f" : "#fff"};border-radius:50%;width:${activo ? 48 : 40}px;height:${activo ? 48 : 40}px;display:flex;align-items:center;justify-content:center;font-size:${activo ? 24 : 20}px;border:2.5px solid #2d6a4f;box-shadow:${activo ? "0 4px 16px rgba(45,106,79,0.45)" : "0 2px 8px rgba(0,0,0,0.2)"};cursor:pointer;">🍽️</div>`,
        iconSize: [activo ? 48 : 40, activo ? 48 : 40],
        iconAnchor: [activo ? 24 : 20, activo ? 24 : 20],
      }));
      if (activo) marker.openPopup();
    });

    if (routingControlRef.current) {
      try { map.removeControl(routingControlRef.current); } catch (_) {}
      routingControlRef.current = null;
      setInfoRuta(null);
    }

    if (seleccionado && L.Routing) {
      const control = L.Routing.control({
        waypoints: [
          L.latLng(CLIENTE_LAT, CLIENTE_LNG),
          L.latLng(seleccionado.lat, seleccionado.lng),
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        show: false,
        createMarker: () => null,
        lineOptions: {
          styles: [{ color: "#2d6a4f", weight: 5, opacity: 0.85 }],
        },
        router: L.Routing.osrmv1({
          serviceUrl: "https://router.project-osrm.org/route/v1",
          profile: "driving",
        }),
      });

      control.on("routesfound", (e) => {
        const ruta = e.routes[0].summary;
        setInfoRuta({
          distancia: (ruta.totalDistance / 1000).toFixed(1),
          duracion: Math.ceil(ruta.totalTime / 60),
        });
      });

      control.on("routingerror", () => {
        setInfoRuta({ error: true });
      });

      control.addTo(map);
      routingControlRef.current = control;
    }
  }, [seleccionado]);

  return (
    <div style={ms.mapaWrapper}>
      <div style={ms.mapaHeader}>
        <span style={ms.mapaTitle}>Restaurantes cercanos</span>
        <span style={ms.mapaSubtitle}>Radio {RADIO_KM}km · {restaurantes.length} disponibles</span>
      </div>

      {seleccionado && (
        <div style={ms.rutaBanner}>
          {!infoRuta ? (
            <span style={ms.rutaCalculando}>Calculando ruta hacia <b>{seleccionado.nombre}</b>…</span>
          ) : infoRuta.error ? (
            <span style={ms.rutaError}>No se pudo calcular la ruta. Intenta de nuevo.</span>
          ) : (
            <span style={ms.rutaInfo}>
              Ruta a <b>{seleccionado.nombre}</b>:&nbsp;
              <span style={ms.rutaDato}>{infoRuta.distancia} km</span>
              &nbsp;·&nbsp;
              <span style={ms.rutaDato}>{infoRuta.duracion} min</span>
            </span>
          )}
        </div>
      )}

      <div ref={mapRef} style={{ width: "100%", height: 380 }} />

      <div style={ms.mapaLeyenda}>
        <span style={ms.leyItem}><span style={{ ...ms.dot, background: "#e63946" }} /> Tu ubicación</span>
        <span style={ms.leyItem}><span style={{ ...ms.dot, background: "#2d6a4f" }} /> Restaurante</span>
        {seleccionado && <span style={ms.leyItem}><span style={{ ...ms.dot, background: "#2d6a4f", borderRadius: 2 }} /> Ruta calculada</span>}
      </div>
    </div>
  );
}

// ── Mapa de seguimiento del pedido activo ──
function SeguimientoPedido({ pedido, onCancelar, restaurante }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routingRef = useRef(null);
  const [cancelando, setCancelando] = useState(false);
  const [infoCancelado, setInfoCancelado] = useState(false);

  // Coordenadas de la sucursal: usa las del restaurante seleccionado
  const SUCURSAL_LAT = restaurante?.lat ?? -33.4175;
  const SUCURSAL_LNG = restaurante?.lng ?? -70.6080;

  // Coordenadas del repartidor: las guardadas en BD al aceptar el pedido,
  // o las coordenadas de Costanera Center como fallback
  const TRAB_LAT = pedido.trabajador_lat ? Number(pedido.trabajador_lat) : -33.4172;
  const TRAB_LNG = pedido.trabajador_lng ? Number(pedido.trabajador_lng) : -70.6065;

  useEffect(() => {
    function initMap() {
      if (!window.L || !mapRef.current || mapInstanceRef.current) return;
      const L = window.L;

      const map = L.map(mapRef.current, {
        center: [CLIENTE_LAT, CLIENTE_LNG],
        zoom: 14,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Marcador cliente (destino final)
      L.marker([CLIENTE_LAT, CLIENTE_LNG], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#e63946;color:#fff;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);">🏠</div>`,
          iconSize: [40, 40], iconAnchor: [20, 20],
        })
      }).addTo(map).bindPopup("<b>Tu dirección</b>");

      // Marcador sucursal
      L.marker([SUCURSAL_LAT, SUCURSAL_LNG], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#2d6a4f;color:#fff;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 8px rgba(45,106,79,0.4);">🍽️</div>`,
          iconSize: [40, 40], iconAnchor: [20, 20],
        })
      }).addTo(map).bindPopup(`<b>${restaurante?.nombre ?? "Sucursal"}</b>`);

      if (pedido.estado === "EN_CAMINO") {
        // Marcador repartidor
        L.marker([TRAB_LAT, TRAB_LNG], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:#f4a261;color:#fff;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 8px rgba(244,162,97,0.5);">🛵</div>`,
            iconSize: [40, 40], iconAnchor: [20, 20],
          })
        }).addTo(map).bindPopup("<b>Repartidor</b>");

        // Ruta completa: repartidor → sucursal → cliente
        if (L.Routing) {
          const control = L.Routing.control({
            waypoints: [
              L.latLng(TRAB_LAT, TRAB_LNG),
              L.latLng(SUCURSAL_LAT, SUCURSAL_LNG),
              L.latLng(CLIENTE_LAT, CLIENTE_LNG),
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            show: false,
            createMarker: () => null,
            lineOptions: {
              styles: [{ color: "#f4a261", weight: 5, opacity: 0.85 }],
            },
            router: L.Routing.osrmv1({
              serviceUrl: "https://router.project-osrm.org/route/v1",
              profile: "driving",
            }),
          });
          control.addTo(map);
          routingRef.current = control;
        }
      } else {
        // PENDIENTE: ruta punteada sucursal → cliente
        if (L.Routing) {
          const control = L.Routing.control({
            waypoints: [
              L.latLng(SUCURSAL_LAT, SUCURSAL_LNG),
              L.latLng(CLIENTE_LAT, CLIENTE_LNG),
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            show: false,
            createMarker: () => null,
            lineOptions: {
              styles: [{ color: "#2d6a4f", weight: 5, opacity: 0.8, dashArray: "10,6" }],
            },
            router: L.Routing.osrmv1({
              serviceUrl: "https://router.project-osrm.org/route/v1",
              profile: "driving",
            }),
          });
          control.addTo(map);
          routingRef.current = control;
        }
      }

      map.fitBounds(
        pedido.estado === "EN_CAMINO"
          ? [[TRAB_LAT, TRAB_LNG], [SUCURSAL_LAT, SUCURSAL_LNG], [CLIENTE_LAT, CLIENTE_LNG]]
          : [[SUCURSAL_LAT, SUCURSAL_LNG], [CLIENTE_LAT, CLIENTE_LNG]],
        { padding: [40, 40] }
      );

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    }

    if (window.L) initMap();
    else {
      const iv = setInterval(() => { if (window.L) { clearInterval(iv); initMap(); } }, 100);
      return () => clearInterval(iv);
    }
  }, [pedido.estado]);

  async function handleCancelar() {
    if (!confirm("¿Seguro que quieres cancelar tu pedido?")) return;
    setCancelando(true);
    try {
      const res = await cancelarPedido(pedido.id);
      if (res.error) { alert(res.error); return; }
      setInfoCancelado(true);
      setTimeout(() => onCancelar(), 2500);
    } catch {
      alert("Error al cancelar el pedido.");
    } finally {
      setCancelando(false);
    }
  }

  if (infoCancelado) {
    return (
      <div style={seg.canceladoBox}>
        <div style={seg.canceladoIcon}>✓</div>
        <p style={seg.canceladoTitle}>Pedido cancelado</p>
        <p style={seg.canceladoSub}>Volviendo al menú…</p>
      </div>
    );
  }

  const esPendiente = pedido.estado === "PENDIENTE";

  return (
    <div style={seg.wrap}>
      {/* Banner de estado */}
      <div style={esPendiente ? seg.bannerPendiente : seg.bannerEnCamino}>
        <span style={seg.bannerIcon}>{esPendiente ? "⏳" : "🛵"}</span>
        <div style={{ flex: 1 }}>
          <p style={seg.bannerTitle}>
            {esPendiente ? "Buscando repartidor…" : "¡Tu pedido está en camino!"}
          </p>
          <p style={seg.bannerSub}>
            {esPendiente
              ? "El mapa muestra la ruta que tomará el repartidor desde la sucursal hasta ti"
              : "El repartidor ya tomó tu pedido — puedes ver su trayecto completo en el mapa"}
          </p>
        </div>
        {esPendiente && (
          <button
            onClick={handleCancelar}
            disabled={cancelando}
            style={seg.cancelBtn}
          >
            {cancelando ? "Cancelando…" : "✕ Cancelar pedido"}
          </button>
        )}
      </div>

      {/* Mapa */}
      <div style={seg.mapaBox}>
        <div style={seg.mapaHeader}>
          <span style={seg.mapaTit}>Seguimiento en vivo</span>
          <div style={seg.leyenda}>
            {pedido.estado === "EN_CAMINO" && (
              <span style={seg.ley}><span style={{ ...seg.dot, background: "#f4a261" }} /> Repartidor</span>
            )}
            <span style={seg.ley}><span style={{ ...seg.dot, background: "#2d6a4f" }} /> Sucursal</span>
            <span style={seg.ley}><span style={{ ...seg.dot, background: "#e63946" }} /> Tú</span>
          </div>
        </div>
        <div ref={mapRef} style={{ width: "100%", height: 400 }} />
      </div>
    </div>
  );
}

// ── Pantalla de pedido entregado con puntuación de estrellas ──
function PedidoEntregadoView({ pedidoId, onFinalizar }) {
  const [estrellasHover, setEstrellasHover] = useState(0);
  const [estrellasSel, setEstrellasSel] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);

  async function handlePuntuar(rating) {
    setEnviando(true);
    try {
      await puntuarPedido(pedidoId, rating);
    } catch { /* silencioso */ }
    setFinalizado(true);
    setTimeout(onFinalizar, 2000);
  }

  if (finalizado) {
    return (
      <div style={pe.wrap}>
        <div style={pe.icon}>🙏</div>
        <p style={pe.titulo}>¡Gracias por tu valoración!</p>
        <p style={pe.sub}>Volviendo al inicio…</p>
      </div>
    );
  }

  return (
    <div style={pe.wrap}>
      <div style={pe.icon}>✅</div>
      <p style={pe.titulo}>¡Pedido entregado!</p>
      <p style={pe.sub}>¿Cómo fue tu experiencia? Puntúa la entrega:</p>

      <div style={pe.estrellas}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            style={pe.estrella}
            onMouseEnter={() => setEstrellasHover(n)}
            onMouseLeave={() => setEstrellasHover(0)}
            onClick={() => { setEstrellasSel(n); handlePuntuar(n); }}
            disabled={enviando}
            aria-label={`${n} estrella${n>1?"s":""}`}
          >
            <span style={{ fontSize: 42, color: n <= (estrellasHover || estrellasSel) ? "#f4a261" : "#ddd", transition:"color .1s" }}>★</span>
          </button>
        ))}
      </div>

      <div style={pe.leyendaEstrellas}>
        <span style={{ color: "#aaa", fontSize: 12 }}>😞 Muy malo</span>
        <span style={{ color: "#aaa", fontSize: 12 }}>😍 Excelente</span>
      </div>

      <button
        onClick={() => handlePuntuar(null)}
        disabled={enviando}
        style={pe.noPuntuar}
      >
        Prefiero no puntuar
      </button>
    </div>
  );
}

// ── Menú de un restaurante ──
function MenuRestaurante({ restaurante, onVolver }) {
  const [carrito, setCarrito] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [pedidoActivo, setPedidoActivo] = useState(null);
  const [pedidoEntregadoId, setPedidoEntregadoId] = useState(null);
  const menu = restaurante.menu || [];

  function agregar(id) { setCarrito(c => ({ ...c, [id]: (c[id] || 0) + 1 })); }
  function quitar(id) {
    setCarrito(c => { const n = { ...c }; if (n[id] > 1) n[id]--; else delete n[id]; return n; });
  }
  const itemsCarrito = Object.entries(carrito).map(([id, cantidad]) => ({
    producto: menu.find(p => p.id === id), cantidad,
  }));
  const total = itemsCarrito.reduce((s, { producto, cantidad }) => s + (producto?.precio || 0) * cantidad, 0);

  async function confirmarPedido() {
    setEnviando(true); setError("");
    try {
      const items = itemsCarrito.map(({ producto, cantidad }) => ({ product_id: producto.id, cantidad }));
      const res = await crearPedido(items);
      if (res.error) { setError(res.error); return; }
      // Mostrar seguimiento inmediatamente con estado PENDIENTE
      setPedidoActivo({ id: res.id, estado: "PENDIENTE" });
    } catch {
      setError("Error al enviar el pedido.");
    } finally {
      setEnviando(false);
    }
  }

  // FIX #3 y #4: Polling automático — consulta el estado del pedido cada 4 s.
  // Cuando el trabajador acepta, el estado cambia a EN_CAMINO y se reciben
  // las coords del repartidor, actualizando la vista del cliente automáticamente.
  // Cuando el trabajador entrega, el estado pasa a ENTREGADO y se muestra la pantalla de puntuación.
  useEffect(() => {
    if (!pedidoActivo) return;
    const interval = setInterval(async () => {
      try {
        const data = await getMiPedidoActivo();
        if (!data || data.error) {
          // El pedido ya no está activo (puede haber sido entregado)
          // Consultamos si hay un pedido recién entregado sin puntuar
          const entregado = await getMiPedidoEntregado();
          if (entregado && entregado.id) {
            clearInterval(interval);
            setPedidoActivo(null);
            setPedidoEntregadoId(entregado.id);
          }
          return;
        }
        setPedidoActivo(prev => {
          if (!prev) return prev;
          if (prev.estado === data.estado && prev.trabajador_lat === data.trabajador_lat) return prev;
          return { ...prev, ...data };
        });
      } catch { /* silencioso */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [pedidoActivo?.id]);

  // Si el pedido fue entregado, mostrar pantalla de puntuación
  if (pedidoEntregadoId) {
    return (
      <PedidoEntregadoView
        pedidoId={pedidoEntregadoId}
        onFinalizar={() => {
          setPedidoEntregadoId(null);
          setCarrito({});
          setError("");
        }}
      />
    );
  }

  // Si hay pedido activo, mostrar la pantalla de seguimiento
  if (pedidoActivo) {
    return (
      <div style={mv.wrap}>
        <div style={mv.restoHeader}>
          <div style={mv.restoInfo}>
            <h2 style={mv.restoNombre}>{restaurante.nombre}</h2>
            <div style={mv.restoBadges}>
              <span style={mv.badge}>{restaurante.tipo}</span>
              <span style={mv.badge}>{restaurante.rating}</span>
            </div>
          </div>
        </div>
        <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
          <SeguimientoPedido
            key={pedidoActivo.estado}
            pedido={pedidoActivo}
            restaurante={restaurante}
            onCancelar={() => {
              setPedidoActivo(null);
              setCarrito({});
              setError("");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={mv.wrap}>
      <div style={mv.restoHeader}>
        <button onClick={onVolver} style={mv.backBtn}>← Volver al mapa</button>
        <div style={mv.restoInfo}>
          <h2 style={mv.restoNombre}>{restaurante.nombre}</h2>
          <div style={mv.restoBadges}>
            <span style={mv.badge}>{restaurante.tipo}</span>
            <span style={mv.badge}>{restaurante.rating}</span>
            <span style={mv.badge}>{restaurante.tiempo}</span>
          </div>
        </div>
      </div>
      <div style={mv.layout}>
        <main style={mv.menuCol}>
          <h3 style={mv.secTitle}>Menú</h3>
          {menu.length === 0 ? <p style={mv.muted}>Cargando productos…</p> : (
            <div style={mv.menuGrid}>
              {menu.map(p => (
                <div key={p.id} style={mv.card}>
                  <div style={mv.cardInfo}>
                    <p style={mv.cardNombre}>{p.nombre}</p>
                    <p style={mv.cardDesc}>{p.descripcion}</p>
                    <p style={mv.cardPrecio}>${Number(p.precio).toLocaleString("es-CL")}</p>
                  </div>
                  <div style={mv.cardAction}>
                    {carrito[p.id] ? (
                      <div style={mv.counter}>
                        <button onClick={() => quitar(p.id)} style={mv.cBtn}>−</button>
                        <span style={mv.cNum}>{carrito[p.id]}</span>
                        <button onClick={() => agregar(p.id)} style={mv.cBtn}>+</button>
                      </div>
                    ) : (
                      <button onClick={() => agregar(p.id)} style={mv.addBtn}>Agregar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <aside style={mv.sidebar}>
          <h3 style={mv.secTitle}>Tu pedido</h3>
          {itemsCarrito.length === 0 ? <p style={mv.muted}>Agrega productos para armar tu pedido.</p> : (
            <>
              {itemsCarrito.map(({ producto, cantidad }) => (
                <div key={producto.id} style={mv.cartItem}>
                  <span style={mv.cartNombre}>{producto.nombre} ×{cantidad}</span>
                  <span style={mv.cartPrecio}>${(producto.precio * cantidad).toLocaleString("es-CL")}</span>
                </div>
              ))}
              <div style={mv.totalRow}>
                <span>Total</span>
                <strong>${total.toLocaleString("es-CL")}</strong>
              </div>
              {error && <div style={mv.errorBox}>{error}</div>}
              <button onClick={confirmarPedido} disabled={enviando} style={mv.confirmBtn}>
                {enviando ? "Enviando…" : "Confirmar pedido"}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Componente principal ──
export default function ClienteView({ email, onLogout }) {
  const [vista, setVista] = useState("mapa");
  const [restauranteSeleccionado, setRestauranteSeleccionado] = useState(null);
  const [restaurantes, setRestaurantes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const emojis = { pizza: "Pi", hamburguesa: "H", bebida: "B", pasta: "Pa", pollo: "Po", arroz: "A" };
    function emoji(nombre) {
      const n = nombre.toLowerCase();
      for (const [k, v] of Object.entries(emojis)) { if (n.includes(k)) return v; }
      return "Pl";
    }
    getProductos()
      .then(productos => {
        const prods = Array.isArray(productos)
          ? productos.map(p => ({ ...p, precio: Number(p.precio), emoji: emoji(p.nombre) }))
          : [];
        const filtrados = RESTAURANTES_BASE.filter(r =>
          distanciaKm(CLIENTE_LAT, CLIENTE_LNG, r.lat, r.lng) <= RADIO_KM
        );
        setRestaurantes(filtrados.map(r => ({ ...r, menu: prods })));
      })
      .catch(() => {
        setRestaurantes(RESTAURANTES_BASE
          .filter(r => distanciaKm(CLIENTE_LAT, CLIENTE_LNG, r.lat, r.lng) <= RADIO_KM)
          .map(r => ({ ...r, menu: [] }))
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.logo}>FoodExpress</span>
          <div style={s.headerRight}>
            <span style={s.email}>{email}</span>
            <button onClick={onLogout} style={s.logoutBtn}>Salir</button>
          </div>
        </div>
      </header>

      {vista === "mapa" ? (
        <div style={s.mapaPage}>
          <div style={s.mapaPageInner}>
            <div style={s.mapaIntro}>
              <h1 style={s.mapaH1}>¿Qué quieres comer hoy?</h1>
              <p style={s.mapaP}>Restaurantes a menos de {RADIO_KM}km de tu ubicación en Santiago</p>
            </div>
            {loading ? <p style={s.muted}>Cargando restaurantes…</p> : (
              <div style={s.mapaConLista}>
                <MapaRestaurantesLeaflet
                  restaurantes={restaurantes}
                  seleccionado={restauranteSeleccionado}
                  onSeleccionar={setRestauranteSeleccionado}
                />
                <div style={s.listaPanel}>
                  <h3 style={s.listaTitulo}>{restaurantes.length} restaurantes cercanos</h3>
                  <div style={s.lista}>
                    {restaurantes.map(r => {
                      const dist = distanciaKm(CLIENTE_LAT, CLIENTE_LNG, r.lat, r.lng);
                      const activo = restauranteSeleccionado?.id === r.id;
                      return (
                        <div key={r.id} onClick={() => setRestauranteSeleccionado(r)}
                          style={{ ...s.restoCard, ...(activo ? s.restoCardActivo : {}) }}>
                          <div>
                            <p style={s.restoNombre}>{r.nombre}</p>
                            <p style={s.restoTipo}>{r.tipo}</p>
                            <div style={s.restoBadges}>
                              <span style={s.miniB}>{r.rating}</span>
                              <span style={s.miniB}>{r.tiempo}</span>
                              <span style={s.miniB}>{dist.toFixed(1)}km</span>
                            </div>
                          </div>
                          <span style={s.restoPlatos}>{r.menu.length} platos</span>
                        </div>
                      );
                    })}
                  </div>
                  {restauranteSeleccionado && (
                    <button onClick={() => setVista("menu")} style={s.verMenuBtn}>
                      Ver menú de {restauranteSeleccionado.nombre} →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <MenuRestaurante restaurante={restauranteSeleccionado} onVolver={() => setVista("mapa")} />
      )}
    </div>
  );
}

// ── Estilos ──
const ms = {
  mapaWrapper: { background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", overflow: "hidden", flex: "0 0 500px" },
  mapaHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f0f0eb" },
  mapaTitle: { fontWeight: 700, fontSize: 15, color: "#1a1a1a" },
  mapaSubtitle: { fontSize: 12, color: "#888" },
  rutaBanner: { padding: "10px 20px", background: "#f0fdf4", borderBottom: "1px solid #d1fae5", fontSize: 13 },
  rutaCalculando: { color: "#555" },
  rutaError: { color: "#c0392b" },
  rutaInfo: { color: "#1a1a1a" },
  rutaDato: { fontWeight: 700, color: "#2d6a4f" },
  mapaLeyenda: { display: "flex", gap: 20, padding: "12px 20px", borderTop: "1px solid #f0f0eb", background: "#fafaf8" },
  leyItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#666" },
  dot: { width: 10, height: 10, borderRadius: "50%", display: "inline-block" },
};
const seg = {
  wrap: { display: "flex", flexDirection: "column", gap: 16 },
  bannerPendiente: { display: "flex", alignItems: "center", gap: 16, background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "16px 20px", flexWrap: "wrap" },
  bannerEnCamino: { display: "flex", alignItems: "center", gap: 16, background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 12, padding: "16px 20px", flexWrap: "wrap" },
  bannerIcon: { fontSize: 32 },
  bannerTitle: { margin: "0 0 4px", fontWeight: 700, fontSize: 16, color: "#1a1a1a" },
  bannerSub: { margin: 0, fontSize: 13, color: "#666" },
  cancelBtn: { marginLeft: "auto", padding: "8px 16px", background: "#fff5f5", color: "#c0392b", border: "1.5px solid #fecaca", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" },
  mapaBox: { background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.07)" },
  mapaHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #f0f0eb" },
  mapaTit: { fontWeight: 700, fontSize: 14, color: "#1a1a1a" },
  leyenda: { display: "flex", gap: 14 },
  ley: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#666" },
  dot: { width: 9, height: 9, borderRadius: "50%", display: "inline-block" },
  canceladoBox: { textAlign: "center", padding: "60px 20px" },
  canceladoIcon: { fontSize: 48, color: "#2d6a4f", marginBottom: 12 },
  canceladoTitle: { margin: "0 0 8px", fontWeight: 700, fontSize: 20, color: "#1a1a1a" },
  canceladoSub: { margin: 0, color: "#888", fontSize: 14 },
};
const mv = {
  wrap: { minHeight: "calc(100vh - 56px)", background: "#f7f7f3", fontFamily: "'Segoe UI',sans-serif" },
  restoHeader: { background: "#fff", borderBottom: "1px solid #ebebeb", padding: "16px 32px" },
  backBtn: { background: "none", border: "none", color: "#2d6a4f", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 10, padding: 0 },
  restoInfo: { display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" },
  restoNombre: { margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a1a" },
  restoBadges: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: { background: "#f0f0ea", color: "#555", borderRadius: 99, padding: "4px 12px", fontSize: 13, fontWeight: 600 },
  layout: { display: "flex", gap: 24, padding: 32, maxWidth: 1200, margin: "0 auto" },
  menuCol: { flex: 1 },
  secTitle: { margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#1a1a1a" },
  menuGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 },
  card: { background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" },
  cardInfo: { padding: "14px 16px", flex: 1 },
  cardNombre: { margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: "#1a1a1a" },
  cardDesc: { margin: "0 0 8px", fontSize: 12, color: "#888", lineHeight: 1.5 },
  cardPrecio: { margin: 0, fontWeight: 800, fontSize: 16, color: "#2d6a4f" },
  cardAction: { padding: "12px 16px", borderTop: "1px solid #f0f0f0" },
  addBtn: { width: "100%", padding: "8px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 },
  counter: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cBtn: { width: 32, height: 32, background: "#f0f0ea", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 16, fontWeight: 700 },
  cNum: { fontWeight: 700, fontSize: 15 },
  sidebar: { width: 300, background: "#fff", borderRadius: 12, padding: 24, height: "fit-content", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", position: "sticky", top: 24 },
  cartItem: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 },
  cartNombre: { color: "#444", flex: 1, paddingRight: 8 },
  cartPrecio: { fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" },
  totalRow: { display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 16, borderTop: "2px solid #1a1a1a", marginTop: 8 },
  confirmBtn: { width: "100%", padding: 12, background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 15, marginTop: 16 },
  muted: { color: "#aaa", fontSize: 14 },
  errorBox: { background: "#fff0f0", color: "#c0392b", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 },
};
const s = {
  page: { minHeight: "100vh", background: "#f7f7f3", fontFamily: "'Segoe UI',sans-serif" },
  header: { background: "#1a1a1a", color: "#fff", padding: "0 32px", height: 56, display: "flex", alignItems: "center" },
  headerInner: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { fontWeight: 700, fontSize: 18 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  email: { fontSize: 13, color: "#aaa" },
  logoutBtn: { background: "none", border: "1px solid #555", color: "#ccc", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 13 },
  mapaPage: { padding: 32 },
  mapaPageInner: { maxWidth: 1200, margin: "0 auto" },
  mapaIntro: { marginBottom: 28 },
  mapaH1: { margin: "0 0 6px", fontSize: 28, fontWeight: 800, color: "#1a1a1a" },
  mapaP: { margin: 0, color: "#666", fontSize: 15 },
  muted: { color: "#aaa", fontSize: 15 },
  mapaConLista: { display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" },
  listaPanel: { flex: 1, minWidth: 300 },
  listaTitulo: { margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#555" },
  lista: { display: "flex", flexDirection: "column", gap: 10 },
  restoCard: { background: "#fff", borderRadius: 12, padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", border: "2px solid transparent", transition: "all .15s" },
  restoCardActivo: { border: "2px solid #2d6a4f", background: "#f0fdf4" },
  restoNombre: { margin: "0 0 2px", fontWeight: 700, fontSize: 15, color: "#1a1a1a" },
  restoTipo: { margin: "0 0 8px", fontSize: 13, color: "#666" },
  restoBadges: { display: "flex", gap: 6, flexWrap: "wrap" },
  miniB: { fontSize: 12, color: "#666", background: "#f5f5f0", borderRadius: 99, padding: "2px 8px" },
  restoPlatos: { fontSize: 12, color: "#aaa", fontWeight: 600 },
  verMenuBtn: { marginTop: 20, width: "100%", padding: "14px", background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 15 },
};

const pe = {
  wrap: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", padding:"48px 24px", gap:16, fontFamily:"'Segoe UI',sans-serif" },
  icon: { fontSize:72, lineHeight:1 },
  titulo: { margin:0, fontSize:28, fontWeight:800, color:"#1a1a1a", textAlign:"center" },
  sub: { margin:0, fontSize:15, color:"#666", textAlign:"center" },
  estrellas: { display:"flex", gap:4, marginTop:8 },
  estrella: { background:"none", border:"none", cursor:"pointer", padding:"0 4px", lineHeight:1 },
  leyendaEstrellas: { display:"flex", justifyContent:"space-between", width:260 },
  noPuntuar: { marginTop:12, background:"none", border:"1.5px solid #ddd", borderRadius:8, padding:"10px 24px", cursor:"pointer", fontSize:14, color:"#888", fontWeight:600 },
};
