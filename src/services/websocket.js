import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// Backend: endpoint /temperaturas o /temperatures (SockJS), tópico /topic/temperaturas, payload: Double (temperatura)
const WS_BASE = import.meta.env.VITE_WS_URL ?? `${window.location.origin}/temperaturas`;

/**
 * Suscripción al tópico /topic/temperaturas.
 * El backend envía un valor numérico Double (temperatura) en cada mensaje, no el DTO completo.
 * @param {Object} options
 * @param {function(number): void} options.onTemperatura - Callback con el valor de temperatura recibido
 * @param {string} [options.token] - Token para autenticación si el backend lo requiere
 */
export function createTemperaturasSubscription({ onTemperatura, token } = {}) {
  const url = token ? `${WS_BASE}?token=${encodeURIComponent(token)}` : WS_BASE;
  const socket = new SockJS(url);
  const client = new Client({
    webSocketFactory: () => socket,
    reconnectDelay: 3000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    onConnect: () => {
      client.subscribe("/topic/temperaturas", (message) => {
        try {
          const body = message.body;
          const value = typeof body === "string" ? parseFloat(body, 10) : Number(body);
          if (!Number.isNaN(value)) onTemperatura(value);
        } catch (e) {
          console.warn("WS temperaturas: error parseando", e);
        }
      });
    },
    onStompError: (frame) => {
      console.warn("STOMP error", frame);
    },
  });
  client.activate();
  return () => client.deactivate();
}
