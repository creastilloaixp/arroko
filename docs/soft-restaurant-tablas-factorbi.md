# Soft Restaurant — catálogo de tablas y columnas SQL Server (Factor BI)

Fecha: 2026-09-10

## Procedencia

Google Sheet público de **Factor BI** (factorbi.com/soft-restaurant, proveedor externo de tableros de control para restaurantes con Soft Restaurant), guardado por Carlo desde el navegador el 2026-09-10. Tiene 4 pestañas, todas ya extraídas:

- **tablas**: catálogo curado a mano por Factor BI — 273 tablas con módulo, tipo y una bandera `sync` (si su propio tablero la usa).
- **tables_info**: volcado crudo de `INFORMATION_SCHEMA.TABLES` — 337 objetos (tablas y vistas).
- **columns_info**: volcado crudo de `INFORMATION_SCHEMA.COLUMNS` — 4,946 columnas sobre esas 337 tablas/vistas. Es el detalle real de campos por tabla.
- **Mas Info**: notas de Factor BI, sin estructura de tabla. Menciona una herramienta open source propia para copiar las tablas de Soft Restaurant a MySQL en AWS: https://factorbi.github.io/ — posible cuarta ruta de integración a evaluar junto con NSDeveloper y WRestaurantAPI en `softrestaurant-integration-research-2026-09-10.md`.

Es documentación de un tercero sobre la estructura interna de Soft Restaurant, no un contrato de integración — el esquema puede cambiar entre versiones/licencias, y la versión/topología reales de Arroko siguen sin confirmar. Sirve para acelerar el descubrimiento (Fase 0) con una referencia real de tablas y columnas.

## Resumen por módulo

273 tablas totales en el catálogo curado. **69 marcadas `Si`** por Factor BI (las que su propio tablero sí sincroniza/usa) — cruzables con los 5 módulos de `arroko-crm` (Clientes, Insumos, Operación, Reportería, Campañas).

| Módulo | Si (usadas) | No |
|---|---|---|
| Ventas | 15 | 13 |
| Inventarios | 13 | 1 |
| Productos | 12 | 6 |
| Insumos | 7 | 2 |
| Caja | 4 | 4 |
| Compras | 4 | 3 |
| Gastos | 4 | 0 |
| General | 3 | 3 |
| Recetas | 3 | 0 |
| Fiscal | 1 | 18 |
| Contabilidad | 1 | 2 |
| Marcación | 1 | 0 |
| Turnos | 1 | 1 |
| (sin módulo) | 0 | 140 |
| Interface | 0 | 3 |
| Cuentas por Cobrar | 0 | 2 |
| Cuentas por Pagar | 0 | 1 |
| Configuración | 0 | 3 |
| Mesas | 0 | 2 |

## Tablas relevantes (sync = Si), con columnas

Nombre, tipo y observaciones vienen del catálogo curado; las columnas, de `INFORMATION_SCHEMA.COLUMNS`. Cuando Factor BI no dejó descripción se omite esa celda.

### Ventas

**`areasrestaurant`** [BASE TABLE]

`idarearestaurant` varchar(5) NOT NULL, `descripcion` varchar(30), `idtiposervicio` numeric(1) default ((1))

**`areasrestaurantdetalle`** [BASE TABLE]

`idarearestaurant` varchar(5), `idempresa` varchar(15), `descargar` bit default ((0))

**`bitacoraenvioventas`**

_(sin columnas en el volcado — revisar `columns_info` a mano)_

**`cancela`** — Cancelación de productos [BASE TABLE] — vista vwf

`foliocheque` bigint(19) NOT NULL, `comanda` varchar(8), `cantidad` numeric(11,3), `clave` varchar(15), `razon` varchar(100), `fecha` datetime, `usuario` varchar(15), `precio` money(19,4), `idmotivocancela` text(2147483647), `idturno_cierre` bigint(19), `procesado` bit

**`cheqdet`** [BASE TABLE]

`foliodet` bigint(19), `movimiento` numeric(3), `comanda` varchar(8), `cantidad` numeric(14,6), `idproducto` varchar(15), `descuento` numeric(6,2), `precio` money(19,4), `impuesto1` numeric(5,2), `impuesto2` numeric(5,2), `impuesto3` numeric(5,2), `preciosinimpuestos` money(19,4), `tiempo` varchar(20), `hora` datetime, `modificador` bit default ((0)), `mitad` numeric(1), `comentario` varchar(250), `idestacion` varchar(40), `usuariodescuento` varchar(15), `comentariodescuento` varchar(60), `idtipodescuento` varchar(5), `horaproduccion` datetime, `idproductocompuesto` varchar(15), `productocompuestoprincipal` bit default ((0)), `preciocatalogo` money(19,4), `marcar` bit default ((0)), `idmeseroproducto` varchar(4), `prioridadproduccion` varchar(1), `estatuspatin` numeric(1) default ((0)), `idcortesia` varchar(5), `numerotarjeta` varchar(16), `estadomonitor` numeric(1) default ((0)), `llavemovto` varchar(100), `horameserofinalizado` datetime, `meserofinalizado` varchar(4), `sistema_envio` int(10) NOT NULL default ((1)), `idturno_cierre` bigint(19), `procesado` bit, `promovolumen` bit NOT NULL default ((0)), `iddispositivo` int(10) NOT NULL default ((-1)), `productsyncidsr` int(10) NOT NULL default ('-1'), `subtotalsrx` numeric(7,5) NOT NULL default ('-1'), `totalsrx` numeric(7,5) NOT NULL default ('-1'), `idlistaprecio` int(10), `tipocambio` money(19,4), `idmovtobillar` bigint(19) NOT NULL default ((0)), `impuestoimporte3` money(19,4) NOT NULL default ((0))

**`cheques`** [BASE TABLE]

