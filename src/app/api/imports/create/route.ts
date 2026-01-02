import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const type = body?.type;

  if (type !== "FLA" && type !== "FLQA") {
    return NextResponse.json({ error: "type must be FLA or FLQA" }, { status: 400 });
  }

  const file_name = body?.file_name ?? null;
  const storage_path = body?.storage_path ?? null; // you will fill this after upload step
  if (!storage_path) {
    return NextResponse.json({ error: "storage_path is required" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("imports")
    .insert({ type, file_name, storage_path })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ import: data });
}
