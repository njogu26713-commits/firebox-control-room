export const ENV = {
  mongoUri: process.env.MONGODB_URI ?? "",
  mongoDb: process.env.MONGODB_DB ?? "firebox_control_room",
  cookieSecret: process.env.JWT_SECRET ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
