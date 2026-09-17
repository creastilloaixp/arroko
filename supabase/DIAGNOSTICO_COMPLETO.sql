-- 🔍 DIAGNÓSTICO COMPLETO DEL PROBLEMA DE LOGIN

-- 1. Verificar que la tabla admin_users existe y tiene datos
SELECT '=== 1. CONTENIDO DE admin_users ===' AS step;
SELECT * FROM admin_users;

-- 2. Verificar usuarios en auth.users
SELECT '=== 2. USUARIOS EN auth.users ===' AS step;
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- 3. Verificar si tu usuario específico está en admin_users
SELECT '=== 3. TU USUARIO EN admin_users ===' AS step;
SELECT
  u.id as user_id,
  u.email,
  au.id as admin_record_id,
  au.role,
  CASE
    WHEN au.id IS NULL THEN '❌ NO está en admin_users'
    ELSE '✅ SÍ está en admin_users'
  END as status
FROM auth.users u
LEFT JOIN admin_users au ON au.user_id = u.id
WHERE u.id = '4804cb2f-abce-4729-b4ae-9f36a58726bc';

-- 4. Verificar políticas RLS de admin_users
SELECT '=== 4. POLÍTICAS RLS DE admin_users ===' AS step;
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'admin_users';

-- 5. Verificar que RLS está habilitado
SELECT '=== 5. RLS HABILITADO ===' AS step;
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'admin_users';

-- 6. Probar la función is_admin() con el usuario específico
SELECT '=== 6. PROBAR is_admin() ===' AS step;
SELECT is_admin() AS resultado_is_admin;

-- 7. Intentar insertar el usuario si no existe (esto puede fallar si ya existe)
SELECT '=== 7. INSERTAR USUARIO COMO ADMIN ===' AS step;
INSERT INTO admin_users (user_id, role)
SELECT '4804cb2f-abce-4729-b4ae-9f36a58726bc', 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE user_id = '4804cb2f-abce-4729-b4ae-9f36a58726bc'
)
RETURNING *;

-- 8. Verificación final
SELECT '=== 8. VERIFICACIÓN FINAL ===' AS step;
SELECT
  COUNT(*) as total_admins,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Hay admins registrados'
    ELSE '❌ NO hay admins registrados'
  END as status
FROM admin_users;
