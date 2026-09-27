import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const leaderboardEventId =
      searchParams.get("leaderboardEventId");

    const leaderboardEventWindowId =
      searchParams.get("leaderboardEventWindowId");

    const page =
      searchParams.get("page") || "0";

    if (
      !leaderboardEventId ||
      !leaderboardEventWindowId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "leaderboardEventId et leaderboardEventWindowId sont requis.",
        },
        { status: 400 }
      );
    }

    const url =
      "https://fnapi.osirion.gg/v1/tournaments/leaderboard" +
      `?leaderboardEventId=${encodeURIComponent(
        leaderboardEventId
      )}` +
      `&leaderboardEventWindowId=${encodeURIComponent(
        leaderboardEventWindowId
      )}` +
      `&page=${encodeURIComponent(page)}`;

    console.log(
      "OSIRION LEADERBOARD REQUEST :",
      url
    );

    const response = await fetch(url, {
      cache: "no-store",
    });

    const data = await response.json();

    console.log(
      "OSIRION STATUS :",
      response.status
    );

    if (!response.ok) {
      console.error(
        "Erreur Osirion leaderboard:",
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

    /*
     * Osirion peut renvoyer les entries directement
     * ou à l'intérieur d'un objet leaderboard.
     */

    const entries =
      Array.isArray(data.entries)
        ? data.entries
        : Array.isArray(data.leaderboard?.entries)
          ? data.leaderboard.entries
          : [];

    console.log(
      "OSIRION ENTRIES TROUVÉES :",
      entries.length
    );

    if (entries.length > 0) {
      console.log(
        "PREMIER JOUEUR :",
        entries[0]
      );

      console.log(
        "DERNIER JOUEUR :",
        entries[entries.length - 1]
      );
    }

    return NextResponse.json({
      success: true,

      leaderboard: {
        entries,

        page:
          data.page ??
          data.leaderboard?.page ??
          Number(page),

        totalPages:
          data.totalPages ??
          data.leaderboard?.totalPages,

        updatedAt:
          data.updatedAt ??
          data.leaderboard?.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Erreur leaderboard Osirion:",
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