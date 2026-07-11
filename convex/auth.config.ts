import { siteUrl } from "@convex-dev/auth/server";

export default {
  providers: [{ domain: siteUrl(), applicationID: "convex" }],
};
