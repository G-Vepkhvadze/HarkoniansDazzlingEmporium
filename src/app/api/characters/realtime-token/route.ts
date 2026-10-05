import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_CONFIG, getSessionByToken } from "@/lib/auth/index";
import { prisma } from "@/lib/prisma";
import { createFoundryRealtimeToken } from "@/lib/foundry/realtimeToken";

export const runtime = "nodejs";

/**
 * GET /api/characters/realtime-token?characterId=...
 *
 * Issues a short-lived Supabase Realtime JWT for the authenticated Harkonians
 * account's linked character. The browser only receives this short-lived JWT;
 * the Supabase publishable key is safe to expose client-side.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_CONFIG.name)?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await getSessionByToken(sessionToken);
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const characterId = new URL(request.url).searchParams.get("characterId")?.trim();
    if (!characterId) {
      return NextResponse.json({ error: "characterId is required" }, { status: 400 });
    }

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        userId: session.user.id,
        foundryWorldId: { not: null },
        foundryActorId: { not: null },
      },
      select: {
        id: true,
        foundryWorldId: true,
        foundryActorId: true,
      },
    });

    if (!character?.foundryWorldId || !character.foundryActorId) {
      return NextResponse.json(
        { error: "Character is not linked to a Foundry Actor." },
        { status: 404 }
      );
    }

    const realtime = createFoundryRealtimeToken({
      characterId: character.id,
      foundryWorldId: character.foundryWorldId,
    });

    return NextResponse.json({
      success: true,
      token: realtime.token,
      expiresAt: realtime.expiresAt,
      characterId: character.id,
      foundryActorId: character.foundryActorId,
    });
  } catch (error) {
    console.error("Character realtime token generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create realtime token." },
      { status: 500 }
    );
  }
}
