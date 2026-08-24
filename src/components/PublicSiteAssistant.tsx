import { useLocation } from "react-router-dom";
import WebsiteAssistantChat from "./WebsiteAssistantChat";

/** Veřejné (marketingové) stránky, kde se zobrazuje Bezlai asistent webu. */
const PUBLIC_PATHS = ["/", "/licence", "/gdpr", "/aktivity", "/napoveda"];
const PUBLIC_PREFIXES = ["/napoveda/", "/podcast/"];

export default function PublicSiteAssistant() {
  const { pathname } = useLocation();
  const isPublic =
    PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isPublic) return null;
  return <WebsiteAssistantChat />;
}
