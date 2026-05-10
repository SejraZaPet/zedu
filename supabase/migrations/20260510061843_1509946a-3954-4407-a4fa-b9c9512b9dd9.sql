
-- Marketplace listings
CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id uuid NOT NULL REFERENCES public.teacher_textbooks(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  grade integer,
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  cover_url text,
  preview_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  downloads integer NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(textbook_id)
);

CREATE INDEX idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_seller ON public.marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_listings_subject ON public.marketplace_listings(subject);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view published listings"
  ON public.marketplace_listings FOR SELECT
  TO authenticated
  USING (status = 'published' OR seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "Sellers can insert their own listings"
  ON public.marketplace_listings FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND public.owns_textbook(textbook_id, auth.uid())
  );

CREATE POLICY "Sellers can update their own listings"
  ON public.marketplace_listings FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "Sellers can delete their own listings"
  ON public.marketplace_listings FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

CREATE TRIGGER trg_update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marketplace purchases
CREATE TABLE public.marketplace_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  price_paid numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  payment_status text NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending','completed','failed','refunded')),
  stripe_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, buyer_id)
);

CREATE INDEX idx_marketplace_purchases_buyer ON public.marketplace_purchases(buyer_id);
CREATE INDEX idx_marketplace_purchases_listing ON public.marketplace_purchases(listing_id);

ALTER TABLE public.marketplace_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view their purchases"
  ON public.marketplace_purchases FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_listings ml
      WHERE ml.id = listing_id AND ml.seller_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "Authenticated users can insert their own purchases"
  ON public.marketplace_purchases FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

-- Increment downloads counter when purchase succeeds
CREATE OR REPLACE FUNCTION public.bump_listing_downloads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'completed' THEN
    UPDATE public.marketplace_listings
    SET downloads = downloads + 1
    WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_listing_downloads
  AFTER INSERT ON public.marketplace_purchases
  FOR EACH ROW EXECUTE FUNCTION public.bump_listing_downloads();

-- Marketplace reviews
CREATE TABLE public.marketplace_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, reviewer_id)
);

CREATE INDEX idx_marketplace_reviews_listing ON public.marketplace_reviews(listing_id);

ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reviews"
  ON public.marketplace_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Buyers can insert reviews for their purchases"
  ON public.marketplace_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.marketplace_purchases mp
      WHERE mp.listing_id = marketplace_reviews.listing_id
        AND mp.buyer_id = auth.uid()
        AND mp.payment_status = 'completed'
    )
  );

CREATE POLICY "Reviewers can update their reviews"
  ON public.marketplace_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid());

CREATE POLICY "Reviewers can delete their reviews"
  ON public.marketplace_reviews FOR DELETE
  TO authenticated
  USING (reviewer_id = auth.uid() OR public.is_admin());

-- Recompute aggregate rating
CREATE OR REPLACE FUNCTION public.recompute_listing_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lid uuid := COALESCE(NEW.listing_id, OLD.listing_id);
  _avg numeric;
  _count integer;
BEGIN
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO _avg, _count
  FROM public.marketplace_reviews
  WHERE listing_id = _lid;

  UPDATE public.marketplace_listings
  SET rating = ROUND(_avg, 2), rating_count = _count
  WHERE id = _lid;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recompute_listing_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_listing_rating();

-- Practice recommendations (RAG output)
CREATE TABLE public.student_practice_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  lesson_id uuid,
  weak_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text NOT NULL DEFAULT '',
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_practice_recs_student ON public.student_practice_recommendations(student_id);

ALTER TABLE public.student_practice_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own recommendations"
  ON public.student_practice_recommendations FOR ALL
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin())
  WITH CHECK (student_id = auth.uid());
