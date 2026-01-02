import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const type = body?.type;
  const fileName = body?.fileName;

  if ((type !== "FLA" && type !== "FLQA") || !fileName) {
    return NextResponse.json(
      { error: "type (FLA|FLQA) and fileName are required" },
      { status: 400 }
    );
  }

  const safeName = String(fileName).replace(/[^\w.\-()+ ]/g, "_");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${type.toLowerCase()}/${ts}-${safeName}`;

  const supabase = supabaseServer();

  // Supabase Storage signed upload URL
  const { data, error } = await supabase.storage
    .from("imports")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "failed to create signed upload url" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    storage_path: path,
    signed_url: data.signedUrl,
    token: data.token,
  });
}
