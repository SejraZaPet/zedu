import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Cesty, na které odkazují „Navržené Bezli aktivity“, ověřené proti App.tsx.
 * Kdyby se některá cesta smazala nebo přejmenovala, test spadne místo 404 v appce.
 */
const appTsx = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");

export const ACTIVITY_ROUTES_EXIST = [
  "/aktivity",
  "/ucitel/hry",
  "/ucitel/pracovni-listy/:id",
  "/live/ucitel/:sessionId",
].filter((p) => appTsx.includes(`path="${p}"`));

export const APP_ROUTES_SOURCE = appTsx;
