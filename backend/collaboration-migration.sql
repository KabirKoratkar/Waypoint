-- Migration script for Collaboration Features
-- 1. Sharing
CREATE TABLE IF NOT EXISTS public.essay_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    essay_id UUID REFERENCES public.essays(id) ON DELETE CASCADE NOT NULL,
    shared_by UUID REFERENCES public.profiles(id) NOT NULL,
    shared_with_email TEXT NOT NULL,
    permission TEXT DEFAULT 'view', -- "view" or "comment"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Comments
CREATE TABLE IF NOT EXISTS public.essay_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    essay_id UUID REFERENCES public.essays(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Shares
ALTER TABLE public.essay_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage shares" ON public.essay_shares FOR ALL USING (auth.uid() = shared_by);
CREATE POLICY "Recipients can view shared" ON public.essay_shares FOR SELECT USING (shared_with_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- RLS for Comments
ALTER TABLE public.essay_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view comments on shared essays" 
    ON public.essay_comments FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM public.essays WHERE id = essay_id AND user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.essay_shares WHERE essay_id = essay_comments.essay_id AND shared_with_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Users can post comments on shared essays" 
    ON public.essay_comments FOR INSERT 
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.essays WHERE id = essay_id AND user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.essay_shares WHERE essay_id = essay_comments.essay_id AND shared_with_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    );
