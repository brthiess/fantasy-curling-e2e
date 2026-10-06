import { MongoClient } from "mongodb";
import {
  deterministicNowIso,
  seedIds,
  seededPicksOrder,
  smokeUser
} from "../tests/factories/seed-data";

export async function seedMongoDatabase(mongoUrl: string): Promise<void> {
  const client = new MongoClient(mongoUrl);
  await client.connect();

  const db = client.db("curling_test");
  const Users = db.collection("Users");
  const Tournaments = db.collection("Tournaments");
  const Teams = db.collection("Teams");

  await Promise.all([
    Users.deleteMany({}),
    Tournaments.deleteMany({}),
    Teams.deleteMany({})
  ]);

  await Teams.insertMany([
    {
      _id: seedIds.teams.gushue,
      name: "Team Gushue",
      countryCode: "CA",
      pointsPerWin: 1.4,
      wins: 3,
      pool: "A"
    },
    {
      _id: seedIds.teams.bottcher,
      name: "Team Bottcher",
      countryCode: "CA",
      pointsPerWin: 1.2,
      wins: 4,
      pool: "A"
    },
    {
      _id: seedIds.teams.dunstone,
      name: "Team Dunstone",
      countryCode: "CA",
      pointsPerWin: 1.3,
      wins: 2,
      pool: "B"
    },
    {
      _id: seedIds.teams.koe,
      name: "Team Koe",
      countryCode: "CA",
      pointsPerWin: 1.1,
      wins: 5,
      pool: "B"
    },
    {
      _id: seedIds.teams.jacobs,
      name: "Team Jacobs",
      countryCode: "CA",
      pointsPerWin: 1.15,
      wins: 4,
      pool: "A"
    },
    {
      _id: seedIds.teams.mcEwen,
      name: "Team McEwen",
      countryCode: "CA",
      pointsPerWin: 1.05,
      wins: 3,
      pool: "B"
    },
    {
      _id: seedIds.teams.carruthers,
      name: "Team Carruthers",
      countryCode: "CA",
      pointsPerWin: 0.95,
      wins: 2,
      pool: "A"
    },
    {
      _id: seedIds.teams.eddin,
      name: "Team Edin",
      countryCode: "SE",
      pointsPerWin: 1.0,
      wins: 1,
      pool: "B"
    }
  ]);

  await Tournaments.insertMany([
    {
      _id: seedIds.tournaments.open,
      name: "Test Brier 2026",
      teams: Object.values(seedIds.teams),
      type: "weighted-wins",
      totalNumberOfPicksToMake: 6,
      tournamentRegistrationStatus: "open",
      hasPools: true,
      startsAt: "2026-02-20T14:00:00.000Z"
    },
    {
      _id: seedIds.tournaments.upcoming,
      name: "Test Scotties 2026",
      teams: Object.values(seedIds.teams),
      type: "weighted-wins",
      totalNumberOfPicksToMake: 6,
      tournamentRegistrationStatus: "upcoming",
      hasPools: true,
      startsAt: "2026-03-01T14:00:00.000Z"
    },
    {
      _id: seedIds.tournaments.closed,
      name: "Test Trials 2025",
      teams: Object.values(seedIds.teams),
      type: "weighted-wins",
      totalNumberOfPicksToMake: 6,
      tournamentRegistrationStatus: "closed",
      hasPools: false,
      startsAt: "2025-11-01T14:00:00.000Z"
    }
  ]);

  await Users.insertMany([
    {
      _id: seedIds.users.main,
      username: smokeUser.username,
      teamName: smokeUser.teamName,
      backgroundColor: "#001e51",
      privateUserData: {
        email: smokeUser.email,
        realName: smokeUser.realName,
        keycloakId: "test-keycloak-id"
      },
      tournaments: [
        {
          tournamentId: seedIds.tournaments.open,
          currentUserTournamentData: {
            userTournamentRegistrationStatus: "registered",
            picks: seededPicksOrder.map((teamId) => ({ teamId })),
            bracket: null,
            id: ""
          }
        }
      ],
      leaderboardScore: 22.1,
      createdAt: deterministicNowIso,
      updatedAt: deterministicNowIso
    },
    {
      _id: seedIds.users.challenger,
      username: "challenger",
      teamName: "Skip Challenger",
      backgroundColor: "#870024",
      privateUserData: {
        email: "challenger@example.com",
        realName: "Challenger User",
        keycloakId: "challenger-keycloak-id"
      },
      tournaments: [
        {
          tournamentId: seedIds.tournaments.open,
          currentUserTournamentData: {
            userTournamentRegistrationStatus: "registered",
            picks: [
              { teamId: seedIds.teams.bottcher },
              { teamId: seedIds.teams.koe },
              { teamId: seedIds.teams.jacobs },
              { teamId: seedIds.teams.mcEwen },
              { teamId: seedIds.teams.carruthers },
              { teamId: seedIds.teams.eddin }
            ],
            bracket: null,
            id: ""
          }
        }
      ],
      leaderboardScore: 19.7,
      createdAt: deterministicNowIso,
      updatedAt: deterministicNowIso
    }
  ]);

  await client.close();
}

export async function assertSeedCollections(mongoUrl: string): Promise<void> {
  const client = new MongoClient(mongoUrl);
  await client.connect();

  const db = client.db("curling_test");
  const [usersCount, tournamentsCount, teamsCount] = await Promise.all([
    db.collection("Users").countDocuments(),
    db.collection("Tournaments").countDocuments(),
    db.collection("Teams").countDocuments()
  ]);

  await client.close();

  if (usersCount < 2 || tournamentsCount < 3 || teamsCount < 8) {
    throw new Error(
      `Seed validation failed. Users=${usersCount}, Tournaments=${tournamentsCount}, Teams=${teamsCount}`
    );
  }
}
