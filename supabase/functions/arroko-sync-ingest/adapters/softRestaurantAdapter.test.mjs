import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnvelope } from '../contract.mjs';
import {
  last4Digits,
  mapClient,
  mapIngredient,
  mapInventorySnapshot,
  mapOrder,
  mapProduct,
} from './softRestaurantAdapter.mjs';

// Fixtures shaped exactly like the real Soft Restaurant columns documented in
// docs/clients/arroko/soft-restaurant-tablas-factorbi.md (2026-09-10 Factor BI dump).

const PRODUCTO_ROLLO = {
  idproducto: 'ROLL-042',
  descripcion: 'Rollo Arroko Especial',
  idgrupo: 'ROLLS',
  plu: '4200',
  visible_menu: true,
  idinsumospresentaciones: null,
};

const PRECIO_DETALLE = { idlistaprecio: 1, idproducto: 'ROLL-042', precio: 185, preciosinimpuesto: 159.48 };

const INSUMO_SALMON = { idinsumo: 'INS-SALMON', descripcion: 'Salmón fresco', idgruposi: 'PROT', unidad: 'kg', elaborado: false };
const INSUMO_DETALLE = { idinsumo: 'INS-SALMON', idempresa: 'EMP-1', costo: 210.5, costopromedio: 205.0, estatus: 1 };

const CLIENTE_ROW = {
  idcliente: 'CLI-9001',
  nombre: 'María Fernanda López',
  telefono1: '6671234567',
  email: 'mflopez@example.com',
  rfc: 'LOFM800101ABC',
  direccion: 'Calle Falsa 123',
};

const ACUMULADO_ROW = { id: 1, idinsumo: 'INS-SALMON', idalmacen: 'ALM-TRESRIOS', existencia: 12.4 };

const CHEQUE_ROW = {
  folio: 55012,
  seriefolio: 'A',
  idempresa: 'EMP-1',
  idcliente: 'CLI-9001',
  fecha: '2026-09-09T20:15:00Z',
  cierre: '2026-09-09T21:03:00Z',
  pagado: true,
  cancelado: false,
  subtotal: 620,
  descuentoimporte: 20,
  totalimpuestod1: 96,
  totalimpuestod2: null,
  totalimpuestod3: null,
  total: 696,
};

const CHEQDET_ROWS = [
  { foliodet: 900001, movimiento: 1, idproducto: 'ROLL-042', cantidad: 2, precio: 185, preciosinimpuestos: 159.48, descuento: 0 },
  { foliodet: 900002, movimiento: 1, idproducto: 'ROLL-VOLCAN', cantidad: 1, precio: 250, preciosinimpuestos: 215.5, descuento: 20 },
];

const CHEQUESPAGOS_ROWS = [{ folio: 55012, idformadepago: 'EFEC', importe: 400 }, { folio: 55012, idformadepago: 'TARJ', importe: 296 }];

test('mapProduct: usa listadepreciosdetalle para el precio y no inventa columnas', () => {
  const event = mapProduct(PRODUCTO_ROLLO, { precioDetalle: PRECIO_DETALLE });
  assert.equal(event.external_id, 'ROLL-042');
  assert.equal(event.name, 'Rollo Arroko Especial');
  assert.equal(event.price, 185);
  assert.equal(event.active, true);
});

test('mapProduct: sin lista de precios resuelta, price es null (no se inventa un 0)', () => {
  const event = mapProduct(PRODUCTO_ROLLO, {});
  assert.equal(event.price, null);
});

test('mapIngredient: toma costo promedio de insumosdetalle', () => {
  const event = mapIngredient(INSUMO_SALMON, INSUMO_DETALLE);
  assert.equal(event.current_cost, 205.0);
  assert.equal(event.reorder_point, null);
});

test('mapClient: nunca expone teléfono/email crudos ni nombre por default', () => {
  const event = mapClient(CLIENTE_ROW);
  assert.equal(event.display_name, null);
  assert.equal(event.phone_last4, '4567');
  assert.equal(event.email_masked, 'm*****z@example.com');
  assert.equal(event.contact_ref, null);
  assert.equal(event.marketing_consent, false);
  assert.equal('telefono1' in event, false);
  assert.equal('email' in event, false);
  assert.equal('rfc' in event, false);
});

test('mapClient: allowDisplayName es una decisión explícita del llamador, no el default', () => {
  const event = mapClient(CLIENTE_ROW, { allowDisplayName: true });
  assert.equal(event.display_name, 'María Fernanda López');
});

test('el evento client.upsert de mapClient pasa el contrato de arroko-sync-ingest', () => {
  const event = mapClient(CLIENTE_ROW);
  const envelope = {
    connector_id: '11111111-1111-4111-8111-111111111111',
    cursor: null,
    events: [{ id: 'client-CLI-9001-v1', type: 'client.upsert', occurred_at: '2026-09-10T00:00:00Z', data: event }],
  };
  assert.doesNotThrow(() => parseEnvelope(envelope));
});

test('mapInventorySnapshot: la fila no trae timestamp, lo pone el extractor', () => {
  const event = mapInventorySnapshot(ACUMULADO_ROW, { capturedAt: '2026-09-10T06:00:00Z' });
  assert.equal(event.quantity, 12.4);
  assert.equal(event.captured_at, '2026-09-10T06:00:00Z');
  assert.equal(event.location_external_id, 'ALM-TRESRIOS');
});

test('mapOrder: agrega items y pagos, y el canal queda unknown a propósito', () => {
  const event = mapOrder(CHEQUE_ROW, { items: CHEQDET_ROWS, payments: CHEQUESPAGOS_ROWS });
  assert.equal(event.external_id, 'EMP-1-A-55012');
  assert.equal(event.status, 'paid');
  assert.equal(event.channel, 'unknown');
  assert.equal(event.tax, 96);
  assert.equal(event.items.length, 2);
  assert.equal(event.items[0].net_amount, 2 * 159.48);
  assert.equal(event.payments.length, 2);
  assert.equal(event.payments[0].paid_at, '2026-09-09T21:03:00Z');
});

test('el evento order.upsert de mapOrder pasa el contrato de arroko-sync-ingest', () => {
  const event = mapOrder(CHEQUE_ROW, { items: CHEQDET_ROWS, payments: CHEQUESPAGOS_ROWS });
  const envelope = {
    connector_id: '11111111-1111-4111-8111-111111111111',
    cursor: '2026-09-09T21:03:00Z',
    events: [{ id: `order-${event.external_id}-v1`, type: 'order.upsert', occurred_at: CHEQUE_ROW.cierre, data: event }],
  };
  assert.doesNotThrow(() => parseEnvelope(envelope));
});

test('last4Digits ignora formato y toma los últimos 4 dígitos reales', () => {
  assert.equal(last4Digits('(667) 123-4567'), '4567');
  assert.equal(last4Digits(''), null);
  assert.equal(last4Digits(null), null);
});
