-- Migration script for Connecting Essays and Documents
CREATE TABLE IF NOT EXISTS public.essay_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    essay_id UUID REFERENCES public.essays(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(essay_id, document_id)
);

-- RLS for Essay Documents
ALTER TABLE public.essay_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own essay links" 
    ON public.essay_documents FOR ALL 
    USING (
        EXISTS (SELECT 1 FROM public.essays WHERE id = essay_id AND user_id = auth.uid())
    );