`folio` bigint(19) NOT NULL, `seriefolio` varchar(15), `numcheque` numeric(8), `fecha` datetime, `salidarepartidor` datetime, `arriborepartidor` datetime, `cierre` datetime, `mesa` varchar(15), `nopersonas` numeric(3), `idmesero` varchar(4), `pagado` bit default ((0)), `cancelado` bit default ((0)), `impreso` bit default ((0)), `impresiones` numeric(6), `cambio` money(19,4), `descuento` numeric(8,4), `reabiertas` numeric(4), `razoncancelado` varchar(100), `orden` numeric(6), `facturado` bit default ((0)), `idcliente` varchar(15), `idarearestaurant` varchar(5), `idempresa` varchar(15), `tipodeservicio` numeric(1), `idturno` numeric(6), `usuariocancelo` varchar(15), `comentariodescuento` varchar(60), `estacion` varchar(40), `cambiorepartidor` money(19,4), `usuariodescuento` varchar(15), `fechacancelado` datetime, `idtipodescuento` varchar(5), `numerotarjeta` varchar(30), `folionotadeconsumo` numeric(8), `notadeconsumo` bit default ((0)), `propinapagada` bit default ((0)), `propinafoliomovtocaja` numeric(8), `puntosmonederogenerados` money(19,4), `propinaincluida` money(19,4), `tarjetadescuento` varchar(30), `porcentajefac` numeric(11,6), `usuariopago` varchar(15), `propinamanual` bit default ((0)), `observaciones` varchar(250), `idclientedomicilio` varchar(15), `iddireccion` varchar(15), `idclientefacturacion` varchar(15), `telefonousadodomicilio` varchar(15), `totalarticulos` numeric(11,2), `subtotal` money(19,4), `subtotalsinimpuestos` money(19,4), `total` money(19,4), `totalconpropina` money(19,4), `totalsinimpuestos` money(19,4), `totalsindescuentosinimpuesto` money(19,4), `totalimpuesto1` money(19,4), `totalalimentosconimpuestos` money(19,4), `totalbebidasconimpuestos` money(19,4), `totalotrosconimpuestos` money(19,4), `totalalimentossinimpuestos` money(19,4), `totalbebidassinimpuestos` money(19,4), `totalotrossinimpuestos` money(19,4), `totaldescuentossinimpuestos` money(19,4), `totaldescuentosconimpuestos` money(19,4), `totaldescuentoalimentosconimpuesto` money(19,4), `totaldescuentobebidasconimpuesto` money(19,4), `totaldescuentootrosconimpuesto` money(19,4), `totaldescuentoalimentossinimpuesto` money(19,4), `totaldescuentobebidassinimpuesto` money(19,4), `totaldescuentootrossinimpuesto` money(19,4), `totalcortesiassinimpuestos` money(19,4), `totalcortesiasconimpuestos` money(19,4), `totalcortesiaalimentosconimpuesto` money(19,4), `totalcortesiabebidasconimpuesto` money(19,4), `totalcortesiaotrosconimpuesto` money(19,4), `totalcortesiaalimentossinimpuesto` money(19,4), `totalcortesiabebidassinimpuesto` money(19,4), `totalcortesiaotrossinimpuesto` money(19,4), `totaldescuentoycortesiasinimpuesto` money(19,4), `totaldescuentoycortesiaconimpuesto` money(19,4), `cargo` money(19,4), `totalconcargo` money(19,4), `totalconpropinacargo` money(19,4), `descuentoimporte` money(19,4), `efectivo` money(19,4), `tarjeta` money(19,4), `vales` money(19,4), `otros` money(19,4), `propina` money(19,4), `propinatarjeta` money(19,4), `totalalimentossinimpuestossindescuentos` money(19,4), `totalbebidassinimpuestossindescuentos` money(19,4), `totalotrossinimpuestossindescuentos` money(19,4), `campoadicional1` varchar(30), `idreservacion` varchar(15), `idcomisionista` varchar(5), `importecomision` money(19,4), `comisionpagada` bit default ((0)), `fechapagocomision` datetime, `foliopagocomision` numeric(8), `tipoventarapida` numeric(1), `callcenter` bit default ((0)), `idordencompra` bigint(19) default (NULL), `totalsindescuento` money(19,4), `totalalimentos` money(19,4), `totalbebidas` money(19,4), `totalotros` money(19,4), `totaldescuentos` money(19,4), `totaldescuentoalimentos` money(19,4), `totaldescuentobebidas` money(19,4), `totaldescuentootros` money(19,4), `totalcortesias` money(19,4), `totalcortesiaalimentos` money(19,4), `totalcortesiabebidas` money(19,4), `totalcortesiaotros` money(19,4), `totaldescuentoycortesia` money(19,4), `totalalimentossindescuentos` money(19,4), `totalbebidassindescuentos` money(19,4), `totalotrossindescuentos` money(19,4), `descuentocriterio` numeric(1), `descuentomonedero` money(19,4), `idmenucomedor` varchar(15), `subtotalcondescuento` money(19,4), `comisionpax` money(19,4), `procesadointerfaz` bit, `domicilioprogramado` bit, `fechadomicilioprogramado` datetime, `enviado` bit default ((0)), `ncf` varchar(19), `numerocuenta` varchar(100), `codigo_unico_af` varchar(30), `estatushub` int(10), `idfoliohub` numeric(8), `EnviadoRW` bit default ((0)), `usuarioapertura` varchar(15) NOT NULL default (''), `titulartarjetamonedero` varchar(100), `saldoanteriormonedero` money(19,4), `autorizacionfolio` varchar(50), `fechalimiteemision` datetime, `totalimpuestod1` money(19,4) NOT NULL default ((0)), `totalimpuestod2` money(19,4) NOT NULL default ((0)), `totalimpuestod3` money(19,4) NOT NULL default ((0)), `idmotivocancela` varchar(200), `sistema_envio` int(10) NOT NULL default ((1)), `idformadepagoDescuento` varchar(5) NOT NULL default (''), `titulartarjetamonederodescuento` varchar(100) NOT NULL default (''), `foliotempcheques` bigint(19), `c_iddispositivo` int(10) NOT NULL default ((-1)), `salerestaurantid` varchar(-1) NOT NULL default (''), `timemarktoconfirmed` datetime default (NULL), `timemarktodelivery` datetime default (NULL), `timemarktodeliveryarrive` datetime default (NULL), `esalestatus` int(10) NOT NULL default ('-1'), `statusSR` int(10) NOT NULL default ('-1'), `paymentreference` varchar(50) NOT NULL default (''), `deliverycharge` decimal(6,5) default (NULL), `comandaimpresa` bit default ((0)), `surveycode` varchar(18) NOT NULL default (''), `foodorder` int(10) NOT NULL default ((-1)), `cashpaymentwith` money(19,4) NOT NULL default ((-1)), `intentoEnvioAF` int(10) NOT NULL default ((0)), `paymentmethod_id` int(10) NOT NULL default ((-1)), `TKC_Token` varchar(50) NOT NULL default (''), `TKC_Transaction` varchar(100) NOT NULL default (''), `TKC_Authorization` varchar(100) NOT NULL default (''), `TKC_Cupon` varchar(100) NOT NULL default (''), `TKC_ExpirationDate` varchar(100) NOT NULL default (''), `TKC_Recompensa` money(19,4) NOT NULL default ((0))

