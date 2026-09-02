import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two build targets from one codebase:
//
//   npm run build      -> PWA served by the PC's backend at /m
//                         (absolute /m/ base, output into server/public/m)
//   npm run build:app  -> assets bundled into the Android APK
//                         (relative base, output into android/app/src/main/assets/www)
//
// The APK build needs a RELATIVE base because its assets are served from
// the app's own asset loader origin, not from a /m path on a server.
export default defineConfig(({ mode }) => {
  const isApp = mode === "app";

  return {
    plugins: [react()],
    base: isApp ? "./" : "/m/",
    build: {
      outDir: isApp ? "../android/app/src/main/assets/www" : "../server/public/m",
      emptyOutDir: true,
    },
    server: {
      port: 5174,
      host: true,
      proxy: {
        "/api": { target: "http://localhost:4001", changeOrigin: true },
      },
    },
  };
});
