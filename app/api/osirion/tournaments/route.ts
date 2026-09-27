import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://fnapi.osirion.gg/v1/tournaments?region=EU&includeHistoricData=false&lang=fr",
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data,
        },
        {
          status: response.status,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur Osirion:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de contacter Osirion.",
      },
      {
        status: 500,
      }
    );
  }
}