**`chequesf`** [BASE TABLE]

`folio` bigint(19) NOT NULL, `seriefolio` varchar(15), `numcheque` bigint(19), `fecha` datetime, `salidarepartidor` datetime, `arriborepartidor` datetime, `cierre` datetime, `mesa` varchar(15), `nopersonas` int(10), `idmesero` varchar(4), `pagado` bit, `cancelado` bit, `impreso` bit, `impresiones` int(10), `cambio` money(19,4), `descuento` money(19,4), `reabiertas` int(10), `razoncancelado` varchar(100), `orden` bigint(19), `facturado` bit, `idcliente` varchar(15), `idarearestaurant` varchar(5), `claveempresav` varchar(5), `tipodeservicio` int(10), `idturno` bigint(19), `usuariocancelo` varchar(15), `comentariodescuento` varchar(60), `estacion` varchar(40), `cambiorepartidor` money(19,4), `usuariodescuento` varchar(15), `fechacancelado` datetime, `idtipodescuento` varchar(5), `numerotarjeta` varchar(30), `folionotadeconsumo` bigint(19), `notadeconsumo` bit, `propinapagada` bit, `propinafoliomovtocaja` bigint(19), `puntosmonederogenerados` money(19,4), `propinaincluida` money(19,4), `tarjetadescuento` varchar(30), `porcentajefac` numeric(11,6), `propinamanual` bit, `usuariopago` varchar(15), `idclientefacturacion` varchar(15), `cuentaenuso` bit, `observaciones` varchar(250), `idclientedomicilio` varchar(15), `iddireccion` varchar(15), `telefonousadodomicilio` varchar(15), `totalarticulos` numeric(11,2), `subtotal` money(19,4), `subtotalsinimpuestos` money(19,4), `total` money(19,4), `totalconpropina` money(19,4), `totalimpuesto1` money(19,4), `cargo` money(19,4), `totalconcargo` money(19,4), `totalconpropinacargo` money(19,4), `descuentoimporte` money(19,4), `efectivo` money(19,4), `tarjeta` money(19,4), `vales` money(19,4), `otros` money(19,4), `propina` money(19,4), `propinatarjeta` money(19,4), `campoadicional1` varchar(30), `idreservacion` varchar(15), `idcomisionista` varchar(5), `importecomision` money(19,4), `comisionpagada` bit, `fechapagocomision` datetime, `foliopagocomision` numeric(8), `tipoventarapida` numeric(1), `callcenter` bit default ((0)), `idordencompra` bigint(19) default (NULL), `idempresa` varchar(15), `totalsindescuento` money(19,4), `totalalimentos` money(19,4), `totalbebidas` money(19,4), `totalotros` money(19,4), `totaldescuentos` money(19,4), `totaldescuentoalimentos` money(19,4), `totaldescuentobebidas` money(19,4), `totaldescuentootros` money(19,4), `totalcortesias` money(19,4), `totalcortesiaalimentos` money(19,4), `totalcortesiabebidas` money(19,4), `totalcortesiaotros` money(19,4), `totaldescuentoycortesia` money(19,4), `totalalimentossindescuentos` money(19,4), `totalbebidassindescuentos` money(19,4), `totalotrossindescuentos` money(19,4), `descuentocriterio` numeric(1), `descuentomonedero` money(19,4), `idmenucomedor` varchar(15), `subtotalcondescuento` money(19,4), `comisionpax` money(19,4), `procesadointerfaz` bit, `domicilioprogramado` bit, `fechadomicilioprogramado` datetime, `numerocuenta` varchar(100), `codigo_unico_af` varchar(30), `modificado` numeric(1) default ((0)), `EnviadoRW` bit default ((0)), `usuarioapertura` varchar(15) NOT NULL default (''), `autorizacionfolio` varchar(50), `fechalimiteemision` datetime, `totalimpuestod1` money(19,4) NOT NULL default ((0)), `totalimpuestod2` money(19,4) NOT NULL default ((0)), `totalimpuestod3` money(19,4) NOT NULL default ((0)), `idmotivocancela` varchar(200), `titulartarjetamonedero` varchar(100) NOT NULL default (''), `saldoanteriormonedero` money(19,4) NOT NULL default ((0)), `ncf` varchar(19) default (''), `idformadepagoDescuento` varchar(5) default (''), `titulartarjetamonederodescuento` varchar(100) NOT NULL default (''), `surveycode` varchar(18) NOT NULL default (''), `TKC_Authorization` varchar(100) NOT NULL default (''), `TKC_Cupon` varchar(100) NOT NULL default (''), `TKC_ExpirationDate` varchar(100) NOT NULL default (''), `TKC_Recompensa` money(19,4) NOT NULL default ((0))

**`clientes`** [BASE TABLE]

`idcliente` varchar(15) NOT NULL, `nombre` varchar(250), `direccion` varchar(160), `codigopostal` varchar(15), `poblacion` varchar(60), `estado` varchar(25), `pais` varchar(25), `email` varchar(250), `rfc` varchar(15), `curp` varchar(20), `cumpleaños` datetime, `limitedecredito` money(19,4), `limitecreditodiario` money(19,4), `descuento` numeric(5,2), `notas` varchar(254), `foliofiscal` varchar(15), `idtipodescuento` varchar(5), `tipofacturacion` int(10), `procesadoweb` bit, `nocobrarimpuestos` bit, `contacto` varchar(250), `tarjetamonedero` varchar(20), `telefono1` varchar(15), `telefono2` varchar(15), `telefono3` varchar(15), `telefono4` varchar(15), `telefono5` varchar(15), `femextipocliente` numeric(1) default ((0)), `giro` varchar(60), `tipocredito` numeric(1) default ((1)), `idtipocliente` varchar(5), `idtipomenu` varchar(5), `fotografia` image(2147483647), `fechaalta` datetime, `retenerimpuesto` bit default ((0)), `tipocuenta` numeric(1) default ((1)), `tipoclientencf` numeric(1), `dinerid` varchar(50) default (NULL), `descuentoprimeraventacomedoremp` numeric(5,2) default ((0.00)), `idpais_SAT` varchar(50) NOT NULL default (''), `contemplarpropina` bit NOT NULL default ((1))

**`cortesiasmonedero`** [BASE TABLE]

`idcortesia` varchar(5) NOT NULL, `descripcion` varchar(40), `status` numeric(1), `diasvigencia` numeric(3)

**`foliosfacturas`** [BASE TABLE]

