# 🧪 Arrokó Experience - Test Suite

Suite histórica de pruebas E2E (End-to-End) en proceso de migración hacia la experiencia Arrokó usando **Playwright**.

## 📋 Tabla de Contenido

- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecutar Tests](#ejecutar-tests)
- [Estructura de Tests](#estructura-de-tests)
- [Coverage](#coverage)

---

## ✅ Requisitos

- Node.js 18+
- npm o yarn
- Supabase configurado y funcionando
- Variables de entorno configuradas en `.env.local`

---

## 📦 Instalación

Las dependencias ya están instaladas si ejecutaste `npm install` en el proyecto raíz.

Si necesitas instalar solo Playwright:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

---

## ⚙️ Configuración

### Variables de Entorno Requeridas

Asegúrate de tener estas variables en `.env.local`:

```env
# Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key

# Service Role Key (para tests)
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Gemini (opcional para tests)
GEMINI_API_KEY=tu-clave-solo-en-servidor

# App URL (opcional)
VITE_APP_URL=http://localhost:5173
```

### Archivo de Configuración

El archivo `playwright.config.ts` en la raíz del proyecto contiene toda la configuración:

- **Base URL:** `http://localhost:5173` (ajustable)
- **Navegadores:** Chromium (puedes agregar Firefox y WebKit)
- **Reporters:** HTML, List, JSON
- **Timeout:** 10s por acción
- **Screenshots:** Solo en fallos
- **Videos:** Solo en fallos
- **Web Server:** Inicia automáticamente `npm run dev`

---

## 🚀 Ejecutar Tests

### Comandos Disponibles

```bash
# Ejecutar todos los tests (headless)
npm test

# Ejecutar con interfaz UI interactiva
npm run test:ui

# Ejecutar con navegador visible (headed mode)
npm run test:headed

# Ejecutar en modo debug (paso a paso)
npm run test:debug

# Ver reporte de última ejecución
npm run test:report

# Ejecutar un test específico
npx playwright test tests/01-registration.spec.ts

# Ejecutar tests con etiqueta específica
npx playwright test --grep @smoke
```

### Opciones Útiles

```bash
# Solo en un navegador específico
npx playwright test --project=chromium

# Con máximo de workers
npx playwright test --workers=1

# Con repeticiones (para tests flaky)
npx playwright test --retries=2

# Solo tests que fallaron
npx playwright test --last-failed
```

---

## 📂 Estructura de Tests

```
tests/
├── helpers/
│   └── supabase-helper.ts    # Utilidades de Supabase para tests
├── 01-registration.spec.ts   # Tests de registro y onboarding
├── 02-roulette.spec.ts       # Tests de la ruleta
├── 03-redemption.spec.ts     # Tests de canje de premios
├── 04-admin-dashboard.spec.ts # Tests del dashboard de admin
├── 05-whatsapp-dashboard.spec.ts # Tests del dashboard de WhatsApp
└── README.md                 # Esta documentación
```

### Descripción de Cada Suite

#### 1. **Registration Tests** (`01-registration.spec.ts`)
- ✅ Mostrar onboarding en primera visita
- ✅ Navegar de onboarding a registro
- ✅ Completar registro exitosamente
- ✅ Validar campos requeridos
- ✅ Validar formato de email
- ✅ Validar formato de teléfono

#### 2. **Roulette Tests** (`02-roulette.spec.ts`)
- ✅ Mostrar rueda de la ruleta
- ✅ Girar ruleta y mostrar resultado
- ✅ Mostrar detalles del premio
- ✅ Mostrar código QR después de ganar
- ✅ Botón de canje disponible
- ✅ Prevenir múltiples giros del mismo usuario

#### 3. **Redemption Tests** (`03-redemption.spec.ts`)
- ✅ Mostrar página de canje
- ✅ Validar entrada de código
- ✅ Error para código inválido
- ✅ Canje exitoso con código válido
- ✅ Prevenir canje doble del mismo código
- ✅ Scanner QR funcional
- ✅ Cancelar escaneo QR
- ✅ Navegación de regreso

#### 4. **Admin Dashboard Tests** (`04-admin-dashboard.spec.ts`)
- ✅ Redirigir a login sin autenticación
- ✅ Rechazar credenciales inválidas
- ✅ Login exitoso con credenciales válidas
- ✅ Mostrar métricas analíticas
- ✅ Mostrar tabla de participantes
- ✅ Orbe de Analytics AI visible
- ✅ Abrir modal de chat AI
- ✅ Función de logout

#### 5. **WhatsApp Dashboard Tests** (`05-whatsapp-dashboard.spec.ts`)
- ✅ Requerir autenticación
- ✅ Acceso después de login
- ✅ Mostrar lista de mensajes
- ✅ Filtros y búsqueda
- ✅ Detalles de mensajes
- ✅ Navegación entre dashboards
- ✅ Estado de conexión
- ✅ Estado vacío

---

## 🛠️ Helpers

### `supabase-helper.ts`

Utilidades para manipular datos en Supabase durante tests:

```typescript
// Limpiar datos de prueba
await cleanupTestData();

// Crear participante de prueba
const participant = await createTestParticipant('test@example.com');

// Crear spin de prueba
const spin = await createTestSpin(participant.id, prizeId);

// Obtener spin sin canjear
const spin = await getUnredeemedSpin();

// Crear usuario admin de prueba
const admin = await createTestAdminUser('admin@test.com', 'Password123!');

// Eliminar usuario admin
await deleteTestAdminUser(admin.user.id);
```

---

## 📊 Reportes

### HTML Report

Después de ejecutar los tests, se genera un reporte HTML interactivo:

```bash
npm run test:report
```

Esto abre un navegador con:
- ✅ Resumen de tests pasados/fallidos
- 📸 Screenshots de fallos
- 🎥 Videos de tests fallidos
- 📝 Traces para debugging

### JSON Report

El reporte JSON se guarda en `test-results/results.json` para CI/CD.

---

## 🐛 Debugging

### Modo Debug

```bash
npm run test:debug
```

Esto abre Playwright Inspector donde puedes:
- Pausar y ejecutar paso a paso
- Ver selectores
- Inspeccionar el DOM
- Ver network requests

### Screenshots y Videos

Por defecto, Playwright captura:
- **Screenshots:** Solo en fallos
- **Videos:** Solo en tests fallidos
- **Traces:** En primer retry

Ubicación: `test-results/`

### Logs

Para ver logs detallados:

```bash
DEBUG=pw:api npx playwright test
```

---

## 🔧 Troubleshooting

### Error: "Cannot find module '@playwright/test'"

```bash
npm install -D @playwright/test
npx playwright install
```

### Error: "No tests found"

Verifica que los archivos terminen en `.spec.ts` o `.test.ts`

### Tests Fallan por Timeout

Aumenta el timeout en `playwright.config.ts`:

```typescript
use: {
  actionTimeout: 20000, // 20 segundos
}
```

### Error de Supabase Permissions

Verifica que `SUPABASE_SERVICE_ROLE_KEY` esté configurado en `.env.local`

### Web Server No Inicia

Asegúrate de que el puerto 5173 esté libre o cambia el puerto en `playwright.config.ts`

---

## 📈 CI/CD Integration

### GitHub Actions Example

```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm test
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 🎯 Best Practices

1. **Usa selectores semánticos:** `getByRole`, `getByText`, `getByLabel`
2. **Evita selectores CSS frágiles:** No uses clases CSS específicas
3. **Limpia datos después de tests:** Usa `afterAll` o `afterEach`
4. **Tests independientes:** Cada test debe poder ejecutarse solo
5. **Esperas explícitas:** Usa `waitFor` en lugar de `waitForTimeout`
6. **Snapshots visuales:** Considera agregar visual regression tests

---

## 📚 Recursos

- [Playwright Docs](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Guide](https://playwright.dev/docs/ci)

---

**¡Tests completos y listos para ejecutar!** 🎉
