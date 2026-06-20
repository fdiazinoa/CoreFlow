-- Create future features table
CREATE TABLE IF NOT EXISTS public.future_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL, -- 'bajo', 'medio', 'alto', 'critico'
    feature_type TEXT NOT NULL, -- 'funcionalidad', 'mejora', 'optimizacion', 'refactor'
    effort TEXT NOT NULL, -- 'bajo', 'medio', 'alto', 'muy_alto'
    status TEXT NOT NULL DEFAULT 'idea', -- 'idea', 'analisis', 'aprobado', 'desarrollo', 'completado', 'descartado'
    impact TEXT NOT NULL DEFAULT 'medio', -- 'bajo', 'medio', 'alto'
    upvotes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT -- email of user
);

-- Enable RLS
ALTER TABLE public.future_features ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.future_features;
CREATE POLICY "Allow select for authenticated users" 
ON public.future_features FOR SELECT 
TO authenticated 
USING (true);

-- All operations policy
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.future_features;
CREATE POLICY "Allow all operations for authenticated users" 
ON public.future_features FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

