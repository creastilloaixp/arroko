// Pure mapping layer: Soft Restaurant SQL Server rows -> normalized events that
// arroko-sync-ingest already accepts (see ../contract.mjs EVENT_TYPES).
//
// No network calls, no Deno/Node platform APIs, no database access. This is the
// `SoftRestaurantAdapter` contract that softrestaurant-integration-research-2026-09-10.md
// green-lit building "desde ahora" so the CRM does not depend on which transport
// (NSDeveloper, WRestaurantAPI, or a read-only SQL bridge) eventually reads Soft
// Restaurant. Whichever worker ends up owning that transport imports this module,
// feeds it rows shaped like the real tables, and POSTs the resulting events to
// arroko-sync-ingest.
//
// Column names and types come from docs/clients/arroko/soft-restaurant-tablas-factorbi.md
// (INFORMATION_SCHEMA.COLUMNS dump via Factor BI, 2026-09-10) — a third party's
// documentation of Soft Restaurant's schema, not a confirmed contract with Arroko's
// actual install. Several fields below are marked TODO because the schema alone
// does not answer them; they map to the open questions in the research doc.

// ── PII-safe helpers ────────────────────────────────────────────────────────
// `clientes` carries raw telefono1..5, email, rfc, curp, direccion. None of that
// may ever reach a normalized event under its own name or any other — the ingest
// contract only blocks known key names (phone, email, ...), not phone-shaped
// values under a different key, so the guarantee has to live here, not there.

