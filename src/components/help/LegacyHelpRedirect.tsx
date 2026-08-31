import { Navigate, useParams } from "react-router-dom";

/**
 * Přesměruje staré adresy nápovědy (/help/:slug, /pomoc/:slug, /napoveda/clanek/:slug…)
 * na aktuální umístění článku. Pokud slug neodpovídá žádnému článku, dohledání
 * a přívětivé „nenalezeno“ řeší už samotná stránka článku.
 */
export default function LegacyHelpRedirect() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/napoveda" replace />;
  return <Navigate to={`/napoveda/${slug}`} replace />;
}
