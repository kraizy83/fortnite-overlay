"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ScoreLocation = {
  leaderboardEventId: string;
  leaderboardEventWindowId: string;
  isMain: boolean;
};

type EventWindow = {
  eventWindowId: string;
  beginTime: string;
  endTime: string;
  round: number;
  scoreLocations?: ScoreLocation[];
};

type Tournament = {
  eventId: string;
  eventGroup: string;
  displayData?: {
    longFormatTitle?: string;
    titleLine1?: string;
    titleLine2?: string;
    tournamentDisplayId?: string;
  };
  eventWindows?: EventWindow[];
};

type TournamentOption = {
  id: string;
  eventId: string;
  eventWindowId: string;
  leaderboardEventId: string;
  leaderboardEventWindowId: string;
  name: string;
  date: string;
  time: string;
  beginTime: number;
  round: number;
  status: "À venir" | "En cours" | "Terminé";
};

function getTournamentName(tournament: Tournament): string {
  return (
    tournament.displayData?.longFormatTitle ||
    tournament.displayData?.tournamentDisplayId ||
    tournament.displayData?.titleLine1 ||
    tournament.eventId
  );
}

function getStatus(
  beginTime: string,
  endTime: string
): "À venir" | "En cours" | "Terminé" {
  const now = Date.now();

  const begin = new Date(beginTime).getTime();
  const end = new Date(endTime).getTime();

  if (now < begin) {
    return "À venir";
  }

  if (now <= end) {
    return "En cours";
  }

  return "Terminé";
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(dateString));
}

function formatTime(dateString: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(dateString));
}

