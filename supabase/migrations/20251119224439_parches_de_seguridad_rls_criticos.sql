-- =====================================================================
-- PARCHE DE SEGURIDAD CRÍTICO PARA TABLAS PUBLIC
-- =====================================================================

-- -----------------------------------------------------
-- SECCIÓN 1: Tabla 'customers'
-- Corrige: RLS deshabilitado.
-- -----------------------------------------------------

-- Paso 1.1: Habilitar la Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Paso 1.2: Crear política para que los usuarios solo gestionen su propia información
-- Se asume que la columna 'id' es la clave foránea a auth.users.id
CREATE POLICY "Los clientes pueden gestionar su propia información"
ON public.customers
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- -----------------------------------------------------
-- SECCIÓN 2: Tabla 'admin_users'
-- Corrige: Políticas que permiten a cualquier usuario leer y gestionar administradores.
-- -----------------------------------------------------

-- Paso 2.1: Eliminar las políticas inseguras existentes
DROP POLICY IF EXISTS "Allow authenticated users to read admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "allow_all" ON public.admin_users;

-- Paso 2.2: Crear una política segura que solo da acceso a los propios administradores
-- Se asume que 'admin_users' tiene una columna 'user_id' que referencia a auth.users.id
CREATE POLICY "Los administradores pueden gestionar la tabla de administradores"
ON public.admin_users
FOR ALL
USING (
  -- Permite la operación si el ID del usuario actual existe en la tabla de admins
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);


-- -----------------------------------------------------
-- SECCIÓN 3: Tabla 'menu_items'
-- Corrige: Política que permite a cualquier usuario autenticado gestionar el menú.
-- -----------------------------------------------------

-- Paso 3.1: Eliminar la política de administración insegura
DROP POLICY IF EXISTS "Permitir administración completa" ON public.menu_items;

-- Paso 3.2: Crear una política segura que solo permite a los administradores gestionar el menú
CREATE POLICY "Los administradores pueden gestionar el menú"
ON public.menu_items
FOR ALL -- Aplica a INSERT, UPDATE, DELETE
USING (
  -- Reutiliza la lógica: solo si el usuario es un administrador
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);