import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
    "https://lily_livered-the-katastro-campaign.forge-vtt.com",
    "https://forge-vtt.com",
    "http://localhost:30000",
    "http://127.0.0.1:30000"
];

/**
 * Check if an origin is allowed.
 * Allows exact matches from ALLOWED_ORIGINS, or any subdomain of forge-vtt.com.
 */
function isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;
    
    // Check exact matches
    if (ALLOWED_ORIGINS.includes(origin)) {
        return true;
    }
    
    // Allow any subdomain of forge-vtt.com
    if (origin.endsWith(".forge-vtt.com") || origin === "https://forge-vtt.com") {
        return true;
    }
    
    return false;
}

export function addFoundryCorsHeaders(
    response: NextResponse,
    request: Request
): void {
    const origin = request.headers.get("origin");

    // If origin is present and allowed, echo it back.
    // Otherwise, use the first allowed origin as default.
    // Never use "*" when credentials are allowed.
    const allowedOrigin = isOriginAllowed(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

    response.headers.set(
        "Access-Control-Allow-Origin",
        allowedOrigin
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