import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { rememberSchoolSlug } from "@/hooks/useSchoolBranding";

/**
 * Vstupní bod školního portálu přes cestu: /s/:slug
 * Slug si zapamatujeme pro celou session a přesměrujeme na přihlášení,
 * kde se už použije branding školy (logo, barva, uvítací text).
 */
const SchoolEntry = () => {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (slug) rememberSchoolSlug(slug.toLowerCase());
  }, [slug]);

  if (!slug) return <Navigate to="/" replace />;
  rememberSchoolSlug(slug.toLowerCase());
  return <Navigate to="/auth" replace />;
};

export default SchoolEntry;
