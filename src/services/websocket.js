import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

/**
 * Base URL del WebSocket (mismo host/puerto que la API REST).
 * En dev: mismo origen → Vite proxy /temperaturas a backend.
 * En prod: usar VITE_WS_URL (ej. https://bruno.garibaldi.mooo.com) y path /temperaturas o /temperatures.
 */
function getWsBaseUrl() {
  if (import.meta.env.VITE_WS_URL) {
    const base = import.meta.env.VITE_WS_URL.replace(/\/$/, "");
    return `${base}/temperaturas`;
  }
  return `${window.location.origin}/temperaturas`;
}

/**
 * Normaliza el body del mensaje STOMP a string (backend envía String.valueOf(...)).
 * Si llega objeto u otro tipo, se serializa para poder parsear.
 */
function bodyToString(body) {
  if (body == null) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/**
 * Parsea el cuerpo del mensaje STOMP como número.
 * El backend envía string ("1060.0", "4.0", "101.0"). Acepta también número o JSON.
 */
function parseNumber(body) {
  const str = bodyToString(body);
  if (str === "") return NaN;
  const trimmed = str.trim();
  const n = parseFloat(trimmed, 10);
  if (!Number.isNaN(n)) return n;
  try {
    const parsed = JSON.parse(trimmed);
    const v = typeof parsed === "number" ? parsed : parsed?.value ?? parsed?.data ?? parsed?.[0];
    return typeof v === "number" && !Number.isNaN(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

/**
 * Una sola conexión STOMP sobre SockJS, con suscripción a los tres tópicos:
 * - /topic/temperaturas → temperatura
 * - /topic/densidad → densidad
 * - /topic/caudal → caudal (kg/h)
 *
 * Reconexión automática con reconnectDelay. Al desmontar la vista se llama al cleanup.
 *
 * @param {Object} options
 * @param {function(number): void} [options.onTemperatura]
 * @param {function(number): void} [options.onDensidad]
 * @param {function(number): void} [options.onCaudal]
 * @param {function(): void} [options.onConnect] - Llamado cuando la conexión está lista
 * @param {function(): void} [options.onDisconnect] - Llamado al desconectar
 * @param {string} [options.token] - Token JWT si el backend lo requiere en la URL
 * @returns {function(): void} Función para desactivar y cerrar la conexión
 */
export function createCargaSubscription({
  onTemperatura,
  onDensidad,
  onCaudal,
  onConnect,
  onDisconnect,
  token,
} = {}) {
  const baseUrl = getWsBaseUrl();
  const url = token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
  const socket = new SockJS(url);
  const client = new Client({
    webSocketFactory: () => socket,
    reconnectDelay: 3000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    onConnect: () => {
      const debug = import.meta.env.DEV;
      const ingest = (loc, msg, data, hypothesisId) => {
        const payload = { location: loc, message: msg, data: data ?? {}, timestamp: Date.now(), hypothesisId };
        console.warn("[DEBUG-WS]", JSON.stringify(payload));
        fetch('http://127.0.0.1:7246/ingest/e8eacad5-e1b3-4f2d-a3a7-5d2583984d88', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      };
      console.warn("[DEBUG-WS] Si ves este mensaje al abrir el detalle de la orden, el código instrumentado está activo. Al hacer POST de carga deberían aparecer más líneas [DEBUG-WS].");
      // #region agent log
      client.subscribe("/topic/temperaturas", (message) => {
        const value = parseNumber(message.body);
        ingest("websocket.js:temperaturas", "WS MESSAGE recibido", { topic: "/topic/temperaturas", body: message.body, bodyType: typeof message.body, parsed: value, isNaN: Number.isNaN(value), willCallHandler: !Number.isNaN(value) && !!onTemperatura }, "H1-H2");
        if (debug) console.debug("[WS] /topic/temperaturas", message.body, "→", value);
        if (!Number.isNaN(value) && onTemperatura) onTemperatura(value);
      });
      client.subscribe("/topic/densidad", (message) => {
        const rawBody = message.body;
        if (debug) console.debug("[WS] /topic/densidad body:", rawBody, "typeof:", typeof rawBody);
        const value = parseNumber(rawBody);
        ingest("websocket.js:densidad", "WS MESSAGE recibido", { topic: "/topic/densidad", body: rawBody, bodyType: typeof rawBody, parsed: value, willCallHandler: !Number.isNaN(value) && !!onDensidad }, "H1-H2");
        if (!Number.isNaN(value) && onDensidad) onDensidad(value);
      });
      client.subscribe("/topic/caudal", (message) => {
        const rawBody = message.body;
        if (debug) console.debug("[WS] /topic/caudal body:", rawBody, "typeof:", typeof rawBody);
        const value = parseNumber(rawBody);
        ingest("websocket.js:caudal", "WS MESSAGE recibido", { topic: "/topic/caudal", body: rawBody, bodyType: typeof rawBody, parsed: value, willCallHandler: !Number.isNaN(value) && !!onCaudal }, "H1-H2");
        if (!Number.isNaN(value) && onCaudal) onCaudal(value);
      });
      // #endregion
      ingest("websocket.js:onConnect", "Conexión STOMP lista, suscripciones activas", { topics: ["/topic/temperaturas", "/topic/densidad", "/topic/caudal"] }, "H4");
      if (onConnect) onConnect();
    },
    onDisconnect: () => {
      if (onDisconnect) onDisconnect();
    },
    onStompError: (frame) => {
      console.warn("STOMP error", frame);
    },
  });
  client.activate();
  return () => client.deactivate();
}

/**
 * @deprecated Usar createCargaSubscription con onTemperatura (y opcionalmente onDensidad, onCaudal).
 * Suscripción solo a /topic/temperaturas.
 */
export function createTemperaturasSubscription({ onTemperatura, token } = {}) {
  return createCargaSubscription({ onTemperatura, token });
}
