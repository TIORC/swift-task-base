import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT using getClaims
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // LIST USERS
    if (action === "list") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 500 });
      if (error) throw error;

      const { data: roles } = await adminClient.from("user_roles").select("*");
      const { data: profiles } = await adminClient.from("profiles").select("*");

      const enriched = users.map((u) => {
        const profile = profiles?.find((p) => p.id === u.id);
        const userRoles = roles?.filter((r) => r.user_id === u.id).map((r) => r.role) || [];
        return {
          id: u.id,
          email: u.email,
          full_name: profile?.full_name || "",
          avatar_url: profile?.avatar_url || "",
          roles: userRoles,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        };
      });

      return new Response(JSON.stringify(enriched), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE USER
    if (action === "create") {
      const { email, password, full_name, role } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado no sistema." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      // Assign role if provided
      if (role && newUser.user) {
        await adminClient.from("user_roles").insert({
          user_id: newUser.user.id,
          role,
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE PASSWORD
    if (action === "update_password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "user_id e password são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE ROLES
    if (action === "update_roles") {
      const { user_id, roles } = body;
      if (!user_id || !Array.isArray(roles)) {
        return new Response(JSON.stringify({ error: "user_id e roles são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete existing roles
      await adminClient.from("user_roles").delete().eq("user_id", user_id);

      // Insert new roles
      if (roles.length > 0) {
        await adminClient.from("user_roles").insert(
          roles.map((role: string) => ({ user_id, role }))
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BULK CREATE SUPPORT USERS
    if (action === "bulk_create_support") {
      const { users } = body;
      if (!Array.isArray(users) || users.length === 0) {
        return new Response(JSON.stringify({ error: "users array é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = {
        created: 0,
        skipped: 0,
        errors: [] as { email: string; error: string }[],
        credentials: [] as { email: string; password: string }[],
      };

      // Helper: friendly full name from local part
      const buildFullName = (email: string) => {
        const local = email.split("@")[0];
        return local
          .split(".")
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(" ");
      };

      // Cryptographically strong random password (URL-safe, ~22 chars)
      const generatePassword = () => {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      };

      for (const email of users as string[]) {
        try {
          const password = generatePassword();
          const full_name = buildFullName(email);

          const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name },
          });

          if (createErr) {
            // If already exists, skip silently
            if (createErr.message?.toLowerCase().includes("already") || createErr.message?.toLowerCase().includes("registered")) {
              results.skipped++;
              continue;
            }
            results.errors.push({ email, error: createErr.message });
            continue;
          }

          // Assign default suporte role (acesso apenas ao app desktop de chamados)
          if (created.user) {
            await adminClient.from("user_roles").insert({
              user_id: created.user.id,
              role: "suporte",
            });
          }

          results.created++;
          results.credentials.push({ email, password });
        } catch (e: any) {
          results.errors.push({ email, error: e.message || "Erro desconhecido" });
        }
      }

      return new Response(JSON.stringify({ success: true, ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // DELETE USER
    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Não é possível excluir a si mesmo" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
