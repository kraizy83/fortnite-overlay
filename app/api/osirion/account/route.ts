import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const displayName =
      request.nextUrl.searchParams.get("displayName");

    if (!displayName) {
      return NextResponse.json(
        {
          success: false,
          error: "Le pseudo Epic est manquant.",
        },
        { status: 400 }
      );
    }

    const url =
      `https://fnapi.osirion.gg/v1/accounts/lookup-by-display-name` +
      `?displayName=${encodeURIComponent(displayName)}` +
      `&platform=epic`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Erreur Osirion account:",
        response.status,
        data
      );

      return NextResponse.json(
        {
          success: false,
          error: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      accounts: data.accounts ?? [],
    });
  } catch (error) {
    console.error(
      "Erreur recherche compte Osirion:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Impossible de contacter Osirion.",
      },
      { status: 500 }
    );
  }
}