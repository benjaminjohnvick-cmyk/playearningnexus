// Integration passthrough for the FRONTEND: POST /integrations/:name
// Covers InvokeLLM, SendEmail, GenerateImage, GenerateSpeech, UploadFile.
import { Core } from "../sdk/integrations.ts";

export async function integrationRoutes(req: Request, pathname: string): Promise<Response> {
  const m = pathname.match(/^\/integrations\/([A-Za-z]+)$/);
  if (!m) return Response.json({ error: "Not found" }, { status: 404 });
  const name = m[1];
  const args = await req.json().catch(() => ({}));
  try {
    switch (name) {
      case "InvokeLLM": return Response.json({ result: await Core.InvokeLLM(args) });
      case "SendEmail": return Response.json(await Core.SendEmail(args));
      case "GenerateImage": return Response.json(await Core.GenerateImage(args));
      case "GenerateSpeech": return await generateSpeech(args);
      case "UploadFile": return await uploadFile(req, args);
      default: return Response.json({ error: `Unknown integration ${name}` }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// OpenAI TTS → returns a data URL (swap to S3 in Phase 3 for large files).
async function generateSpeech(args: { text?: string; voice?: string }): Promise<Response> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return Response.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("TTS_MODEL") ?? "tts-1", voice: args.voice ?? "alloy", input: args.text ?? "" }),
  });
  const buf = new Uint8Array(await r.arrayBuffer());
  const b64 = btoa(String.fromCharCode(...buf));
  return Response.json({ url: `data:audio/mpeg;base64,${b64}` });
}

// UploadFile → returns presigned S3 URLs. The client PUTs bytes to upload_url, then uses
// file_url. (If your frontend previously sent bytes to UploadFile, switch it to: request
// URLs here, then PUT the File to upload_url — see PHASE-3-NOTES.md.)
async function uploadFile(_req: Request, args: { filename?: string }): Promise<Response> {
  const bucket = Deno.env.get("S3_BUCKET");
  if (!bucket) {
    return Response.json(
      { error: "UploadFile not configured", hint: "Set S3_BUCKET + AWS creds (see PHASE-3-NOTES.md)." },
      { status: 501 },
    );
  }
  const { uploadFileUrls } = await import("../sdk/aws/s3.ts");
  const urls = await uploadFileUrls(args.filename ?? "file.bin");
  return Response.json(urls);
}
