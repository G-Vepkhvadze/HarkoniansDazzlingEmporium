import { NextResponse } from "next/server";

import {
  createLinkRequest
} from "@/lib/foundry/linking";

import {
  getWorldBySecret
} from "@/lib/foundry/worldSecret";

import {
  addFoundryCorsHeaders
} from "@/lib/foundry/cors";

export const runtime = "nodejs";

export async function OPTIONS(
    request: Request
) {
  const response =
      new NextResponse(null, {
        status: 204
      });

  addFoundryCorsHeaders(
      response,
      request
  );

  return response;
}

export async function POST(
    request: Request
) {
  try {
    const body =
        await request.json();

    const foundryWorldId =
        typeof body?.foundryWorldId === "string"
            ? body.foundryWorldId.trim()
            : "";

    const foundryActorId =
        typeof body?.foundryActorId === "string"
            ? body.foundryActorId.trim()
            : "";

    const worldSecret =
        request.headers.get(
            "x-foundry-world-secret"
        );

    if (
        !foundryWorldId ||
        !foundryActorId
    ) {
      const response =
          NextResponse.json(
              {
                error:
                    "foundryWorldId and foundryActorId are required."
              },
              { status: 400 }
          );

      addFoundryCorsHeaders(
          response,
          request
      );

      return response;
    }

    if (!worldSecret) {
      const response =
          NextResponse.json(
              {
                error:
                    "World secret is required."
              },
              { status: 401 }
          );

      addFoundryCorsHeaders(
          response,
          request
      );

      return response;
    }

    const world =
        await getWorldBySecret(
            worldSecret
        );

    if (!world) {
      const response =
          NextResponse.json(
              {
                error:
                    "Invalid world secret."
              },
              { status: 401 }
          );

      addFoundryCorsHeaders(
          response,
          request
      );

      return response;
    }

    if (
        world.foundryWorldId !==
        foundryWorldId
    ) {
      const response =
          NextResponse.json(
              {
                error:
                    "Foundry world does not match the paired world."
              },
              { status: 403 }
          );

      addFoundryCorsHeaders(
          response,
          request
      );

      return response;
    }

    const result =
        await createLinkRequest(
            foundryWorldId,
            foundryActorId,
            world.id
        );

    const publicBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://harkonians.quest";

    const linkUrl =
        `${publicBaseUrl}/foundry/link?requestId=${encodeURIComponent(result.requestId)}`;

    const response =
        NextResponse.json(
            {
              success: true,
              requestId:
              result.requestId,
              linkUrl,
              expiresIn: 900
            },
            { status: 201 }
        );

    addFoundryCorsHeaders(
        response,
        request
    );

    return response;

  } catch (error) {
    const message =
        error instanceof Error
            ? error.message
            : "Failed to create link request.";

    const status =
        message.includes(
            "already linked"
        )
            ? 409
            : 400;

    const response =
        NextResponse.json(
            { error: message },
            { status }
        );

    addFoundryCorsHeaders(
        response,
        request
    );

    return response;
  }
}