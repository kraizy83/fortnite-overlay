"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type OverlayConfig = {
  overlay_key: string;
  tournament_id: string;
  tournament_name: string;
  epic_account_id: string;
  epic_name: string;
};

type LeaderboardPlayer = {
  accountId: string;
  username: string;
};

type SessionHistory = {
  sessionId: string;
  endTime?: string;
  trackedStats?: {
    MATCH_PLAYED_STAT?: number;
    PLACEMENT_STAT_INDEX?: number;
    PLACEMENT_TIEBREAKER_STAT?: number;
    TEAM_ELIMS_STAT_INDEX?: number;
    TIME_ALIVE_STAT?: number;
    VICTORY_ROYALE_STAT?: number;
  };
};

type LeaderboardEntry = {
  teamId: string;
  players?: LeaderboardPlayer[];
  pointsEarned?: number;
  score?: number;
  rank?: number;
  percentile?: number;
  sessionHistory?: SessionHistory[];
  unscoredSessions?: unknown[];
};

type LeaderboardData = {
  entries?: LeaderboardEntry[];
  page?: number;
  totalPages?: number;
  updatedAt?: string;
};

type LeaderboardResponse = {
  success: boolean;
  leaderboard?: LeaderboardData;
  error?: unknown;
};

type Stats = {
  top: number | string | null;
  points: number | null;
  games: number | null;
};

