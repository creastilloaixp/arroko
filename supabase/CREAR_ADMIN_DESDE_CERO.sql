-- 🚀 CREAR USUARIO ADMINISTRADOR DESDE CERO
-- Este script limpia y crea un nuevo usuario admin

-- ⚠️ IMPORTANTE: Cambia estos valores antes de ejecutar
-- Reemplaza 'admin@ikusushi.com' con tu email
-- Reemplaza 'tu-password-seguro-123' con tu contraseña (mínimo 6 caracteres)

DO $$
DECLARE
  v_email TEXT := 'admin@ikusushi.com'; -- ⬅️ CAMBIA ESTO
  v_password TEXT := 'tu-password-seguro-123'; -- ⬅️ CAMBIA ESTO
  v_user_id UUID;
BEGIN
  -- 1. Limpiar registros anteriores si existen
  RAISE NOTICE '🧹 Paso 1: Limpiando registros anteriores...';

  DELETE FROM admin_users
  WHERE user_id IN (SELECT id FROM auth.users WHERE email = v_email);

  DELETE FROM auth.users WHERE email = v_email;

  -- 2. Crear nuevo usuario en auth.users
  RAISE NOTICE '👤 Paso 2: Creando usuario en auth.users...';

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    NOW(), -- email ya confirmado
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  RAISE NOTICE '✅ Usuario creado con ID: %', v_user_id;

  -- 3. Crear identidad en auth.identities
  RAISE NOTICE '🔑 Paso 3: Creando identidad...';

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text, -- provider_id es el mismo que user_id para email provider
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- 4. Registrar como admin
  RAISE NOTICE '⭐ Paso 4: Registrando como administrador...';

  INSERT INTO admin_users (user_id, role)
  VALUES (v_user_id, 'admin');

  RAISE NOTICE '🎉 ¡COMPLETADO!';
  RAISE NOTICE '📧 Email: %', v_email;
  RAISE NOTICE '🔑 Password: %', v_password;
  RAISE NOTICE '🆔 User ID: %', v_user_id;

END $$;

-- Verificación final
SELECT '=== ✅ VERIFICACIÓN FINAL ===' AS status;

SELECT
  u.id,
  u.email,
  u.created_at,
  au.role,
  '✅ Usuario creado y registrado como admin' as status
FROM auth.users u
INNER JOIN admin_users au ON au.user_id = u.id
ORDER BY u.created_at DESC
LIMIT 1;