`serie` varchar(15), `ultimofolio` numeric(10), `electronico` bit default ((0)), `consecutivoinicio` numeric(10) default ((0)), `consecutivofin` numeric(10) default ((0)), `anioaprobacion` numeric(4) default ((0)), `numaprobacion` varchar(30), `estatus` bit default ((0)), `cbb` image(2147483647), `tipoesquema` numeric(1) default ((1)), `idempresa` varchar(15), `fechaaprobacion` varchar(10), `ultimofoliocentral` varchar(250), `ID` int(10) NOT NULL, `Des_GT_folioguatemala` bit NOT NULL default ((0)), `Des_GT_fechaaprobacion` datetime NOT NULL default (getdate()), `Des_GT_fechaingreso` datetime NOT NULL default (getdate()), `Des_GT_fechavigencia` datetime NOT NULL default (getdate()), `Des_GT_avisovencimiento` numeric(5,2) default ((0.00)), `complementopago` bit NOT NULL default ((0))

**`mesas`** [BASE TABLE]

`idmesa` varchar(15) NOT NULL, `idarearestaurant` varchar(5), `personas` numeric(3), `fumar` numeric(1), `estatus_ocupacion` smallint(5), `idtipomesa` varchar(15), `idempresa` varchar(15), `idmesasistema` bigint(19) NOT NULL

**`meseros`** [BASE TABLE]

`idmeserointerno` bigint(19) NOT NULL, `idmesero` varchar(4) NOT NULL, `nombre` varchar(60), `contraseña` varchar(30), `tipo` int(10), `fotografia` image(2147483647), `visible` numeric(1) default ((1)), `idempresa` varchar(15), `tipoacceso` bit default ((0)), `capturarestringidamesas` bit, `perfil` varchar(15), `monitormeserocolorfondo` numeric(10), `monitormeserocolorletra` numeric(10), `accesoindicadormesas` bit NOT NULL default ((0))

**`promociones`** [BASE TABLE]

`idpromocion` varchar(5) NOT NULL, `descripcion` varchar(30), `status` numeric(1), `tipopromocion` numeric(1), `lunesinicio` varchar(11), `lunesfin` varchar(11), `aplicalunes` bit, `lunesdiasalida` numeric(1), `martesinicio` varchar(11), `martesfin` varchar(11), `aplicamartes` bit, `martesdiasalida` numeric(1), `miercolesinicio` varchar(11), `miercolesfin` varchar(11), `aplicamiercoles` bit, `miercolesdiasalida` numeric(1), `juevesinicio` varchar(11), `juevesfin` varchar(11), `aplicajueves` bit, `juevesdiasalida` numeric(1), `viernesinicio` varchar(11), `viernesfin` varchar(11), `aplicaviernes` bit, `viernesdiasalida` numeric(1), `sabadoinicio` varchar(11), `sabadofin` varchar(11), `aplicasabado` bit, `domingoinicio` varchar(11), `sabadodiasalida` numeric(1), `domingofin` varchar(11), `aplicadomingo` bit, `domingodiasalida` numeric(1), `fotografia` image(2147483647), `visualizar` bit, `Relacionuno` numeric(3), `Relaciondos` numeric(3), `forzarporproducto` bit default ((0)), `aplicamodificadores` bit NOT NULL default ((1))

**`tipoclientes`** [BASE TABLE]

`idtipocliente` varchar(5), `descripcion` varchar(40)

**`tipodescuento`** [BASE TABLE]

`idtipodescuento` varchar(5) NOT NULL, `desc_tipodescuento` varchar(30), `descuento` numeric(6,2), `Visible` bit

### Inventarios

**`acumuladoinsumos`** — Existencias por insumo por almacen _(Resumen)_ [BASE TABLE]

`id` int(10) NOT NULL, `idinsumo` varchar(15) NOT NULL, `idalmacen` varchar(5) NOT NULL, `existencia` numeric(14,4) NOT NULL default ((0))

**`almacen`** _(Catalogo)_ [BASE TABLE]

`idalmacen` varchar(5) NOT NULL, `nombre` varchar(30), `ultimofolio` numeric(10), `idempresa` varchar(15), `tipo` numeric(1)

**`areas`** [BASE TABLE]

`idarea` varchar(4) NOT NULL, `nombre` varchar(30)

**`areasdetalle`** [BASE TABLE]

`idarea` varchar(4) NOT NULL, `idempresa` varchar(15), `descargar` bit default ((0))

**`conceptos`** [BASE TABLE]

`idconcepto` varchar(5) NOT NULL, `descripcion` varchar(40), `tipo` numeric(1), `autorizacion` bit, `visible` bit

**`foliosalmacen`** [BASE TABLE]

`folio` bigint(19) NOT NULL, `idalmacen` varchar(5), `folioalmacen` numeric(10), `foliomovto` numeric(10), `fecha` datetime, `cancelado` bit, `usuariocancelo` varchar(15), `usuario` varchar(15), `nota` varchar(150), `idempresa` varchar(15), `enviadoacentral` bit, `editadosucursal` bit, `foliocentral` bigint(19)

**`invfisico`** [BASE TABLE]

`folio` numeric(10) NOT NULL, `fecha` datetime, `idalmacen1` varchar(5), `idalmacen2` varchar(5), `inventarioteorico1` money(19,4), `inventariofisico1` money(19,4), `diferenciafisico1` money(19,4), `inventarioteorico2` money(19,4), `inventariofisico2` money(19,4), `diferenciafisico2` money(19,4), `cancelado` bit default ((0)), `usuariocancelo` varchar(15), `idempresa` varchar(15), `idinventario` numeric(8) default ((0)), `enviadoacentral` bit, `editadosucursal` bit, `foliocentral` numeric(10)

**`invfisicomovtos`** [BASE TABLE]

`folio` numeric(10), `idinsumo` varchar(15), `idpresentacion` varchar(15), `costo` money(19,4), `existenciaalmacen1` numeric(12,2), `fisicoalmacen1` numeric(12,2), `diferenciaalmacen1` numeric(12,2), `existenciaalmacen2` numeric(12,2), `fisicoalmacen2` numeric(12,2), `diferenciaalmacen2` numeric(12,2)

**`movsinv`** — auxiliar de inventarios [BASE TABLE] — vista vwf

`fecha` datetime, `foliocheque` numeric(8), `movto` numeric(8), `idcompra` numeric(10), `traspaso` numeric(8), `invfisico` numeric(8), `idconcepto` varchar(5), `idinsumo` varchar(15), `costo` money(19,4), `cantidad` numeric(14,4), `idalmacen` varchar(5), `idturno` numeric(6), `presentaciondestino` varchar(15), `idpedido` numeric(8,2) default ((0)), `enviadoacentral` bit