export default function Home() {
  const [tournaments, setTournaments] = useState<
    TournamentOption[]
  >([]);

  const [tournamentSearch, setTournamentSearch] =
    useState("");

  const [selectedTournament, setSelectedTournament] =
    useState<TournamentOption | null>(null);

  const [player, setPlayer] = useState("");
  const [playerAccountId, setPlayerAccountId] =
    useState("");

  const [overlayUrl, setOverlayUrl] = useState("");

  const [loadingTournaments, setLoadingTournaments] =
    useState(true);

  const [loadingPlayer, setLoadingPlayer] =
    useState(false);

  const [loading, setLoading] = useState(false);

  /*
   * Récupération des tournois
   */
  useEffect(() => {
    async function loadTournaments() {
      try {
        const response = await fetch(
          "/api/osirion/tournaments"
        );

        if (!response.ok) {
          throw new Error(
            `Erreur HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!data.tournaments) {
          throw new Error(
            "Aucun tournoi reçu depuis Osirion."
          );
        }

        const options: TournamentOption[] = [];

        for (
          const tournament of data.tournaments as Tournament[]
        ) {
          const tournamentName =
            getTournamentName(tournament);

          for (
            const eventWindow of
            tournament.eventWindows ?? []
          ) {
            if (
              !eventWindow.beginTime ||
              !eventWindow.endTime
            ) {
              continue;
            }

            /*
             * On prend le score location principal.
             * S'il n'existe pas, on prend le premier.
             */
            const mainScoreLocation:
              | ScoreLocation
              | undefined =
              eventWindow.scoreLocations?.find(
                (location: ScoreLocation) =>
                  location.isMain
              ) ??
              eventWindow.scoreLocations?.[0];

            if (!mainScoreLocation) {
              continue;
            }

            const beginTime = new Date(
              eventWindow.beginTime
            ).getTime();

            options.push({
              id: `${tournament.eventId}_${eventWindow.eventWindowId}`,

              eventId: tournament.eventId,

              eventWindowId:
                eventWindow.eventWindowId,

              leaderboardEventId:
                mainScoreLocation.leaderboardEventId,

              leaderboardEventWindowId:
                mainScoreLocation.leaderboardEventWindowId,

              name: tournamentName,

              date: formatDate(
                eventWindow.beginTime
              ),

              time: formatTime(
                eventWindow.beginTime
              ),

              beginTime,

              round: eventWindow.round,

              status: getStatus(
                eventWindow.beginTime,
                eventWindow.endTime
              ),
            });
          }
        }

        /*
         * Les plus récents en premier.
         */
        options.sort(
          (
            a: TournamentOption,
            b: TournamentOption
          ) => b.beginTime - a.beginTime
        );

        setTournaments(options);
      } catch (error) {
        console.error(
          "Erreur récupération tournois Osirion :",
          error
        );

        alert(
          "Impossible de récupérer les tournois Osirion."
        );
      } finally {
        setLoadingTournaments(false);
      }
    }

    loadTournaments();
  }, []);

  /*
   * Recherche du compte Epic
   */
  useEffect(() => {
    if (!player.trim()) {
      setPlayerAccountId("");
      return;
    }

    const timeout = setTimeout(
      async () => {
        setLoadingPlayer(true);

        try {
          const response = await fetch(
            `/api/osirion/account?displayName=${encodeURIComponent(
              player
            )}`
          );

          if (!response.ok) {
            throw new Error(
              `Erreur HTTP ${response.status}`
            );
          }

          const data = await response.json();

          if (
            !data.success ||
            !data.accounts ||
            data.accounts.length === 0
          ) {
            setPlayerAccountId("");
            return;
          }

          setPlayerAccountId(
            data.accounts[0].accountId
          );
        } catch (error) {
          console.error(
            "Erreur recherche compte Epic :",
            error
          );

          setPlayerAccountId("");
        } finally {
          setLoadingPlayer(false);
        }
      },
      500
    );

    return () => clearTimeout(timeout);
  }, [player]);

  /*
   * Recherche / filtrage des tournois
   */
  const filteredTournaments =
    useMemo(() => {
      const search =
        tournamentSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return tournaments;
      }

      return tournaments.filter(
        (tournament: TournamentOption) =>
          tournament.name
            .toLowerCase()
            .includes(search) ||
          tournament.date
            .toLowerCase()
            .includes(search) ||
          tournament.time
            .toLowerCase()
            .includes(search) ||
          tournament.round
            .toString()
            .includes(search)
      );
    }, [
      tournaments,
      tournamentSearch,
    ]);

  /*
   * Création de l'overlay
   */
  async function createOverlay() {
    if (!selectedTournament) {
      alert(
        "Sélectionne un tournoi."
      );
      return;
    }

    if (!player.trim()) {
      alert(
        "Entre un compte Epic."
      );
      return;
    }

    if (!playerAccountId) {
      alert(
        "Le compte Epic n'a pas été trouvé."
      );
      return;
    }

    setLoading(true);

    const overlayKey = Math.random()
      .toString(36)
      .substring(2, 10);

    /*
     * On conserve pour le moment les IDs
     * du tournoi dans tournament_id.
     */
    const tournamentIdentifier =
      JSON.stringify({
        eventId:
          selectedTournament.eventId,

        eventWindowId:
          selectedTournament.eventWindowId,

        leaderboardEventId:
          selectedTournament.leaderboardEventId,

        leaderboardEventWindowId:
          selectedTournament.leaderboardEventWindowId,
      });

    const tournamentName =
      `${selectedTournament.name} • ${selectedTournament.date} • Round ${selectedTournament.round}`;

    const { error } =
      await supabase
        .from("overlay_configs")
        .insert({
          overlay_key: overlayKey,

          tournament_id:
            tournamentIdentifier,

          tournament_name:
            tournamentName,

          epic_account_id:
            playerAccountId,

          epic_name:
            player.trim(),
        });

    if (error) {
      console.error(error);

      alert(
        "Erreur lors de la création de l'overlay."
      );

      setLoading(false);
      return;
    }

    const url =
      `${window.location.origin}/o/${overlayKey}`;

    setOverlayUrl(url);

    setLoading(false);
  }

  /*
   * Copier l'URL
   */
  async function copyUrl() {
    if (!overlayUrl) {
      return;
    }

    await navigator.clipboard.writeText(
      overlayUrl
    );

    alert("Lien copié !");
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">

        <h1 className="text-3xl font-bold mb-2">
          Fortnite Overlay
        </h1>

        <p className="text-gray-400 mb-8">
          Configure ton overlay pour OBS.
        </p>

        <div className="bg-[#15151c] border border-white/10 rounded-2xl p-6 space-y-6">

          {/* TOURNOI */}

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Tournoi
            </label>

            <input
              type="text"
              value={tournamentSearch}
              onChange={(e) =>
                setTournamentSearch(
                  e.target.value
                )
              }
              placeholder="Rechercher un tournoi..."
              className="w-full bg-[#0d0d12] border border-white/10 rounded-xl px-4 py-3 outline-none mb-3"
            />

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">

              {loadingTournaments ? (
                <div className="text-sm text-gray-500 py-4 text-center">
                  Chargement des tournois...
                </div>
              ) : filteredTournaments.length ===
                0 ? (
                <div className="text-sm text-gray-500 py-4 text-center">
                  Aucun tournoi trouvé.
                </div>
              ) : (
                filteredTournaments.map(
                  (
                    tournament: TournamentOption
                  ) => {
                    const selected =
                      selectedTournament?.id ===
                      tournament.id;

                    return (
                      <button
                        key={tournament.id}
                        type="button"
                        onClick={() =>
                          setSelectedTournament(
                            tournament
                          )
                        }
                        className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                          selected
                            ? "border-white bg-white/10"
                            : "border-white/10 bg-[#0d0d12] hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">

                          <div className="min-w-0">

                            <p className="font-semibold truncate">
                              {tournament.name}
                            </p>

                            <p className="text-sm text-gray-400 mt-1">
                              {tournament.date}
                              {" • "}
                              {tournament.time}
                              {" • "}
                              Round{" "}
                              {tournament.round}
                            </p>

                          </div>

                          <span
                            className={`shrink-0 text-xs px-2 py-1 rounded-lg ${
                              tournament.status ===
                              "En cours"
                                ? "bg-green-500/10 text-green-400"
                                : tournament.status ===
                                  "À venir"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-white/5 text-gray-500"
                            }`}
                          >
                            {tournament.status}
                          </span>

                        </div>
                      </button>
                    );
                  }
                )
              )}

            </div>

            {selectedTournament && (
              <div className="mt-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">

                <p className="text-xs text-gray-500 mb-1">
                  Tournoi sélectionné
                </p>

                <p className="font-semibold">
                  {selectedTournament.name}
                </p>

                <p className="text-sm text-gray-400">
                  {selectedTournament.date}
                  {" • "}
                  {selectedTournament.time}
                  {" • "}
                  Round{" "}
                  {selectedTournament.round}
                </p>

              </div>
            )}
          </div>

          {/* COMPTE EPIC */}

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Compte Epic
            </label>

            <input
              type="text"
              value={player}
              onChange={(e) =>
                setPlayer(e.target.value)
              }
              placeholder="Ex : Kraizy"
              className="w-full bg-[#0d0d12] border border-white/10 rounded-xl px-4 py-3 outline-none"
            />

            {player && (
              <p className="text-xs text-gray-500 mt-2">
                {loadingPlayer ? (
                  "Recherche du compte..."
                ) : playerAccountId ? (
                  <span className="text-green-400">
                    ✓ Compte trouvé
                  </span>
                ) : (
                  <span className="text-red-400">
                    Compte introuvable
                  </span>
                )}
              </p>
            )}
          </div>

          {/* BOUTON */}

          <button
            onClick={createOverlay}
            disabled={
              loading ||
              loadingTournaments ||
              loadingPlayer ||
              !selectedTournament ||
              !playerAccountId
            }
            className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Création..."
              : "Créer l'overlay"}
          </button>

          {/* URL */}

          {overlayUrl && (
            <div className="pt-4 border-t border-white/10">

              <p className="text-sm text-gray-400 mb-2">
                URL à mettre dans OBS
              </p>

              <div className="flex gap-2">

                <input
                  value={overlayUrl}
                  readOnly
                  className="flex-1 bg-[#0d0d12] border border-white/10 rounded-xl px-4 py-3 text-sm"
                />

                <button
                  onClick={copyUrl}
                  className="bg-white text-black px-4 rounded-xl font-semibold"
                >
                  Copier
                </button>

              </div>

            </div>
          )}

        </div>
      </div>
    </main>
  );
}