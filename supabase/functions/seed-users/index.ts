import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = [
    { email: "admin@primus.com", password: "admin123", role: "admin", name: "Administrador" },
    { email: "operador@primus.com", password: "operador123", role: "operador", name: "Operador de Caixa" },
  ];

  const results = [];

  for (const u of users) {
    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const exists = existingUsers?.users?.find((eu) => eu.email === u.email);

    if (exists) {
      results.push({ email: u.email, status: "already exists", userId: exists.id });
      // Ensure role exists
      await supabase.from("user_roles").upsert(
        { user_id: exists.id, role: u.role },
        { onConflict: "user_id,role" }
      );
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { display_name: u.name },
    });

    if (error) {
      results.push({ email: u.email, status: "error", error: error.message });
      continue;
    }

    // Assign role
    await supabase.from("user_roles").insert({ user_id: data.user.id, role: u.role });
    results.push({ email: u.email, status: "created", userId: data.user.id });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
