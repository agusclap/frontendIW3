Contrato de Datos - IW3 Backend
1. Modelos de Datos (Entidades)
Orden: id, estadoOrden, password, numeroOrden, producto, camion, chofer, cliente, preset, tara, pesoFinal, fechaRecepcionInicial, fechaPesajeTara, fechaInicioCarga, ultimaFechaInformacion, fechaCierreCarga, fechaCierreDeOrden, promedioDensidad, promedioTemperatura, promedioCaudal, ultimaMasaAcumulada, ultimaDensidad, ultimaTemperatura, ultimaFlowRate, alarmaActivada
Producto: id, nombre, descripcion, temperatura_umbral
Camion: id, patente, descripcion, cisterna
Cliente: id, nombreEmpresa, email
Chofer: id, dni, nombre, apellido
Cisterna: id, camion, capacidadLitros, licencia
2. DTOs de Entrada
DatosCargaDTO: numeroOrden, password, masa, densidad, temperatura, caudal
3. Configuración de WebSocket
Endpoint de conexión (STOMP): /temperaturas o /temperatures (con SockJS)
Prefijo destino aplicación: /app
Prefijo broker: /topic
Tópico usado en OrdenBusiness: /topic/temperaturas
Estructura del mensaje: Se envía un valor numérico Double (temperatura) cada vez que llegan datos de carga. No se envía el DatosCargaDTO completo.
4. Endpoints REST (Base URL: /api/v1, puerto 8080)
Órdenes: /api/v1/orden
  - GET /orden → listado. GET /orden/by-number/{numeroOrden} → detalle (el frontend usa este para evitar 403; no existe GET /orden/{id} en el controlador).
  - GET /orden/by-number/{numeroOrden}/historial-carga → historial de datos de carga para el gráfico "Temperatura durante la carga". Respuesta: array JSON de objetos con al menos temperatura y fecha/hora, ej. [{ "fechaHora": "2026-02-08T17:05:00", "temperatura": 1050, "masa": 10000 }, ...]. El frontend ordena por tiempo y dibuja temperatura vs tiempo. Si no existe (404), el gráfico muestra solo el punto actual.
Productos: /api/v1/products
Clientes: /api/v1/clientes
Camiones: /api/v1/camiones
Choferes: /api/v1/choferes
Cisternas: /api/v1/cisternas
Mail: /api/v1/mail
5. Referencia rápida para IA / Frontend
Clase       Atributos (Java)-----       --------Orden       id, estadoOrden, password, numeroOrden, producto, camion, chofer, cliente, preset, tara, pesoFinal, fechaRecepcionInicial, fechaPesajeTara, fechaInicioCarga, ultimaFechaInformacion, fechaCierreCarga, fechaCierreDeOrden, promedioDensidad, promedioTemperatura, promedioCaudal, ultimaMasaAcumulada, ultimaDensidad, ultimaTemperatura, ultimaFlowRate, alarmaActivadaProducto    id, nombre, descripcion, temperatura_umbralCamion      id, patente, descripcion, cisternaCliente     id, nombreEmpresa, emailChofer      id, dni, nombre, apellidoCisterna    id, camion, capacidadLitros, licenciaDatosCargaDTO  numeroOrden, password, masa, densidad, temperatura, caudalWebSocket: endpoint /temperaturas | /temperatures; broker /topic; tópico /topic/temperaturas; payload: Double (temperatura)