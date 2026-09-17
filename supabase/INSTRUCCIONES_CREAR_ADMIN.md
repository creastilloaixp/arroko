# 🚀 Crear Usuario Administrador desde Cero

## 📋 Pasos a Seguir:

### Paso 1: Editar el Script SQL

1. Abre el archivo `CREAR_ADMIN_DESDE_CERO.sql`
2. Busca estas dos líneas (están al principio):
   ```sql
   v_email TEXT := 'admin@ikusushi.com'; -- ⬅️ CAMBIA ESTO
   v_password TEXT := 'tu-password-seguro-123'; -- ⬅️ CAMBIA ESTO
   ```
3. **Reemplázalas** con tu email y contraseña deseada
4. **Guarda el archivo**

**Ejemplo:**
```sql
v_email TEXT := 'carlos@ejemplo.com';
v_password TEXT := 'MiPassword123!';
```

### Paso 2: Ejecutar el Script

1. Ve a **Supabase Dashboard** → https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Copia **TODO** el contenido del archivo `CREAR_ADMIN_DESDE_CERO.sql`
5. Pégalo en el editor
6. Haz clic en **RUN** ▶️

### Paso 3: Verificar los Resultados

Deberías ver mensajes como:
```
🧹 Paso 1: Limpiando registros anteriores...
👤 Paso 2: Creando usuario en auth.users...
✅ Usuario creado con ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
🔑 Paso 3: Creando identidad...
⭐ Paso 4: Registrando como administrador...
🎉 ¡COMPLETADO!
📧 Email: tu-email@ejemplo.com
🔑 Password: tu-password
🆔 User ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Y al final una tabla con:
- ✅ Usuario creado y registrado como admin

### Paso 4: Iniciar Sesión

1. **Refresca la página de la aplicación** (F5)
2. Ve a la página de login
3. Usa el **email y contraseña** que configuraste en el Paso 1
4. Haz clic en **ENTRAR**

**Debería funcionar perfectamente ✅**

---

## 🔍 Si Algo Sale Mal

### Error: "duplicate key value violates unique constraint"
- El email ya existe
- Cambia el email en el script o ejecuta primero:
  ```sql
  DELETE FROM admin_users WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com');
  DELETE FROM auth.users WHERE email = 'tu-email@ejemplo.com';
  ```

### Error: "permission denied"
- No tienes permisos suficientes en Supabase
- Asegúrate de estar ejecutando el SQL como **service_role** (debería ser automático en el SQL Editor)

### Login sigue sin funcionar
- Verifica que usaste el **mismo email y contraseña** que pusiste en el script
- Revisa la consola del navegador (F12) para ver los logs detallados
- Comparte los logs conmigo

---

## 📝 Notas Importantes

- **La contraseña debe tener mínimo 6 caracteres**
- El usuario se crea con email **auto-confirmado** (no necesitas verificar email)
- El script elimina cualquier usuario anterior con el mismo email antes de crear uno nuevo
- El usuario se registra automáticamente como **admin** en la tabla `admin_users`

---

**¡Listo! Con esto deberías poder iniciar sesión sin problemas** 🎉
