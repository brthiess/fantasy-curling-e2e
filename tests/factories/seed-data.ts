import { ObjectId } from "mongodb";

const createObjectId = (hex: string): ObjectId => new ObjectId(hex);

export const seedIds = {
  users: {
    main: createObjectId("65f000000000000000000001"),
    challenger: createObjectId("65f000000000000000000002")
  },
  tournaments: {
    open: createObjectId("65f000000000000000000101"),
    upcoming: createObjectId("65f000000000000000000102"),
    closed: createObjectId("65f000000000000000000103")
  },
  teams: {
    gushue: createObjectId("65f000000000000000000201"),
    bottcher: createObjectId("65f000000000000000000202"),
    dunstone: createObjectId("65f000000000000000000203"),
    koe: createObjectId("65f000000000000000000204"),
    jacobs: createObjectId("65f000000000000000000205"),
    mcEwen: createObjectId("65f000000000000000000206"),
    carruthers: createObjectId("65f000000000000000000207"),
    eddin: createObjectId("65f000000000000000000208")
  }
} as const;

export const smokeUser = {
  email: "test@example.com",
  username: "testuser",
  password: "Password123!",
  realName: "Test User",
  teamName: "Brad Test Rink"
} as const;

export const seededPicksOrder = [
  seedIds.teams.gushue,
  seedIds.teams.dunstone,
  seedIds.teams.koe,
  seedIds.teams.jacobs,
  seedIds.teams.mcEwen,
  seedIds.teams.bottcher
] as const;

export const deterministicNowIso = "2026-02-10T15:00:00.000Z";
