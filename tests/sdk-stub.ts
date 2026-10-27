// Stands in for the host-served SDK during unit tests; tests inject a fake runtime with setRuntime().
export const AnnaAppRuntime = {
  connect: async () => {
    throw new Error("No Anna host in unit tests");
  },
};
