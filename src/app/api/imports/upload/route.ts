import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type !== "FLA" && type !== "FLQA") {
    return NextResponse.json({ error: "type must be FLA or FLQA" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const storage_path = `${type.toLowerCase()}/${ts}-${safeName}`;

  const supabase = supabaseServer();

  // 1) upload to storage (bucket MUST exist)
  const { error: upErr } = await supabase.storage
    .from("imports")
    .upload(storage_path, file, {
      contentType: file.type || "text/csv",
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json({ error: `storage upload failed: ${upErr.message}` }, { status: 500 });
  }

  // 2) create import record
  const { data: imp, error: impErr } = await supabase
    .from("imports")
    .insert({
      type,
      file_name: file.name,
      storage_path,
      status: "UPLOADED",
    })
    .select("*")
    .single();

  if (impErr || !imp) {
    return NextResponse.json({ error: impErr?.message ?? "failed to create import row" }, { status: 500 });
  }

  return NextResponse.json({ import: imp });
}