**`movsinvcancelados`** [BASE TABLE] — vista vwf

`fecha` datetime, `foliocheque` numeric(8), `movto` numeric(8), `idcompra` numeric(10), `traspaso` numeric(8), `invfisico` numeric(8), `idconcepto` varchar(5), `idinsumo` varchar(15), `costo` money(19,4), `cantidad` numeric(14,4), `idalmacen` varchar(5), `idturno` numeric(6), `presentaciondestino` varchar(15), `idpedido` bigint(19), `enviadoacentral` bit

**`movtosalmacen`** [BASE TABLE] — vista vwf

`fecha` datetime, `movto` numeric(8), `idcompra` numeric(10), `traspaso` numeric(8), `invfisico` numeric(8), `idconcepto` varchar(5), `idinsumospresentaciones` varchar(15), `costo` money(19,4), `cantidad` numeric(14,4), `idalmacen` varchar(5), `idpedido` numeric(10), `enviadoacentral` bit

**`movtosalmacencancelados`** [BASE TABLE] — vista vwf

`fecha` datetime, `movto` numeric(8), `idcompra` numeric(10), `traspaso` numeric(8), `invfisico` numeric(8), `idconcepto` varchar(5), `idinsumospresentaciones` varchar(15), `costo` money(19,4), `cantidad` numeric(14,4), `idalmacen` varchar(5), `idpedido` numeric(10), `enviadoacentral` bit

**`traspasosalmacen`** [BASE TABLE]

`folio` numeric(10) NOT NULL, `fecha` datetime, `almacenorigen` varchar(5), `almacendestino` varchar(5), `cancelado` bit, `usuario` varchar(15), `usuariocancelo` varchar(15), `nota` varchar(150), `idempresa` varchar(15), `idempresaorigen` varchar(15), `idempresadestino` varchar(15), `enviadoacentral` bit, `editadosucursal` bit, `foliocentral` numeric(10) default (NULL)

### Productos

**`explosionproductos`** [BASE TABLE]

`id` int(10) NOT NULL, `folio` int(10) NOT NULL, `fecha` datetime NOT NULL, `usuario` varchar(15) NOT NULL, `descripcion` varchar(100) NOT NULL default (''), `estatus` tinyint(3) NOT NULL default ((1)), `explosionparaordencompra` bit NOT NULL default ('0')

**`explosionproductosdetalle`** [BASE TABLE]

`id` int(10) NOT NULL, `idproducto` varchar(15) NOT NULL, `cantidad` numeric(14,4) NOT NULL, `id_epd` int(10) NOT NULL

**`grupos`** [BASE TABLE]

`idgrupo` varchar(5) NOT NULL, `descripcion` varchar(30), `clasificacion` numeric(1), `prioridad` numeric(4), `color` numeric(10), `colorletra` numeric(10), `prioridadimpresion` numeric(4), `cambiacolorcuenta` bit, `colorcuenta` numeric(10), `colorletracuenta` numeric(10), `solicitaautorizacion` bit, `imagenmenuelectronico` image(2147483647) default (NULL), `extmenu` varchar(5), `porcentajepropina` numeric(5,2) default ((0.0)), `imagen_menu` varchar(-1), `id_etiqueta` varchar(50) NOT NULL default ('')

**`gruposmodificadores`** [BASE TABLE]

`idgruposmodificadores` varchar(5) NOT NULL, `descripcion` varchar(30), `id_etiqueta` varchar(50) NOT NULL default ('')

**`grupossubgrupos`** [BASE TABLE]

`idgrupo` varchar(5), `idsubgrupo` varchar(4)

**`listadeprecios`** [BASE TABLE]

`idlistaprecio` int(10) NOT NULL, `descripcion` varchar(50), `clavemoneda` varchar(5), `estatus` bit NOT NULL, `listadefault` bit NOT NULL

**`modificadores`** [BASE TABLE]

`idproducto` varchar(15), `idmodificador` varchar(15), `precio` money(19,4), `idgruposmodificadores` varchar(5), `idempresa` varchar(15)

**`paquetes`** [BASE TABLE]

`idproducto` varchar(15), `cantidad` numeric(12,4), `idproductopaquete` varchar(15), `idempresa` varchar(15)

**`productos`** [BASE TABLE]

`idproducto` varchar(15) NOT NULL, `descripcion` varchar(60), `idgrupo` varchar(5), `nombrecorto` varchar(20), `plu` varchar(15), `imagen` image(2147483647), `nofacturable` bit, `comentario` varchar(254), `usarcomedor` bit default ((1)), `usardomicilio` bit default ((1)), `usarrapido` bit default ((1)), `usarcedis` bit default ((0)), `idinsumospresentaciones` varchar(15), `imagenmenuelectronico` image(2147483647) default (NULL), `descripcionmenuelectronico` varchar(255), `usarmenuelectronico` bit default ((0)), `extmenu` varchar(5), `imagen_menu` varchar(-1), `descripcion_detalle` varchar(300) NOT NULL default (''), `calorias` decimal(18) NOT NULL default ((0)), `visible_menu` bit NOT NULL default ((1)), `capturar_pendientes` bit NOT NULL default ((0)), `id_etiqueta` varchar(50) NOT NULL default (''), `id_etiqueta_descripcion` varchar(50) NOT NULL default (''), `idprodserv_SAT` varchar(50) NOT NULL default (''), `usarVectorPlus` bit NOT NULL default ((0))

**`productosdetalle`** [BASE TABLE]

