import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";

export type MongoRuntimeStrategy = "testcontainers" | "external-mongo-url";

export type StartedMongoRuntime = {
  mongoUrl: string;
  mongoContainerId?: string;
  strategy: MongoRuntimeStrategy;
  stop: () => Promise<void>;
};

export async function startIsolatedMongoContainer(options?: {
  externalMongoUrl?: string;
}): Promise<StartedMongoRuntime> {
  try {
    const container: StartedTestContainer = await new GenericContainer("mongo:7")
      .withExposedPorts(27017)
      .withWaitStrategy(Wait.forLogMessage("Waiting for connections"))
      .start();

    const mongoUrl = `mongodb://${container.getHost()}:${container.getMappedPort(
      27017
    )}`;

    return {
      mongoUrl,
      mongoContainerId: container.getId(),
      strategy: "testcontainers",
      stop: async () => {
        await container.stop();
      }
    };
  } catch (error) {
    if (options?.externalMongoUrl) {
      return {
        mongoUrl: options.externalMongoUrl,
        strategy: "external-mongo-url",
        stop: async () => Promise.resolve()
      };
    }

    const rootCause =
      error instanceof Error ? error.message : "Unknown container runtime error";
    throw new Error(
      `Unable to start Testcontainers Mongo runtime. Ensure Docker/Podman is running, or set MONGO_URL in .env to use an external Mongo instance. Root cause: ${rootCause}`
    );
  }
}
