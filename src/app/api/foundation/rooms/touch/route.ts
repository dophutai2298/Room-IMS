import { touchRoom } from "@/lib/insforge/rental-repository";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { roomId?: string } | null;
  const roomId = body?.roomId;

  if (!roomId) {
    return Response.json(
      {
        error: {
          message: "roomId is required",
          code: "VALIDATION_ERROR",
        },
      },
      { status: 400 },
    );
  }

  const result = await touchRoom(roomId);

  if (result.error) {
    return Response.json({ error: result.error }, { status: result.error.statusCode ?? 500 });
  }

  return Response.json({ data: result.data });
}