`idproducto` varchar(15), `idempresa` varchar(15), `precio` money(19,4), `impuesto1` numeric(5,2), `impuesto2` numeric(5,2), `impuesto3` numeric(5,2), `preciosinimpuestos` money(19,4), `bloqueado` bit, `precioabierto` numeric(1), `canjeablepuntos` bit, `preciopuntos` money(19,4), `puntoscanje` money(19,4), `puntosextras` money(19,4), `lunesinicio` varchar(11), `lunesfin` varchar(11), `preciolunes` money(19,4), `lunesdiasalida` numeric(1), `martesinicio` varchar(11), `martesfin` varchar(11), `preciomartes` money(19,4), `martesdiasalida` numeric(1), `miercolesinicio` varchar(11), `miercolesfin` varchar(11), `preciomiercoles` money(19,4), `miercolesdiasalida` numeric(1), `juevesinicio` varchar(11), `juevesfin` varchar(11), `preciojueves` money(19,4), `juevesdiasalida` numeric(1), `viernesinicio` varchar(11), `viernesfin` varchar(11), `precioviernes` money(19,4), `viernesdiasalida` numeric(1), `sabadoinicio` varchar(11), `sabadofin` varchar(11), `preciosabado` money(19,4), `sabadodiasalida` numeric(1), `domingoinicio` varchar(11), `domingofin` varchar(11), `preciodomingo` money(19,4), `domingodiasalida` numeric(1), `aplicalunes` bit, `aplicamartes` bit, `aplicamiercoles` bit, `aplicajueves` bit, `aplicaviernes` bit, `aplicasabado` bit, `aplicadomingo` bit, `excentoimpuestos` bit, `secuenciacompuesto` bit, `finalizarsecuenciacompuesto` bit, `heredarmonitormodificadores` bit, `comisionvendedor` numeric(6,2), `eliminarfiscal` bit, `enviarproduccionsimodificador` bit, `cargoadicional` numeric(5), `afectacomensales` bit, `comensalesafectados` numeric(2), `descargar` bit default ((0)), `usarmultiplicadorprodcomp` bit default ((0)), `rentabilidadcedis` numeric(6,2) default ((0)), `idarea` varchar(4) default ((0)), `permitirprodcompenmodif` bit default ((1)), `politicapuntos` numeric(1) default ((1)), `favorito` bit default ((0)), `idunidad` varchar(50), `ocultarmitades` bit NOT NULL default ((0)), `dev_impuestoimporte3` bit NOT NULL default ((0)), `impuestoimporte3` money(19,4) NOT NULL default ((0))

**`subgrupos`** [BASE TABLE]

`idsubgrupo` varchar(4) NOT NULL, `descripcion` varchar(40), `imagenmenuelectronico` image(2147483647) default (NULL), `id_etiqueta` varchar(50) NOT NULL default ('')

**`subgruposproductos`** — Liga producto --> subgrupo [BASE TABLE]

`idsubgrupo` varchar(4), `idproducto` varchar(15)

### Insumos

**`explosioninsumosdetalle`** [BASE TABLE]

`id` int(10) NOT NULL, `idexplosion` int(10) NOT NULL, `idproducto` varchar(15) NOT NULL, `idinsumo` varchar(15) NOT NULL, `cantidad` numeric(14,4) NOT NULL, `costo` money(19,4) NOT NULL, `costopromedio` money(19,4) NOT NULL, `unidad` varchar(10) NOT NULL, `rendimientoelaborado` numeric(10,4), `elaborado` bit NOT NULL, `impuesto1` numeric(5,2), `impuesto2` numeric(5,2), `impuesto3` numeric(5,2), `idelaborado` varchar(15) NOT NULL, `nivel` tinyint(3) NOT NULL, `ordengenerada` bit NOT NULL default ((0))

**`gruposi`** [BASE TABLE]

`idgruposi` varchar(5) NOT NULL, `descripcion` varchar(30), `idgruposiclasificacion` varchar(5), `idcuentacontable` varchar(5), `idtipopedido` varchar(5)

**`gruposiclasificacion`** [BASE TABLE]

`idgruposiclasificacion` varchar(5) NOT NULL, `descripcion` varchar(20), `clasificacionventa` numeric(1)

**`insumos`** — Maestro de insumos [BASE TABLE]

`idinsumo` varchar(15) NOT NULL, `descripcion` varchar(60), `idgruposi` varchar(5), `unidad` varchar(10), `elaborado` bit, `rendimientoelaborado` numeric(10,4)

**`insumosdetalle`** — Existencias y costo actual [BASE TABLE]

`idinsumo` varchar(15) NOT NULL, `idempresa` varchar(15), `inventariable` numeric(1), `costo` money(19,4), `costopromedio` money(19,4), `impuesto1` numeric(5,2), `impuesto2` numeric(5,2), `impuesto3` numeric(5,2), `costoconimpuestos` money(19,4), `merma` numeric(5,2), `descargar` bit, `usarbasculainv` bit default ((0)), `alertaexistencias` bit NOT NULL default ((0)), `estatus` int(10) default ((1)), `costoestandar` money(19,4)

**`insumospresentaciones`** [BASE TABLE]

`idinsumospresentaciones` varchar(15) NOT NULL, `descripcion` varchar(60), `idinsumo` varchar(15), `idgruposi` varchar(5), `rendimiento` numeric(12,4), `unidad` varchar(50)

**`insumospresentacionesdetalle`** [BASE TABLE]

`idinsumospresentaciones` varchar(15) NOT NULL, `idempresa` varchar(15), `costo` money(19,4) default ((0)), `costopromedio` money(19,4) default ((0)), `idproveedor` varchar(15), `impuesto1` numeric(5,2) default ((0)), `impuesto2` numeric(5,2) default ((0)), `impuesto3` numeric(5,2) default ((0)), `indicadorimpuesto` varchar(2), `stockminimogeneral` numeric(12,4), `stockmaximogeneral` numeric(12,4), `estatus` numeric(1), `descargar` bit, `ubicacion` varchar(150), `usarbasculainv` bit default ((0)), `costoestandar` money(19,4)

### Caja

**`chequespagos`** [BASE TABLE] — vista vwf

`folio` bigint(19) NOT NULL, `idformadepago` varchar(5), `importe` money(19,4), `propina` money(19,4), `tipodecambio` money(19,4), `referencia` varchar(80), `idturno_cierre` bigint(19), `procesado` bit

**`formasdepago`** [BASE TABLE]

`idformadepago` varchar(5) NOT NULL, `descripcion` varchar(30), `tipo` numeric(1), `tipodecambio` money(19,4), `solicitareferencia` bit, `prioridadboton` numeric(2), `cuentacontableimporte` varchar(5), `cuentacontablecomision` varchar(5), `cuentacontableivacomision` varchar(5), `comision` numeric(5,2), `visible` bit, `aceptapropina` bit, `subtipo` numeric(1), `prefijo1` varchar(3), `prefijo2` varchar(3), `codigodeprefijoconsulta` varchar(10), `codigodeprefijoacumred` varchar(10), `generapuntos` bit, `formatoimpresion` numeric(2), `idfpagofiscal` numeric(10), `pagoenlinea` numeric(1), `tipotarjeta` numeric(1), `imagen` image(2147483647), `nofacturable` bit, `comisionreporte1` numeric(5,2), `comisionreporte2` numeric(5,2), `tipoTarjetaBancaria` tinyint(3) NOT NULL default ((1)), `idtipodescuento` varchar(5) NOT NULL default (''), `idformapago_SAT` varchar(50) NOT NULL default ('')

**`grupoformasdepago`** [BASE TABLE]