export function last4Digits(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function maskEmail(raw) {
  if (!raw || typeof raw !== 'string' || !raw.includes('@')) return null;
  const [user, domain] = raw.split('@');
  const maskedUser = user.length <= 2 ? `${user[0] || '*'}*` : `${user[0]}${'*'.repeat(user.length - 2)}${user.slice(-1)}`;
  return `${maskedUser}@${domain}`;
}

// ── product.upsert ← productos (+ listadepreciosdetalle para el precio) ────

export function mapProduct(producto, { precioDetalle } = {}) {
  return {
    external_id: producto.idproducto,
    name: producto.descripcion || null,
    sku: producto.plu || producto.idproducto,
    category: producto.idgrupo || null,
    // productos no trae precio propio; vive en listadepreciosdetalle por idlistaprecio.
    // Sin confirmar con Arroko qué lista de precios es la vigente por sucursal (research
    // doc, pregunta 7) se deja null si no se resuelve explícitamente.
    price: precioDetalle ? Number(precioDetalle.precio) : null,
    // SR no tiene una bandera "activo para venta" inequívoca. `visible_menu` es lo más
    // cercano (visible en el menú electrónico); default true si no viene el campo.
    active: producto.visible_menu === false ? false : true,
    metadata: {
      idgrupo: producto.idgrupo || undefined,
      idinsumospresentaciones: producto.idinsumospresentaciones || undefined,
    },
  };
}

// ── ingredient.upsert ← insumos + insumosdetalle ────────────────────────────

export function mapIngredient(insumo, detalle) {
  return {
    external_id: insumo.idinsumo,
    name: insumo.descripcion || null,
    unit: insumo.unidad || null,
    current_cost: detalle ? Number(detalle.costopromedio ?? detalle.costo ?? 0) : null,
    // Sin columna equivalente en insumos/insumosdetalle (research doc, pregunta 9:
    // si existencias/mermas se llevan en SR o fuera). Queda sin mapear a propósito.
    reorder_point: null,
    active: detalle ? Number(detalle.estatus) !== 0 : true,
  };
}

// ── client.upsert ← clientes ─────────────────────────────────────────────
//
// `allowDisplayName` está apagado por default: usar el nombre real del cliente
// como display_name es una decisión de producto/consentimiento (backend-handoff
// 2026-09-10, decisión 4 — "definir dónde vive la PII y documentar consentimiento"),
// no algo que este adapter deba asumir. Prender la bandera es responsabilidad de
// quien conecte el worker real, después de esa decisión.

export function mapClient(cliente, { allowDisplayName = false, resolveContactRef } = {}) {
  const phone = cliente.telefono1 || cliente.telefono2 || cliente.telefono3 || null;
  return {
    external_id: cliente.idcliente,
    display_name: allowDisplayName ? cliente.nombre || null : null,
    phone_last4: last4Digits(phone),
    email_masked: maskEmail(cliente.email),
    contact_ref: typeof resolveContactRef === 'function' ? resolveContactRef(cliente) : null,
    // SR no tiene columna de consentimiento de marketing (research doc, pregunta 12).
    // Nunca asumir `true`: sin fuente de consentimiento confirmada, se declara false.
    marketing_consent: false,
  };
}

// ── inventory.snapshot ← acumuladoinsumos ───────────────────────────────────
//
// acumuladoinsumos es una existencia corriente, no trae su propio timestamp — lo
// pone quien extrae (`capturedAt`), no la fila.

export function mapInventorySnapshot(acumulado, { capturedAt, locationExternalId } = {}) {
  return {
    // idalmacen es el almacén dentro de una empresa/sucursal en SR; si Arroko usa
    // un almacén por sucursal esto es 1:1 con location_external_id, si no, hace
    // falta el mapeo almacén→sucursal (research doc, pregunta 4).
    location_external_id: locationExternalId || acumulado.idalmacen,
    ingredient_external_id: acumulado.idinsumo,
    quantity: Number(acumulado.existencia),
    captured_at: capturedAt || new Date().toISOString(),
  };
}

// ── order.upsert ← cheques + cheqdet + chequespagos ─────────────────────────

function sumTaxes(cheque) {
  const parts = [cheque.totalimpuestod1, cheque.totalimpuestod2, cheque.totalimpuestod3];
  const known = parts.filter((value) => value != null);
  if (known.length) return known.reduce((sum, value) => sum + Number(value), 0);
  return Number(cheque.totalimpuesto1 || 0);
}

function mapOrderStatus(cheque) {
  if (cheque.cancelado) return 'cancelled';
  if (cheque.pagado) return 'paid';
  return 'open';
}

export function mapOrderItem(det) {
  const quantity = Number(det.cantidad || 0);
  const unitPrice = Number(det.precio || 0);
  const discount = Number(det.descuento || 0);
  // cheqdet no trae un "importe neto" propio; preciosinimpuestos es unitario.
  // Se aproxima con cantidad * precio_sin_impuestos, a reconciliar contra el total
  // del cheque antes de dar por buena esta fórmula en producción.
  const netAmount = det.preciosinimpuestos != null ? quantity * Number(det.preciosinimpuestos) : quantity * unitPrice;
  return {
    external_line_id: `${det.foliodet}-${det.movimiento}`,
    product_external_id: det.idproducto || null,
    name: det.comentario || undefined,
    quantity,
    unit_price: unitPrice,
    discount,
    net_amount: netAmount,
  };
}

export function mapPayment(pago, index) {
  return {
    // chequespagos no tiene id propio; folio+forma+índice es lo único estable
    // cuando hay dos pagos del mismo método y monto en un mismo cheque.
    external_id: `${pago.folio}-${pago.idformadepago}-${index}`,
    method: pago.idformadepago || 'other',
    amount: Number(pago.importe || 0),
    // chequespagos tampoco trae su propio timestamp; se usa el cierre del cheque.
    paid_at: pago.paid_at_fallback || undefined,
  };
}

export function mapOrder(cheque, { items = [], payments = [], locationExternalId } = {}) {
  const closedAt = cheque.cierre || null;
  return {
    external_id: `${cheque.idempresa}-${cheque.seriefolio || ''}-${cheque.folio}`,
    location_external_id: locationExternalId || cheque.idempresa,
    client_external_id: cheque.idcliente || null,
    // SR expone `tipodeservicio` como código numérico sin catálogo confirmado en
    // este volcado (comedor/domicilio/rápido/cedis se infieren de columnas bit en
    // `productos`, no de un catálogo de canal en `cheques`). Pendiente de Arroko.
    channel: 'unknown',
    status: mapOrderStatus(cheque),
    subtotal: Number(cheque.subtotal || 0),
    discount: Number(cheque.descuentoimporte || 0),
    tax: sumTaxes(cheque),
    total: Number(cheque.total || 0),
    opened_at: cheque.fecha,
    closed_at: closedAt,
    items: items.map(mapOrderItem),
    payments: payments.map((pago, index) => mapPayment({ ...pago, paid_at_fallback: closedAt || cheque.fecha }, index)),
  };
}