const PAGE_DELAY = 1500;
const UPDATE_INTERVAL = 60000;
const MAX_PAGES = 100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function OverlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [config, setConfig] =
    useState<OverlayConfig | null>(null);

  const [stats, setStats] = useState<Stats>({
    top: null,
    points: null,
    games: null,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const { id } = await params;

        console.log("Overlay ID :", id);

        const { data, error } = await supabase
          .from("overlay_configs")
          .select("*")
          .eq("overlay_key", id)
          .single();

        if (error) {
          console.error(
            "Erreur Supabase :",
            error
          );

          setLoading(false);
          return;
        }

        console.log(
          "Configuration overlay :",
          data
        );

        setConfig(data);
      } catch (error) {
        console.error(
          "Erreur récupération overlay :",
          error
        );

        setLoading(false);
      }
    }

    loadConfig();
  }, [params]);

  useEffect(() => {
    if (!config) {
      return;
    }

    let cancelled = false;

    // Page où le joueur a été trouvé.
    let playerPage: number | null = null;

    // Empêche deux recherches simultanées.
    let requestRunning = false;

    async function fetchLeaderboardPage(
      leaderboardEventId: string,
      leaderboardEventWindowId: string,
      page: number
    ): Promise<LeaderboardEntry[]> {
      if (cancelled) {
        return [];
      }

      const response = await fetch(
        `/api/osirion/leaderboard` +
          `?leaderboardEventId=${encodeURIComponent(
            leaderboardEventId
          )}` +
          `&leaderboardEventWindowId=${encodeURIComponent(
            leaderboardEventWindowId
          )}` +
          `&page=${page}`,
        {
          cache: "no-store",
        }
      );

      if (response.status === 429) {
        throw new Error(
          "RATE_LIMITED"
        );
      }

      if (!response.ok) {
        throw new Error(
          `Erreur leaderboard HTTP ${response.status}`
        );
      }

      const data: LeaderboardResponse =
        await response.json();

      if (
        !data.success ||
        !data.leaderboard
      ) {
        throw new Error(
          "Réponse leaderboard invalide."
        );
      }

      return data.leaderboard.entries ?? [];
    }

    function findPlayer(
      entries: LeaderboardEntry[]
    ): LeaderboardEntry | null {
      return (
        entries.find((entry) =>
          entry.players?.some(
            (player) =>
              player.accountId ===
              config.epic_account_id
          )
        ) ?? null
      );
    }

    async function searchPage(
      leaderboardEventId: string,
      leaderboardEventWindowId: string,
      page: number
    ): Promise<LeaderboardEntry | null> {
      console.log(
        `Recherche du joueur - page ${page}`
      );

      const entries =
        await fetchLeaderboardPage(
          leaderboardEventId,
          leaderboardEventWindowId,
          page
        );

      console.log(
        `Page ${page} : ${entries.length} joueurs`
      );

      return findPlayer(entries);
    }

    async function fullSearch(
      leaderboardEventId: string,
      leaderboardEventWindowId: string
    ): Promise<LeaderboardEntry | null> {
      console.log(
        "========================================"
      );

      console.log(
        "DÉBUT RECHERCHE LENTE DU JOUEUR"
      );

      console.log(
        "Délai entre chaque page :",
        PAGE_DELAY,
        "ms"
      );

      console.log(
        "Maximum de pages :",
        MAX_PAGES
      );

      console.log(
        "========================================"
      );

      for (
        let page = 0;
        page < MAX_PAGES;
        page++
      ) {
        if (cancelled) {
          return null;
        }

        const found =
          await searchPage(
            leaderboardEventId,
            leaderboardEventWindowId,
            page
          );

        if (found) {
          playerPage = page;

          console.log(
            "========================================"
          );

          console.log(
            "JOUEUR TROUVÉ !"
          );

          console.log(
            "Page :",
            playerPage
          );

          console.log(
            "Rank :",
            found.rank
          );

          console.log(
            "Username :",
            found.players?.[0]?.username
          );

          console.log(
            "========================================"
          );

          return found;
        }

        /*
         * On attend avant la prochaine requête.
         *
         * Pas d'attente après la dernière page
         * puisque la recherche est terminée.
         */
        if (
          page < MAX_PAGES - 1
        ) {
          await sleep(PAGE_DELAY);
        }
      }

      console.warn(
        "Joueur introuvable après",
        MAX_PAGES,
        "pages."
      );

      return null;
    }

    async function loadStats() {
      if (requestRunning) {
        console.log(
          "Une recherche est déjà en cours."
        );

        return;
      }

      requestRunning = true;

      try {
        const tournamentData =
          JSON.parse(
            config.tournament_id
          );

        const leaderboardEventId =
          tournamentData.leaderboardEventId;

        const leaderboardEventWindowId =
          tournamentData.leaderboardEventWindowId;

        console.log(
          "Leaderboard Event ID :",
          leaderboardEventId
        );

        console.log(
          "Leaderboard Event Window ID :",
          leaderboardEventWindowId
        );

        if (
          !leaderboardEventId ||
          !leaderboardEventWindowId
        ) {
          console.error(
            "IDs leaderboard manquants."
          );

          return;
        }

        let foundEntry:
          | LeaderboardEntry
          | null = null;

        /*
         * ========================================
         * 1. PAGE MÉMORISÉE
         * ========================================
         *
         * On commence toujours par la dernière
         * page connue.
         */
        if (playerPage !== null) {
          console.log(
            "Page mémorisée :",
            playerPage
          );

          foundEntry =
            await searchPage(
              leaderboardEventId,
              leaderboardEventWindowId,
              playerPage
            );

          if (foundEntry) {
            console.log(
              "Joueur toujours sur la page mémorisée."
            );
          } else {
            console.log(
              "Joueur absent de la page mémorisée."
            );
          }
        }

        /*
         * ========================================
         * 2. PAGES VOISINES
         * ========================================
         *
         * Si le joueur a changé de page, on regarde
         * juste avant et juste après.
         */
        if (
          !foundEntry &&
          playerPage !== null
        ) {
          const previousPage =
            playerPage - 1;

          const nextPage =
            playerPage + 1;

          if (
            previousPage >= 0
          ) {
            await sleep(PAGE_DELAY);

            foundEntry =
              await searchPage(
                leaderboardEventId,
                leaderboardEventWindowId,
                previousPage
              );

            if (foundEntry) {
              playerPage =
                previousPage;

              console.log(
                "Joueur déplacé vers la page :",
                playerPage
              );
            }
          }

          if (
            !foundEntry &&
            nextPage < MAX_PAGES
          ) {
            await sleep(PAGE_DELAY);

            foundEntry =
              await searchPage(
                leaderboardEventId,
                leaderboardEventWindowId,
                nextPage
              );

            if (foundEntry) {
              playerPage =
                nextPage;

              console.log(
                "Joueur déplacé vers la page :",
                playerPage
              );
            }
          }
        }

        /*
         * ========================================
         * 3. RECHERCHE LENTE COMPLÈTE
         * ========================================
         *
         * Si le joueur a énormément bougé,
         * on repart de la page 0.
         */
        if (
          !foundEntry &&
          playerPage === null
        ) {
          foundEntry =
            await fullSearch(
              leaderboardEventId,
              leaderboardEventWindowId
            );
        }

        /*
         * Si on connaissait une ancienne page mais
         * que le joueur n'est plus dessus ni sur les
         * pages voisines, on repart également de zéro.
         */
        if (
          !foundEntry &&
          playerPage !== null
        ) {
          console.log(
            "Le joueur a probablement beaucoup bougé."
          );

          console.log(
            "Nouvelle recherche complète."
          );

          playerPage = null;

          await sleep(PAGE_DELAY);

          foundEntry =
            await fullSearch(
              leaderboardEventId,
              leaderboardEventWindowId
            );
        }

        /*
         * ========================================
         * 4. JOUEUR INTROUVABLE
         * ========================================
         */
        if (!foundEntry) {
          console.warn(
            "Joueur introuvable dans le Top 10 000."
          );

          playerPage = null;

          console.log(
            "Le joueur est considéré comme 10K+."
          );

          if (!cancelled) {
            setStats({
              top: "10K+",
              points: null,
              games: null,
            });
          }

          return;
        }

        /*
         * ========================================
         * 5. CALCUL DES STATISTIQUES
         * ========================================
         */

        const top =
          foundEntry.rank ?? null;

        const points =
          foundEntry.pointsEarned ?? null;

        const games =
          foundEntry.sessionHistory?.filter(
            (session) =>
              session.trackedStats
                ?.MATCH_PLAYED_STAT === 1
          ).length ??
          foundEntry.sessionHistory?.length ??
          null;

        console.log(
          "========================================"
        );

        console.log(
          "STATISTIQUES FINALES"
        );

        console.log({
          username:
            foundEntry.players?.[0]?.username,

          accountId:
            config.epic_account_id,

          page: playerPage,

          top,
          points,
          games,
        });

        console.log(
          "========================================"
        );

        if (!cancelled) {
          setStats({
            top,
            points,
            games,
          });
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "RATE_LIMITED"
        ) {
          console.warn(
            "OSIRION : rate limit atteint."
          );

          console.warn(
            "La prochaine actualisation réessaiera automatiquement."
          );
        } else {
          console.error(
            "Erreur récupération statistiques :",
            error
          );
        }
      } finally {
        requestRunning = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    /*
     * Première recherche immédiatement.
     */
    loadStats();

    /*
     * Ensuite, actualisation toutes les 60 secondes.
     */
    const interval =
      setInterval(
        loadStats,
        UPDATE_INTERVAL
      );

    return () => {
      cancelled = true;

      clearInterval(interval);
    };
  }, [config]);

  if (
    loading ||
    !config
  ) {
    return null;
  }

  return (
    <main className="fixed inset-0 bg-transparent pointer-events-none">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center">
        <span
          className="text-6xl font-bold bg-gradient-to-b from-white to-gray-300 bg-clip-text text-transparent"
        >
          {stats.top ?? "-"}
        </span>

          <span
            className="ml-40 text-6xl font-bold bg-gradient-to-b from-white to-gray-300 bg-clip-text text-transparent"
          >
            {stats.points ?? "-"}
          </span>

        <span
          className="ml-46 text-6xl font-bold bg-gradient-to-b from-white to-gray-300 bg-clip-text text-transparent"
        >
          {stats.games ?? "-"}
        </span>
        </div>
      </div>
    </main>
  );
}