`idgrupoformadepago` varchar(5) NOT NULL, `descripcion` varchar(30)

**`movtoscaja`** [BASE TABLE]

`folio` numeric(8) NOT NULL, `foliomovto` numeric(8) default ((0)), `tipo` numeric(1), `idturno` numeric(6), `concepto` varchar(60), `referencia` varchar(60), `importe` money(19,4), `fecha` datetime, `cancelado` bit, `usuariocancelo` varchar(15), `pagodepropina` bit, `idempresa` varchar(15), `usuarioautoriza` varchar(15) NOT NULL default ('')

### Compras

**`compras`** [BASE TABLE]

`idcompra` bigint(19) NOT NULL, `idempresa` varchar(15), `folio` varchar(15), `fechaaplicacion` datetime, `idproveedor` varchar(15), `foliofactura` varchar(15), `fechafactura` datetime, `cancelado` bit, `fechavencimiento` datetime, `usuariocancelo` varchar(15), `usuario` varchar(15), `referencia` varchar(50), `descuento` numeric(5,2), `subtotal` money(19,4), `impuesto1` money(19,4), `impuesto2` money(19,4), `impuesto3` money(19,4), `total` money(19,4), `fiscal` bit, `reterenta` numeric(5,2) default (NULL), `reteiva` numeric(5,2) default (NULL), `reteica` numeric(5,2) default (NULL), `enviadoacentral` bit, `editadosucursal` bit, `idcompracentral` bigint(19), `polizagenerada` bit NOT NULL default ((0))

**`comprasmovtos`** [BASE TABLE] — vista vwf

`idcompra` bigint(19), `idinsumo` varchar(15), `costo` money(19,4), `descuento` numeric(5,2), `impuesto1` numeric(5,2), `impuesto1importe` money(19,4), `impuesto2` numeric(5,2), `impuesto2importe` money(19,4), `impuesto3` numeric(5,2), `impuesto3importe` money(19,4), `importesinimpuestos` money(19,4), `importeconimpuestos` money(19,4), `idalmacen` varchar(5), `idordencompra` numeric(10), `cantidad` numeric(14,4) default ((0))

**`proveedores`** [BASE TABLE]

`idproveedor` varchar(15) NOT NULL, `nombre` varchar(50), `razonsocial` varchar(100), `direccion` varchar(150), `codigopostal` varchar(15), `telefono` varchar(20), `fax` varchar(20), `email` varchar(150), `rfc` varchar(15), `credito` numeric(3), `usarcostosasignados` bit, `usarenpoliza` bit, `idtipoproveedor` varchar(5), `idcuentacontable` varchar(5), `nombrebanco` varchar(100), `nocuenta` varchar(100), `cuentaclave` varchar(100), `estatus` numeric(1)

**`tipoproveedores`** [BASE TABLE]

`idtipoproveedor` varchar(5) NOT NULL, `descripcion` varchar(30)

### Gastos

**`gastos`** [BASE TABLE]

`idgasto` numeric(7) NOT NULL, `fecha` datetime, `idcuentacontable` varchar(5), `referencia` varchar(50), `descuento` numeric(5,2), `usuario` varchar(15), `cancelado` bit, `usuariocancelo` varchar(15), `idcompra` bigint(19), `Idtipogasto` varchar(5), `idempresa` varchar(15), `idsubtipogastos` varchar(5), `observaciones` varchar(60), `tipodemovimiento` varchar(30), `enviadoacentral` bit, `editadosucursal` bit, `foliofactura` varchar(20), `idgastocentral` numeric(7), `idproveedor` varchar(15), `folio` varchar(15), `EnviadoAF` bit NOT NULL default ((0)), `IntentoEnvioAF` int(10) NOT NULL default ((0))

**`gastosmovtos`** [BASE TABLE] — vista vwf

`idgasto` numeric(7), `cantidad` numeric(8,3), `descripcion` varchar(250), `costo` money(19,4), `descuento` numeric(5,2), `iva` numeric(5,2)

**`subtipogastos`** [BASE TABLE]

`idsubtipogastos` varchar(5) NOT NULL, `descripcion` varchar(30), `idtipogasto` varchar(5), `idtipogastos` varchar(5), `idproveedor` varchar(15)

**`tipogastos`** [BASE TABLE]

`Idtipogasto` varchar(5) NOT NULL, `descripcion` varchar(30)

### General

**`historialactualizaciones`**

_(sin columnas en el volcado — revisar `columns_info` a mano)_

**`monedas`** [BASE TABLE]

`clavemoneda` varchar(5) NOT NULL, `descripcion` varchar(25), `tipocambio` money(19,4)

**`tipoempresa`** [BASE TABLE]

`idtipoempresa` varchar(15) NOT NULL, `descripcion` varchar(60)

### Recetas

**`costos`** [BASE TABLE]

`idproducto` varchar(15), `idinsumo` varchar(15), `cantidad` numeric(12,4), `idempresa` varchar(15)

**`elaborados`** [BASE TABLE]

`idelaborado` varchar(15), `idinsumo` varchar(15), `cantidad` numeric(12,4)

**`recetasalmacenes`** [BASE TABLE]

`idproducto` varchar(15), `idarearestaurant` varchar(5), `idalmacen` varchar(5), `idempresa` varchar(15), `idinsumo` varchar(15)

### Fiscal

**`udsmedida`** [BASE TABLE]

`idunidad` varchar(50) NOT NULL, `idunidadmedida_SAT` varchar(50) NOT NULL default ('')

### Contabilidad

**`cuentascontables`** [BASE TABLE]

`idcuentacontable` varchar(5) NOT NULL, `descripcion` varchar(50), `tipo` numeric(1), `clavecontable` varchar(2), `clasifpoliza` numeric(1), `indicadorimpuesto` varchar(2), `cuenta` varchar(10), `subcuenta` varchar(10), `subsubcuenta` varchar(10), `auxiliar` varchar(10), `moneda` varchar(3), `tipodecambio` money(19,4), `polizatienenumdivision` bit, `polizatipocentro` numeric(1), `polizasolicitareferencia` bit, `usarenoperacion` numeric(2), `usaromnitrans` bit, `nombrectacontpaq` varchar(150) NOT NULL default ('')

### Marcación

**`registroasistencias`** [BASE TABLE]

`idmovto` varchar(15), `idempleado` varchar(15), `entrada` datetime, `salida` datetime, `tipo` smallint(5)

### Turnos

**`turnos`** [BASE TABLE]

