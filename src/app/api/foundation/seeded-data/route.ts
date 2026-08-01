import { readMvpSeededData } from "@/lib/insforge/rental-repository";

export async function GET() {
  const result = await readMvpSeededData();

  if (result.error) {
    return Response.json({ error: result.error }, { status: result.error.statusCode ?? 500 });
  }

  return Response.json({ data: result.data });
}
