import { supabase } from "@/integrations/supabase/client";

export type MarketplaceListing = {
  id: string;
  textbook_id: string;
  seller_id: string;
  title: string;
  description: string;
  subject: string;
  grade: number | null;
  price: number;
  currency: string;
  cover_url: string | null;
  preview_content: any;
  status: "draft" | "published" | "archived";
  downloads: number;
  rating: number;
  rating_count: number;
  created_at: string;
};

export type MarketplaceFilters = {
  search?: string;
  subject?: string;
  grade?: number | null;
  priceMode?: "all" | "free" | "paid";
  minRating?: number;
};

export async function listPublishedListings(
  filters: MarketplaceFilters = {},
): Promise<MarketplaceListing[]> {
  let q = supabase
    .from("marketplace_listings")
    .select("*")
    .eq("status", "published")
    .order("downloads", { ascending: false });

  if (filters.subject) q = q.eq("subject", filters.subject);
  if (filters.grade != null) q = q.eq("grade", filters.grade);
  if (filters.priceMode === "free") q = q.eq("price", 0);
  if (filters.priceMode === "paid") q = q.gt("price", 0);
  if (filters.minRating) q = q.gte("rating", filters.minRating);
  if (filters.search) q = q.ilike("title", `%${filters.search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MarketplaceListing[];
}

export async function getListing(id: string) {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as MarketplaceListing | null;
}

export async function getListingPreview(textbookId: string) {
  // First 2 lessons across topics
  const { data: topics } = await supabase
    .from("textbook_topics" as any)
    .select("id")
    .eq("textbook_id", textbookId);
  const topicIds = (topics ?? []).map((t: any) => t.id);
  if (topicIds.length === 0) return [];
  const { data: lessons } = await supabase
    .from("teacher_textbook_lessons" as any)
    .select("id, title, blocks")
    .in("topic_id", topicIds)
    .limit(2);
  return lessons ?? [];
}

export async function purchaseListing(listing: MarketplaceListing) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Musíš se přihlásit.");
  const { error } = await supabase.from("marketplace_purchases").insert({
    listing_id: listing.id,
    buyer_id: session.user.id,
    price_paid: listing.price,
    currency: listing.currency,
    payment_status: "completed",
  });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function hasPurchased(listingId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase
    .from("marketplace_purchases")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", session.user.id)
    .maybeSingle();
  return !!data;
}

export async function listMyListings(sellerId: string) {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MarketplaceListing[];
}

export async function listReviews(listingId: string) {
  const { data, error } = await supabase
    .from("marketplace_reviews")
    .select("id, rating, comment, created_at, reviewer_id")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addReview(
  listingId: string,
  rating: number,
  comment: string,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Musíš se přihlásit.");
  const { error } = await supabase
    .from("marketplace_reviews")
    .upsert(
      {
        listing_id: listingId,
        reviewer_id: session.user.id,
        rating,
        comment,
      },
      { onConflict: "listing_id,reviewer_id" },
    );
  if (error) throw error;
}
