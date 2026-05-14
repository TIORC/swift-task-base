DO $$
DECLARE
  v_users RECORD;
  v_id uuid;
BEGIN
  FOR v_users IN
    SELECT * FROM (VALUES
      ('patrick.leite@orcoma.com.br', 'patrick', 'Patrick Leite'),
      ('daniel.silva@orcoma.com.br', 'daniel', 'Daniel Silva'),
      ('silvia.vieira@orcoma.com.br', 'silvia', 'Silvia Vieira')
    ) AS t(email, pwd, full_name)
  LOOP
    -- Skip if already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_users.email) THEN
      CONTINUE;
    END IF;

    v_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_users.email, crypt(v_users.pwd, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name', v_users.full_name, 'email', v_users.email),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_users.email, 'email_verified', true),
      'email', v_id::text, now(), now(), now());

    -- profile created automatically by trigger handle_new_user

    -- suporte role only (web blocked)
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'suporte') ON CONFLICT DO NOTHING;

    -- disable default ti web access
    UPDATE public.user_systems SET enabled = false WHERE user_id = v_id AND system = 'ti';
  END LOOP;
END $$;