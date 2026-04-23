import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  const adminClient = getAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY לא מוגדר בסביבה." }, { status: 500 });
  }

  const { email, fullName, password, role } = (await request.json()) as {
    email: string;
    fullName: string;
    password: string;
    role: string;
  };

  if (!email || !fullName || !password || !role) {
    return NextResponse.json({ error: "חסרים שדות חובה." }, { status: 400 });
  }

  const { data: { user }, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !user) {
    return NextResponse.json({ error: authError?.message ?? "יצירת המשתמש נכשלה." }, { status: 500 });
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    user_id: user.id,
    email,
    full_name: fullName,
    role,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(user.id).catch(() => undefined);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: user.id });
}

export async function DELETE(request: NextRequest) {
  const adminClient = getAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY לא מוגדר." }, { status: 500 });
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "חסר userId." }, { status: 400 });
  }

  await adminClient.from("profiles").delete().eq("user_id", userId);
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
