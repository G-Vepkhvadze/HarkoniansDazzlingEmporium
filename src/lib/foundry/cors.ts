import { NextResponse } from "next/server";

export function addFoundryCorsHeaders(
    response: NextResponse,
    request: Request
): void {
    const origin =
        request.headers.get("origin");

    response.headers.set(
        "Access-Control-Allow-Origin",
        origin || "*"
    );

    response.headers.set(
        "Access-Control-Allow-Credentials",
        "true"
    );

    response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );

    response.headers.set(
        "Access-Control-Allow-Headers",
        [
            "Content-Type",
            "Authorization",
            "x-foundry-world-secret"
        ].join(", ")
    );

    response.headers.set(
        "Access-Control-Expose-Headers",
        "Content-Type"
    );

    response.headers.set(
        "Vary",
        "Origin"
    );
}

export function foundryOptions(
    request: Request
): NextResponse {
    const response = new NextResponse(null, {
        status: 204
    });

    addFoundryCorsHeaders(
        response,
        request
    );

    return response;
}