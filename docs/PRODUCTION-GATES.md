# Puertas de producción · Arrokó

La interfaz funciona como demostración y consolidación técnica. No publicar la dinámica como campaña real hasta cerrar estas puertas:

1. **Premios y canje del lado servidor.** La selección todavía ocurre en el navegador y el canje depende de permisos directos sobre `spins`. Crear funciones/RPC transaccionales que seleccionen, firmen, registren y canjeen una sola vez.
2. **Modelo de clientes.** Migrar el usuario de Instagram fuera de la columna histórica `email`, normalizar teléfono y definir reglas de deduplicación.
3. **Consentimiento y legal.** Aprobar aviso de privacidad, términos, vigencias, sucursales y consentimiento promocional separado.
4. **Menú y barra.** Validar precios/disponibilidad y aprobar o rechazar cada mocktail conceptual antes de mostrarlo como producto vigente.
5. **Integraciones privadas.** Configurar `GEMINI_API_KEY` sólo en servidor. Evolution API, n8n, Soft Restaurant y futuros cobros deben operar mediante proxies autenticados, auditoría y autorización por operación.
6. **Observabilidad.** Confirmar la tabla `user_interactions`, RLS y retención; los fallos analíticos no deben interrumpir al cliente.
7. **QA previo al lanzamiento.** Probar registro, duplicados, QR, expiración, doble canje, cámara, accesibilidad, móvil y recuperación ante red intermitente con datos de prueba.
