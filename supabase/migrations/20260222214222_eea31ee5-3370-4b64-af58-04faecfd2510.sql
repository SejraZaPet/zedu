-- Add status column to articles table
ALTER TABLE public.articles ADD COLUMN status text NOT NULL DEFAULT 'published';

-- Update existing RLS policies for the status column (no changes needed, existing policies cover all columns)
