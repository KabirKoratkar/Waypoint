-- Add Sample Colleges with Deadlines for Calendar Testing
-- Run this in your Supabase SQL Editor after logging in as a user

-- Note: Replace 'YOUR_USER_ID_HERE' with your actual user ID from the profiles table
-- You can get your user ID by running: SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- First, let's create a variable for the user ID (you'll need to replace this)
-- For testing, you can run: SELECT id FROM profiles LIMIT 1;

-- Insert the 8 colleges with their deadlines
INSERT INTO public.colleges (user_id, name, application_platform, deadline, deadline_type, test_policy, lors_required, portfolio_required, status, essays_required)
VALUES
    -- Stanford University
    (
        (SELECT id FROM profiles LIMIT 1),
        'Stanford University',
        'Common App',
        '2025-01-05',
        'RD',
        'Test Optional',
        2,
        false,
        'Not Started',
        '[
            {"title": "Common App Personal Statement", "word_limit": 650},
            {"title": "What Matters to You", "word_limit": 250},
            {"title": "Why Stanford", "word_limit": 250},
            {"title": "Roommate Letter", "word_limit": 250}
        ]'::jsonb
    ),
    
    -- MIT
    (
        (SELECT id FROM profiles LIMIT 1),
        'Massachusetts Institute of Technology',
        'Common App',
        '2025-01-01',
        'RD',
        'Test Flexible',
        2,
        false,
        'Not Started',
        '[
            {"title": "Common App Personal Statement", "word_limit": 650},
            {"title": "Alignment with MIT", "word_limit": 200},
            {"title": "Community Essay", "word_limit": 100}
        ]'::jsonb
    ),
    
    -- USC
    (
        (SELECT id FROM profiles LIMIT 1),
        'University of Southern California',
        'Common App',
        '2025-01-15',
        'RD',
        'Test Optional',
        1,
        false,
        'Not Started',
        '[
            {"title": "Common App Personal Statement", "word_limit": 650},
            {"title": "USC Short Answer 1", "word_limit": 250},
            {"title": "USC Short Answer 2", "word_limit": 100}
        ]'::jsonb
    ),
    
    -- Arizona State University
    (
        (SELECT id FROM profiles LIMIT 1),
        'Arizona State University',
        'Common App',
        '2025-02-01',
        'RD',
        'Test Optional',
        0,
        false,
        'In Progress',
        '[
            {"title": "Common App Personal Statement", "word_limit": 650},
            {"title": "ASU Honors Essay (Optional)", "word_limit": 500}
        ]'::jsonb
    ),
    
    -- University of Mississippi (Ole Miss)
    (
        (SELECT id FROM profiles LIMIT 1),
        'University of Mississippi',
        'Common App',
        '2025-02-01',
        'RD',
        'Test Optional',
        0,
        false,
        'In Progress',
        '[
            {"title": "Common App Personal Statement", "word_limit": 650},
            {"title": "Ole Miss Short Answer", "word_limit": 250}
        ]'::jsonb
    ),
    
    -- University of Connecticut (UConn)
    (
        (SELECT id FROM profiles LIMIT 1),
        'University of Connecticut',
        'Common App',
        '2025-01-15',
        'RD',
        'Test Optional',
        1,
        false,
        'Not Started',
        '[
            {"title": "Common App Personal Statement", "word_limit": 650},
            {"title": "UConn Supplement", "word_limit": 250}
        ]'::jsonb
    ),
    
    -- University of San Diego
    (
        (SELECT id FROM profiles LIMIT 1),
        'University of San Diego',
        'Common App',
        '2025-01-15',
        'RD',
        'Test Optional',
        1,
        false,
        'Not Started',
        '[
            {"title": "Common App Personal Statement", "word_limit": 650},
            {"title": "USD Supplement", "word_limit": 300}
        ]'::jsonb
    ),
    
    -- Washington State University
    (
        (SELECT id FROM profiles LIMIT 1),
        'Washington State University',
        'Common App',
        '2025-01-31',
        'RD',
        'Test Optional',
        0,
        false,
        'Not Started',
        '[
            {"title": "Common App Personal Statement", "word_limit": 650},
            {"title": "WSU Honors Essay (Optional)", "word_limit": 500}
        ]'::jsonb
    );

-- Add some sample tasks to populate the calendar with more events
INSERT INTO public.tasks (user_id, college_id, title, description, due_date, category, priority, completed)
VALUES
    -- Tasks for Stanford
    (
        (SELECT id FROM profiles LIMIT 1),
        (SELECT id FROM colleges WHERE name = 'Stanford University' LIMIT 1),
        'Complete Stanford Supplements',
        'Finish all 3 short answer questions (50 words each)',
        '2024-12-28',
        'Essay',
        'High',
        false
    ),
    (
        (SELECT id FROM profiles LIMIT 1),
        (SELECT id FROM colleges WHERE name = 'Stanford University' LIMIT 1),
        'Request Letters of Recommendation',
        'Ask teachers for 2 LORs for Stanford',
        '2024-12-22',
        'LOR',
        'High',
        false
    ),
    
    -- Tasks for MIT
    (
        (SELECT id FROM profiles LIMIT 1),
        (SELECT id FROM colleges WHERE name = 'Massachusetts Institute of Technology' LIMIT 1),
        'MIT Maker Portfolio',
        'Upload maker portfolio showcasing projects',
        '2024-12-27',
        'Document',
        'High',
        false
    ),
    
    -- Tasks for ASU
    (
        (SELECT id FROM profiles LIMIT 1),
        (SELECT id FROM colleges WHERE name = 'Arizona State University' LIMIT 1),
        'Submit Transcript to ASU',
        'Request official transcript from school',
        '2025-01-25',
        'Document',
        'Medium',
        false
    ),
    
    -- General tasks
    (
        (SELECT id FROM profiles LIMIT 1),
        NULL,
        'Finalize Common App Essay',
        'Final edits and proofreading for Common App personal statement',
        '2024-12-26',
        'Essay',
        'High',
        false
    ),
    (
        (SELECT id FROM profiles LIMIT 1),
        NULL,
        'Update Activities List',
        'Add recent activities and achievements to Common App',
        '2024-12-24',
        'General',
        'Medium',
        false
    );

-- Verify the data was inserted
SELECT name, deadline, deadline_type FROM colleges ORDER BY deadline;
SELECT title, due_date, category FROM tasks ORDER BY due_date;