`idturnointerno` bigint(19) NOT NULL, `idturno` bigint(19), `fondo` money(19,4), `apertura` datetime, `cierre` datetime, `idestacion` varchar(40), `cajero` varchar(15), `efectivo` money(19,4), `tarjeta` money(19,4), `vales` money(19,4), `credito` money(19,4), `procesadoweb` bit, `idempresa` varchar(15), `enviadoacentral` bit, `fechaenviado` datetime default (NULL), `usuarioenvio` varchar(30), `offline` bit default (NULL), `enviadoaf` bit NOT NULL default ((0)), `corte_enviado` bit NOT NULL default ((0)), `eliminartemporalesencierre` bit NOT NULL default ((0))

## Tablas relevantes sin columnas en el volcado

`bitacoraenvioventas`, `historialactualizaciones`

## Tablas no usadas por Factor BI (sync = No), por módulo

<details><summary>204 tablas — expandir solo si se necesita algo fuera del set anterior</summary>

**Ventas:** `cheqdetf`, `cheqdetfeliminados`, `cheqpedidos`, `mapa_mesas`, `mesasasignadas`, `mesasbillar`, `monedasmesero`, `pedidos`, `pedidosdetalle`, `promocionesdescargar`, `promocionesmenuelectronico`, `promoproductos`, `tipopedido`

**Inventarios:** `inventariopendiente`

**Productos:** `logcambioprecios`, `productosenproduccion`, `productosindicadorimpuesto`, `productosmonedero`, `productosmonitores`, `productosTokencash`

**Insumos:** `insumoscostoproveedor`, `stockinsumos`

**Caja:** `bancos`, `chequespagosf`, `perfilesformasdepago`, `tipoformaspagos`

**Compras:** `ordenescompra`, `ordenescompramov`, `proveedorespredet`

**General:** `colonias`, `estados`, `paises`

**Fiscal:** `cfdirelacionados`, `Clasificacion`, `codigosdeserviciocfdi`, `Country`, `Currency`, `FactorType`, `ncomprobantesfiscales`, `pacs`, `PaymentMethod`, `PaymentType`, `Product`, `ProofType`, `ProofUse`, `RelationshipType`, `Tax`, `TaxRate`, `TaxRegime`, `UnitOfMeasure`

**Contabilidad:** `cuentascontablesdetalle`, `deptosventa`

**Turnos:** `turnosf`

**(sin módulo):** `actualizaciones`, `actualizacionsucursales`, `alertasantifraude`, `azbar_log`, `bitacoraarchivopoliza`, `bitacoracedixvirtual`, `bitacoracierresinventario`, `bitacorafiscal`, `bitacorasistema`, `bitacoratarjetacredito`, `bitacoratransacciones`, `botonescomandero`, `carrierproducts`, `carriers`, `clientestitularsecundario`, `comandas`, `comandosimpresion`, `comentarios`, `comisionistas`, `companias`, `configuracion`, `configuracion_kds`, `configuracion_ws`, `configuracionarchivoexportacion`, `consumodiarioinsumos`, `cortesiasmonederodetalle`, `cortesiasmonederotarjetas`, `cuentas`, `cuentas_procesar`, `cuentaspagos`, `declaracioncorte`, `denominaciones`, `deptosventagrupos`, `deptosventagruposinsumos`, `destinatarioantifraude`, `destinatariocorte`, `destinatarioscorreo`, `detallescuentas`, `direccionesdomicilio`, `empresa_proveedor`, `empresas`, `empresas_regalias_config`, `empresasvi`, `empresasvp`, `encuestas`, `estaciones`, `estacionesalmacen`, `estacionesareas`, `etiquetaslenguaje`, `facturas`, `facturas_rep`, `facturas_rep_doctos`, `facturas_rep_pagos`, `facturascfdipendientesregistrar`, `facturascomplementoine`, `facturasentidadesine`, `facturasmovtos`, `folios`, `foliosfacturados`, `formasdepagodetalle`, `formatofacturas`, `formatos`, `formatosdetalle`, `formatosvarios`, `grupoformasdepagodet`, `gruposdeproductosvisibles`, `gruposmodificadoresproductos`, `HORARIOCORTE`, `horariosturnos`, `hotelmovtos`, `huellaclientes`, `huellameseros`, `huellausuarios`, `idiomas`, `idiomas_etiquetas`, `idiomas_menu`, `idiomasticket`, `imagenbotones`, `impfiscalnotacreditolog`, `imprimefiscalpendientes`, `impuestos`, `juegos_preciosporhora`, `lectores`, `listadepreciosdetalle`, `log_registro_dispositivos`, `menu`, `menucomedor`, `menucomedorproductos`, `menuproductos`, `monederorangos`, `monitoresproduccion`, `monitorprodestaciones`, `motivoscancelacion`, `movtosbillar`, `movtosbillar_pausas`, `movtospatines`, `notificaciones`, `notificaciones_antifraudes`, `notificacionesns`, `numerostarjetas`, `objetos_mapa`, `omnitrans_cat_mensajes`, `omnitrans_cat_movtos`, `omnitrans_configuracion`, `patines`, `perfilesdescuentos`, `plazasempresa`, `puntos`, `puntosgruposdeproductos`, `rangohoras`, `regionempresa`, `regiones`, `registro_dispositivos`, `registro_enlacesrm`, `registro_licencias`, `renta`, `reservaciones`, `saldosclientes`, `serviciominutospatin`, `serviciosns`, `sincronizacion`, `sincronizacion_bitacora`, `sucursalescallcenter`, `tablaaux`, `tipocomisionistas`, `tipomenuclientes`, `tiporeservaciones`, `tiposervicio`, `ubicacionesempresa`, `udsmedidaequivale`, `usuarios`, `usuariosdescargar`, `usuariosperfiles`, `usuariosperfilescatalogo`, `validahuellamonedero`, `ws_cloud`, `zonasdomicilio`, `zonasdomiciliodescargar`, `zonasdomiciliosucursales`, `zonasempresa`

**Interface:** `config_microsiga`, `microsiga_centros_costos`, `microsiga_registro_errores`

**Cuentas por Cobrar:** `cuentasporcobrar`, `cuentasporcobrarpagos`

**Cuentas por Pagar:** `pagosproveedores`

**Configuración:** `parametros`, `parametros2`, `parametros3`

**Mesas:** `tiposdemesa`, `tiposdemesadetalles`

</details>

## Datos crudos completos

El volcado íntegro de `columns_info` (337 tablas/vistas, 4,946 columnas — incluye las 204 tablas `No` y objetos fuera del catálogo curado) vive en `data/soft-restaurant-columns-info.json` junto a este documento, por si hace falta una tabla fuera de las 69 relevantes.
