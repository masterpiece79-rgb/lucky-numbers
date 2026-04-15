import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "lucky-numbers",
  brand: {
    displayName: "행운의 번호",
    primaryColor: "#FFD700",
    icon: "./public/icon.png",
  },
  web: {
    host: "localhost",
    port: 5180,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
