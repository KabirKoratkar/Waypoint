// AI Server for Waypoint
// Handles AI chat, college research, and application management

process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { Resend } from 'resend';
import paymentsRouter from './payments.js';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_CATALOG_PATH = path.join(__dirname, 'college_catalog.json');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// PRE-FLIGHT DIAGNOSTICS
console.log('--- Waypoint Backend Startup ---');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port Configuration:', PORT);

// Validate Required Env Vars (Prevent Crashes)
const requiredVars = ['PORT', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY'];
requiredVars.forEach(v => {
    if (!process.env[v]) {
        console.warn(`⚠️  Warning: Missing environment variable ${v}`);
    } else {
        console.log(`✅ ${v} is configured`);
    }
});


// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Anthropic
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
    try {
        anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        console.log('✅ Anthropic SDK initialized');
    } catch (e) {
        console.error('❌ Anthropic SDK failed to initialize:', e.message);
    }
}

// Initialize Supabase with service key (for server-side operations)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize Cache
const apiCache = new NodeCache({ stdTTL: 14400, checkperiod: 3600 });

// Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Increased for scenarios like coffee shops with shared IPs
    message: { error: 'Too many requests, please slow down.' }
});

const researchLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { error: 'Research limit reached. Please wait an hour.' }
});

app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
    if (req.originalUrl === '/api/payments/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

app.use('/api/payments', paymentsRouter);
// Health Checks (Defined before limiter to avoid false negatives)
app.get('/', (req, res) => res.json({ status: 'ok', service: 'waypoint-ai', timestamp: new Date().toISOString() }));
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: 'v3.1',
        services: {
            openai: !!process.env.OPENAI_API_KEY,
            stripe: !!process.env.STRIPE_SECRET_KEY,
            supabase: !!process.env.SUPABASE_SERVICE_KEY,
            anthropic: !!process.env.ANTHROPIC_API_KEY
        },
        infrastructure: 'Railway + Supabase'
    });
});
app.get('/health', (req, res) => res.json({ status: 'ok', stripe: !!process.env.STRIPE_SECRET_KEY }));

app.use('/api/', globalLimiter);

// Feedback and Tickets
app.post('/api/feedback', async (req, res) => {
    try {
        const { userId, email, subject, message, type } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const { data, error } = await supabase
            .from('tickets')
            .insert([{
                user_id: userId || null,
                user_email: email,
                subject: subject || `New ${type || 'Feedback'}`,
                message: message,
                type: type || 'Feedback',
                status: 'Open'
            }])
            .select();

        if (resend) {
            await resend.emails.send({
                from: 'Waypoint <onboarding@resend.dev>',
                to: ['kabirvideo@gmail.com'],
                subject: `[Waypoint Beta] ${type || 'Feedback'}: ${subject || 'No Subject'}`,
                html: `<p><strong>From:</strong> ${email || 'Anonymous'}</p><p>${message}</p>`
            }).catch(e => console.error('Email failed:', e));
        }

        res.json({ success: true, ticketId: data?.[0]?.id });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// College Research Endpoint
app.get('/api/colleges/research', researchLimiter, async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ error: 'College name is required' });

        const cacheKey = `research_${name.toLowerCase().trim()}`;
        const cached = apiCache.get(cacheKey);
        if (cached) return res.json(cached);

        const research = await handleResearchCollege(name);
        apiCache.set(cacheKey, research);
        res.json(research);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Handle Claude Chat (Claude 3.5 Sonnet)
 */
app.post('/api/chat/claude', async (req, res) => {
    try {
        const { message, userId, conversationHistory = [], saveToHistory = true } = req.body;
        if (!anthropic) return res.status(503).json({ error: 'Claude service not configured' });
        if (!message || !userId) return res.status(400).json({ error: 'Message and userId are required' });

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

        const systemPrompt = `You are the Claude-powered Intelligence Command Center for ${profile?.full_name || 'this student'}.
        Your goal is to provide high-level strategic reasoning and deep essay analysis.
        Be sophisticated, insightful, and proactive.
        
        Student Context:
        Name: ${profile?.full_name || 'Unknown'}
        Major: ${profile?.intended_major || 'Undecided'}
        Grad Year: ${profile?.graduation_year || 'Unknown'}`;

        const messages = conversationHistory
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));
        messages.push({ role: 'user', content: message });

        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 1536,
            system: systemPrompt,
            messages: messages,
        });

        const aiResponse = response.content[0].text;
        await saveConversation(userId, message, aiResponse, { model: 'claude-3.5-sonnet' });

        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Claude error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/colleges/add', async (req, res) => {
    try {
        const { userId, collegeName, type } = req.body;
        if (!userId || !collegeName) return res.status(400).json({ error: 'userId and collegeName are required' });
        const result = await handleAddCollege(userId, collegeName, type);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Onboarding Plan Generation
app.post('/api/onboarding/plan', async (req, res) => {
    try {
        const { userId, colleges, profile } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        if (!openai) {
            console.warn('⚠️ OpenAI not configured for plan generation');
            return res.status(503).json({ error: 'AI service unavailable' });
        }

        console.log(`🧠 Generating Admissions Action Plan for student...`);

        const systemPrompt = `You are an elite college admissions strategist. Your goal is to generate a highly customized, 3-month "Admissions Action Plan" for a student.

        Student Profile:
        - Name: ${profile.full_name}
        - Intended Major: ${profile.intended_major || 'Undecided'}
        - Graduation Year: ${profile.graduation_year}
        - Colleges Interest: ${colleges.join(', ') || 'General Search'}
        - Submission Target: ${profile.submission_leeway} days before actual deadlines.

        The plan should be professional, motivating, and highly specific.
        
        Return a strictly valid JSON object with this structure:
        {
            "plan": {
                "summary": "A 2-sentence executive summary of their specific strategic advantage and focus.",
                "tasks": [
                    {
                        "title": "Clear action-oriented title (e.g., 'Draft Harvard Personal Statement')",
                        "description": "Short, tactical instruction on HOW to do this well.",
                        "dueDate": "YYYY-MM-DD",
                        "category": "Essay",
                        "priority": "High"
                    }
                ]
            }
        }

        Generate exactly 5-6 high-impact tasks. Distribute them across the next 3 months. Assume the current date is ${new Date().toLocaleDateString()}.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate my admissions action plan." }
            ],
            response_format: { type: "json_object" }
        });

        const planData = JSON.parse(completion.choices[0].message.content);
        res.json(planData);

    } catch (error) {
        console.error('Plan Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate plan' });
    }
});

// GET APPLICATION STATUS (Proxy for Auth0/Dev users)
app.get('/api/app-status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`📡 Fetching app status for user: ${userId}`);

        const [collegesResult, tasksResult, essaysResult, activitiesResult, awardsResult] = await Promise.all([
            supabase.from('colleges').select('*').eq('user_id', userId),
            supabase.from('tasks').select('*').eq('user_id', userId),
            supabase.from('essays').select('*').eq('user_id', userId),
            supabase.from('activities').select('*').eq('user_id', userId),
            supabase.from('awards').select('*').eq('user_id', userId)
        ]);

        const colleges = collegesResult.data || [];
        const essays = (essaysResult.data || []).map(essay => {
            // Robust ID matching
            const college = colleges.find(c => c.id === essay.college_id);
            return {
                ...essay,
                colleges: college ? {
                    id: college.id,
                    name: college.name,
                    application_platform: college.application_platform
                } : null
            };
        });

        res.json({
            success: true,
            data: {
                colleges,
                tasks: tasksResult.data || [],
                essays,
                activities: activitiesResult.data || [],
                awards: awardsResult.data || []
            }
        });
    } catch (error) {
        console.error('App Status Error:', error);
        res.status(500).json({ error: 'Failed to fetch app status' });
    }
});

app.post('/api/essays/sync', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const { data: colleges } = await supabase.from('colleges').select('*').eq('user_id', userId);
        if (!colleges) return res.json({ success: true, count: 0 });

        let totalCreated = 0;
        for (const college of colleges) {
            const result = await handleCreateEssays(userId, college.name);
            if (result.success) totalCreated += (result.count || 0);
        }

        res.json({ success: true, count: totalCreated });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/colleges/research-deep', researchLimiter, async (req, res) => {
    try {
        const { userId, collegeName } = req.body;
        if (!collegeName) return res.status(400).json({ error: 'collegeName is required' });

        console.log(`[DEEP RESEARCH] Generating Intelligence Report for ${collegeName}`);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{
                role: 'system',
                content: `Generate a comprehensive "Intelligence Report" for ${collegeName}.
                You are a senior admissions insider with specialized knowledge of this specific university.

                Format the response as a JSON object with this exact structure:
                {
                  "college": "${collegeName}",
                  "summary": "A 1-2 sentence high-level executive summary.",
                  "modules": {
                    "academics": {
                      "headline": "Intellectual Climate",
                      "items": [
                        { "title": "Academic Rigor", "content": "..." },
                        { "title": "Unique Programs", "content": "..." }
                      ]
                    },
                    "culture": {
                      "headline": "Campus Life & Values",
                      "items": [
                        { "title": "Student Vibe", "content": "..." },
                        { "title": "Core Values", "content": "..." }
                      ]
                    },
                    "career": {
                      "headline": "Post-Grad Intelligence",
                      "items": [
                        { "title": "Industry Pipelines", "content": "..." },
                        { "title": "Network Strength", "content": "..." }
                      ]
                    },
                    "admissions": {
                      "headline": "Admissions Insider",
                      "items": [
                        { "title": "What They Look For", "content": "..." },
                        { "title": "Essay Strategy", "content": "..." }
                      ]
                    },
                    "edge": {
                      "content": "Specific actionable advice to win."
                    }
                  }
                }`
            }],
            response_format: { type: "json_object" }
        });

        const findings = JSON.parse(completion.choices[0].message.content);
        res.json({ success: true, findings });
    } catch (error) {
        console.error('Deep Research Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GENERIC TOPIC RESEARCH ENDPOINT
app.post('/api/resources/research', researchLimiter, async (req, res) => {
    try {
        const { topic, userId } = req.body;
        if (!topic) return res.status(400).json({ error: 'Topic required' });

        console.log(`🧠 Converting topic '${topic}' into intelligence report...`);

        // Check cache
        const cacheKey = `topic_research_${topic.toLowerCase().replace(/\s/g, '_')}`;
        const cached = apiCache.get(cacheKey);
        if (cached) {
            console.log('⚡ Using cached research');
            return res.json({ success: true, findings: cached });
        }

        if (!openai) throw new Error('AI not initialized');

        const systemPrompt = `You are an elite college counseling strategist and knowledge base. Your goal is to provide a comprehensive, structured "Intelligence Report" on ANY topic related to college admissions (e.g., "Common App", "FAFSA", "Stanford Legacy Policy", "QuestBridge").

        Return a strictly valid JSON object with the following structure:
        {
            "topic": "${topic}",
            "summary": "A concise, 2-3 sentence executive summary of what this is.",
            "modules": {
                "overview": {
                    "headline": "What You Need to Know",
                    "items": [
                        { "title": "Core Concept", "content": "..." },
                        { "title": "Who It's For", "content": "..." }
                    ]
                },
                "details": {
                    "headline": "Deep Dive & Facts",
                    "items": [
                        { "title": "Key Fact 1", "content": "..." },
                        { "title": "Timeline/Deadlines", "content": "..." }
                    ]
                },
                "action": {
                    "headline": "Action Plan",
                    "items": [
                        { "title": "Step 1", "content": "..." },
                        { "title": "Step 2", "content": "..." }
                    ]
                },
                "edge": {
                    "content": "A pro-tip 'Insider Edge' paragraph giving strategic advice others might miss."
                }
            }
        }`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Research topic: ${topic}` }
            ],
            response_format: { type: "json_object" }
        });

        const findings = JSON.parse(completion.choices[0].message.content);
        apiCache.set(cacheKey, findings);

        res.json({ success: true, findings });

    } catch (error) {
        console.error('Topic Research Error:', error);
        res.status(500).json({ error: 'Failed to research topic' });
    }
});


// [Deleted legacy Claude endpoint]

// ElevenLabs Text-to-Speech Endpoint
app.post('/api/tts', async (req, res) => {
    try {
        const { text, voiceId } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const apiKey = process.env.ELEVENLABS_API_KEY;
        const selectedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail?.message || 'ElevenLabs API error');
        }

        const audioBuffer = await response.arrayBuffer();
        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('TTS Error:', error);
        res.status(500).json({ error: 'Text-to-speech failed', details: error.message });
    }
});

// Main AI chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, userId, conversationHistory = [], saveToHistory = true } = req.body;

        if (!message || !userId) {
            return res.status(400).json({ error: 'Message and userId are required' });
        }

        // Fetch user profile for personalization using SUPABASE
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        const profileContext = profile ?
            `You are talking to ${profile.full_name || 'a student'}.
             Graduation Year: ${profile.graduation_year || 'Unknown'}
             Intended Major: ${profile.intended_major || 'Undecided'}
             Academic Stats: GPA: ${profile.unweighted_gpa || 'N/A'} (UW) / ${profile.weighted_gpa || 'N/A'} (W). SAT: ${profile.sat_score || 'N/A'}. ACT: ${profile.act_score || 'N/A'}.
             Location: ${profile.location || 'Unknown'}` : '';

        // Fetch user app state for deep context using SUPABASE
        const { data: colleges } = await supabase.from('colleges').select('*').eq('user_id', userId);
        const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('completed', false);
        const { data: essays } = await supabase.from('essays').select('id, title, college_id, word_count, is_completed').eq('user_id', userId);
        const { data: activities } = await supabase.from('activities').select('*').eq('user_id', userId).order('position', { ascending: true });
        const { data: awards } = await supabase.from('awards').select('*').eq('user_id', userId).order('position', { ascending: true });

        const appStateContext = `
            CURRENT COLLEGE LIST: ${colleges?.map(c => `${c.name} (${c.type})`).join(', ') || 'None'}
            ACTIVE TASKS: ${tasks?.length || 0} tasks pending.
            ESSAYS: ${essays?.map(e => `${e.title} (${e.word_count} words)`).join(', ') || 'None'}
            ACTIVITIES (ECs): ${activities?.map(a => `${a.title} @ ${a.organization}`).join(', ') || 'None'}
            AWARDS/HONORS: ${awards?.map(aw => `${aw.title} (${aw.level})`).join(', ') || 'None'}
        `;

        // Build conversation messages for OpenAI
        const messages = [
            {
                role: 'system',
                content: `You are the central "Intelligence Command Center" for ${profile?.full_name || 'this student'}'s college application process. You have ABSOLUTE access to view and manipulate their entire application ecosystem.
                
                MISSION: Proactively manage their profile, schedule, and essays. YOU ARE AN ELITE ADMISSIONS COACH.

                CONVERSATIONAL STYLE:
                1. ASK ONLY ONE QUESTION AT A TIME. Never ask multiple questions in a single response.
                2. Be concise. Avoid long walls of text.
                
                ${profileContext}
                ${appStateContext}

                YOUR POWERS:
                1. PROFILE CONTROL: Use 'updateProfile' to refine their strategy.
                2. SCHEDULE MANAGEMENT: Use 'modifyTask' to manage their time.
                3. ESSAY ACCESS: Use 'getEssay' to read their drafts. If they ask about a specific essay, GO READ IT first.
                4. ESSAY WRITING: Use 'updateEssay' to save content.
                5. COLLEGE STRATEGY: Use 'updateCollege' or 'addCollege'.
                6. DATA RESEARCH: Use 'researchCollege' for stats.
                7. LIVE SCOUT: Use 'researchLive' for ANY real-time web info.

                Proactive Behavior:
                - If they say "Check my Harvard essay", call 'getEssay' with the appropriate ID from the context.
                - If they are behind schedule, suggest task modifications.
                
                ACTION FIRST POLICY: If a user asks you to add a college, update a profile, or create a task/calendar event, DO IT IMMEDIATELY using the tools. Don't just say you will do it. Do it first, then confirm.
                
                ${req.body.voiceMode ? "CRITICAL: You are in VOICE MODE. Speak like a person. No bullet points, no markdown, no long lists. Keep it warm, conversational, and direct. Avoid saying 'bullet point' or 'list'." : ""}`
            },
            ...conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            {
                role: 'user',
                content: message
            }
        ];

        // Define functions the AI can call
        const functions = [
            {
                name: 'addCollege',
                description: 'Add a college to the user\'s application list. Use this when the user mentions they are applying to a college.',
                parameters: {
                    type: 'object',
                    properties: {
                        collegeName: {
                            type: 'string',
                            description: 'The name of the college (e.g., "Stanford University", "MIT", "USC")'
                        },
                        type: {
                            type: 'string',
                            enum: ['Reach', 'Target', 'Safety'],
                            description: 'The categorization of the college for the student (e.g., "Reach", "Target", "Safety")'
                        }
                    },
                    required: ['collegeName']
                }
            },
            {
                name: 'createEssays',
                description: 'Create essay tasks for a college. Use this after adding a college to create all required essays.',
                parameters: {
                    type: 'object',
                    properties: {
                        collegeName: {
                            type: 'string',
                            description: 'The name of the college'
                        }
                    },
                    required: ['collegeName']
                }
            },
            {
                name: 'createTasks',
                description: 'Create important tasks for the user\'s college applications.',
                parameters: {
                    type: 'object',
                    properties: {
                        tasks: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
                                    category: { type: 'string', enum: ['Essay', 'Document', 'LOR', 'General'] },
                                    priority: { type: 'string', enum: ['High', 'Medium', 'Low'] }
                                }
                            }
                        }
                    },
                    required: ['tasks']
                }
            },
            {
                name: 'getCollegeRequirements',
                description: 'Get detailed requirements for a specific college including essays, deadlines, test policies, and LOR requirements.',
                parameters: {
                    type: 'object',
                    properties: {
                        collegeName: {
                            type: 'string',
                            description: 'The name of the college'
                        }
                    },
                    required: ['collegeName']
                }
            },
            {
                name: 'brainstormEssay',
                description: 'Generate creative ideas and angles for a specific essay prompt or topic.',
                parameters: {
                    type: 'object',
                    properties: {
                        prompt: {
                            type: 'string',
                            description: 'The essay prompt or topic to brainstorm for'
                        },
                        context: {
                            type: 'string',
                            description: 'Any background info provided by the user (interests, experiences, etc.)'
                        }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'reviewEssay',
                description: 'Provide constructive feedback on an essay draft.',
                parameters: {
                    type: 'object',
                    properties: {
                        essayContent: {
                            type: 'string',
                            description: 'The content of the essay to review'
                        },
                        focusArea: {
                            type: 'string',
                            description: 'Specific area to focus on (e.g., "grammar", "structure", "tone")'
                        }
                    },
                    required: ['essayContent']
                }
            },
            {
                name: 'researchCollege',
                description: 'Search for detailed college information including SAT/ACT scores, GPA, acceptance rates, and description.',
                parameters: {
                    type: 'object',
                    properties: {
                        collegeName: {
                            type: 'string',
                            description: 'The name of the college to research'
                        }
                    },
                    required: ['collegeName']
                }
            },
            {
                name: 'updateProfile',
                description: 'Update the user\'s profile information (major, location, graduation_year, GPA, test scores, etc.)',
                parameters: {
                    type: 'object',
                    properties: {
                        intended_major: { type: 'string' },
                        location: { type: 'string' },
                        graduation_year: { type: 'string' },
                        full_name: { type: 'string' },
                        unweighted_gpa: { type: 'number' },
                        weighted_gpa: { type: 'number' },
                        sat_score: { type: 'number' },
                        act_score: { type: 'number' },
                        profile_bio: { type: 'string' }
                    }
                }
            },
            {
                name: 'getActivitiesAndAwards',
                description: 'Get the user\'s full list of extracurricular activities, leadership, and honors/awards.',
                parameters: { type: 'object', properties: {} }
            },
            {
                name: 'getAppStatus',
                description: 'Get the full current status of the user\'s application: colleges, active tasks, and essays.',
                parameters: { type: 'object', properties: {} }
            },
            {
                name: 'modifyTask',
                description: 'Create, update, complete, or delete an application task. USE THIS TO ADD EVENTS TO THE USER\'S CALENDAR.',
                parameters: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', enum: ['create', 'update', 'delete', 'complete'] },
                        taskId: { type: 'string', description: 'Required for update, delete, or complete' },
                        taskData: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                description: { type: 'string' },
                                dueDate: { type: 'string' },
                                category: { type: 'string' },
                                priority: { type: 'string' }
                            }
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'updateEssay',
                description: 'Update the content or status of an essay.',
                parameters: {
                    type: 'object',
                    properties: {
                        essayId: { type: 'string', description: 'The ID of the essay to update' },
                        content: { type: 'string', description: 'New draft content for the essay' },
                        isCompleted: { type: 'boolean' }
                    },
                    required: ['essayId']
                }
            },
            {
                name: 'updateCollege',
                description: 'Update a college in the user\'s list (categorization or status).',
                parameters: {
                    type: 'object',
                    properties: {
                        collegeId: { type: 'string' },
                        type: { type: 'string', enum: ['Reach', 'Target', 'Safety'] },
                        status: { type: 'string' }
                    },
                    required: ['collegeId']
                }
            },
            {
                name: 'getEssay',
                description: 'Get the full content and details of a specific essay.',
                parameters: {
                    type: 'object',
                    properties: {
                        essayId: { type: 'string', description: 'The ID of the essay to fetch' }
                    },
                    required: ['essayId']
                }
            },
            {
                name: 'listDocuments',
                description: 'List all documents in the user\'s vault.',
                parameters: { type: 'object', properties: {} }
            },
            {
                name: 'researchLive',
                description: 'USE THIS FOR REAL-TIME DATA. Uses Yutori Scouting to browse official university websites for the latest 2024-2025 updates (info sessions, decision dates, portal changes).',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'What specific real-time info to find (e.g. "Stanford info session dates", "Harvard portal login link changes")' }
                    },
                    required: ['query']
                }
            }
        ];

        // Call OpenAI with function calling
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            functions,
            function_call: 'auto'
        });

        const responseMessage = completion.choices[0].message;

        if (responseMessage.function_call) {
            const { name: functionName, arguments: functionArgsRaw } = responseMessage.function_call;
            const functionArgs = JSON.parse(functionArgsRaw);
            let result = { error: 'Not implemented' };

            console.log(`[AI-SERVER] Executing function: ${functionName}`);

            try {
                switch (functionName) {
                    case 'researchCollege':
                        result = await handleResearchCollege(functionArgs.collegeName);
                        break;
                    case 'addCollege':
                        result = await handleAddCollege(userId, functionArgs.collegeName, functionArgs.type);
                        break;
                    case 'createEssays':
                        result = await handleCreateEssays(userId, functionArgs.collegeName);
                        break;
                    case 'modifyTask':
                        result = await handleModifyTask(userId, functionArgs.action, functionArgs.taskId, functionArgs.taskData);
                        break;
                    case 'updateProfile':
                        result = await handleUpdateProfile(userId, functionArgs);
                        break;
                    case 'updateCollege':
                        result = await handleUpdateCollege(userId, functionArgs.collegeId, functionArgs);
                        break;
                    case 'getEssay':
                        result = await handleGetEssay(userId, functionArgs.essayId);
                        break;
                    case 'updateEssay':
                        result = await handleUpdateEssayContent(userId, functionArgs.essayId, functionArgs.content, functionArgs.isCompleted);
                        break;
                    case 'createTasks':
                        result = await handleCreateTasks(userId, functionArgs.tasks);
                        break;
                    case 'getAppStatus':
                        result = await handleGetAppStatus(userId);
                        break;
                    case 'brainstormEssay':
                        result = await handleBrainstormEssay(functionArgs.prompt, functionArgs.context);
                        break;
                    case 'reviewEssay':
                        result = await handleReviewEssay(functionArgs.essayContent, functionArgs.focusArea);
                        break;
                    case 'listDocuments':
                        result = await handleListDocuments(userId);
                        break;
                    case 'researchLive':
                        result = await handleYutoriResearch(functionArgs.query);
                        break;
                    default:
                        console.log('Unknown function called:', functionName);
                }
            } catch (err) {
                console.error(`Error executing ${functionName}:`, err);
                result = { success: false, error: err.message };
            }

            const secondCompletion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    ...messages,
                    responseMessage,
                    { role: 'function', name: functionName, content: JSON.stringify(result) }
                ]
            });

            const finalResponse = secondCompletion.choices[0].message.content;
            await saveConversation(userId, message, finalResponse, { function: functionName, result });
            return res.json({ response: finalResponse, functionCalled: functionName });
        }

        const aiResponse = responseMessage.content;
        // Save to conversation history if requested
        if (saveToHistory) {
            await saveConversation(userId, message, aiResponse);
        }
        res.json({ response: aiResponse });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper Functions
async function handleResearchCollege(collegeName, forceResearch = false) {
    try {
        console.log(`Searching catalog for: ${collegeName} (Force: ${forceResearch})`);

        // Try precise match first
        let { data: college } = await supabase
            .from('college_catalog')
            .select('*')
            .eq('name', collegeName)
            .maybeSingle();

        // Try loose match if not found
        if (!college) {
            const { data: fuzzyMatches } = await supabase
                .from('college_catalog')
                .select('*')
                .ilike('name', `%${collegeName}%`)
                .limit(1);

            if (fuzzyMatches && fuzzyMatches.length > 0) {
                college = fuzzyMatches[0];
            }
        }

        // If we found it and it has essays, and we aren't forcing, return it
        if (!forceResearch && college && college.essays && college.essays.length > 0) {
            return { success: true, college };
        }

        // Use AI if not in DB or forced/empty
        console.log(`Researching ${collegeName} via AI (Deep Research)...`);
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{
                role: 'system',
                content: `You are a world-class college admissions researcher.
                Provide accurate, comprehensive 2024-2025 admissions data for ${collegeName}.
                
                CRITICAL INSTRUCTION FOR ESSAYS:
                - Find EVERY supplemental essay required for 2024-2025.
                - Most top schools (like Stanford, Harvard, etc.) have 3-5+ short questions or long essays.
                - For Stanford specifically, include the "Roommate" essay, "What is meaningful to you", and "Letter to your future roommate".
                - Include the specific prompts and word limits (usually 50, 100, or 250 words).
                
                Return a JSON object:
                {
                  "name": "Full College Name",
                  "description": "...",
                  "location": "...",
                  "website": "...",
                  "application_platform": "Common App" | "Coalition App" | "UC App",
                  "acceptance_rate": 0.0,
                  "median_sat": 0,
                  "median_act": 0,
                  "avg_gpa": 0.0,
                  "enrollment": 0,
                  "cost_of_attendance": 0,
                  "deadline_date": "YYYY-MM-DD",
                  "deadline_type": "RD" | "ED" | "EA",
                  "lors_required": 0,
                  "essays": [
                    { "title": "...", "prompt": "...", "word_limit": 0, "essay_type": "Supplemental" }
                  ]
                }`
            }],
            response_format: { type: "json_object" }
        });

        const data = JSON.parse(completion.choices[0].message.content);

        // Catalog it
        const { data: savedData, error: upsertError } = await supabase.from('college_catalog').upsert({
            name: data.name || collegeName,
            ...data
        }, { onConflict: 'name' }).select().single();

        if (upsertError) console.error('Upsert error:', upsertError);

        return { success: true, college: savedData || data };
    } catch (e) {
        console.error('Research error:', e);
        return { success: false, error: e.message };
    }
}

async function handleAddCollege(userId, collegeName, type) {
    // Every new college gets a forced check if it's currently empty or slim
    const research = await handleResearchCollege(collegeName, false);
    let collegeData = research.college || { name: collegeName };

    // Precautionary: if it has 0 essays, FORCE a re-research to be sure
    if (!collegeData.essays || collegeData.essays.length === 0) {
        console.log(`[PRECAUTIONARY] ${collegeName} has 0 essays. Forcing a deep research...`);
        const deepResearch = await handleResearchCollege(collegeName, true);
        if (deepResearch.success) collegeData = deepResearch.college;
    }

    const { data: existing } = await supabase
        .from('colleges')
        .select('id')
        .eq('user_id', userId)
        .eq('name', collegeData.name)
        .maybeSingle();

    if (existing) {
        await handleCreateEssays(userId, collegeData.name); // Ensure essays are synced
        return { success: true, message: 'Already in list' };
    }

    const { data, error } = await supabase
        .from('colleges')
        .insert({
            user_id: userId,
            name: collegeData.name,
            application_platform: collegeData.application_platform || 'Common App',
            type: type || 'Target',
            status: 'Not Started'
        })
        .select()
        .single();

    if (data) {
        await handleCreateEssays(userId, collegeData.name);
    }

    return { success: true, collegeId: data?.id };
}

async function handleCreateEssays(userId, collegeName) {
    try {
        console.log(`[ESSAY-SYNC] Syncing essays for ${collegeName} (User: ${userId})`);

        // Robust Matching: Try exact, then fuzzy
        let { data: collegeEntry } = await supabase
            .from('colleges')
            .select('id, name, application_platform')
            .eq('user_id', userId)
            .eq('name', collegeName)
            .maybeSingle();

        if (!collegeEntry) {
            console.log(`[ESSAY-SYNC] Exact match failed for "${collegeName}", trying fuzzy...`);
            // Let's try something even simpler: just get all and find in JS
            const { data: allUserColls } = await supabase.from('colleges').select('id, name, application_platform').eq('user_id', userId);
            const match = allUserColls.find(c =>
                c.name.toLowerCase().includes(collegeName.toLowerCase()) ||
                collegeName.toLowerCase().includes(c.name.toLowerCase())
            );

            if (match) {
                collegeEntry = match;
                console.log(`[ESSAY-SYNC] Matched via JS fuzzy: "${collegeEntry.name}"`);
            }
        }

        if (!collegeEntry) {
            console.error(`[ESSAY-SYNC] College NOT FOUND for user: ${collegeName}`);
            return { success: false, error: 'College not found in user list' };
        }

        // Use the same precautionary logic here: if empty, force research
        let research = await handleResearchCollege(collegeName, false);
        let catalogEntry = research.college;

        if (!catalogEntry || !catalogEntry.essays || catalogEntry.essays.length === 0) {
            console.log(`[ESSAY-SYNC] ${collegeName} has 0 essays in catalog. Forcing deep research...`);
            research = await handleResearchCollege(collegeName, true);
            catalogEntry = research.college;
        }

        if (!catalogEntry) return { success: true, count: 0 };

        let count = 0;
        // 1. Create Global Essays (Personal Statement / PIQs)
        if (catalogEntry.application_platform === 'Common App') {
            const { data: existingEssays } = await supabase
                .from('essays')
                .select('id, title, essay_type')
                .eq('user_id', userId);

            const hasPS = (existingEssays || []).some(e =>
                (e.essay_type === 'Personal Statement' || e.essay_type === 'Common App') ||
                (e.title && e.title.toLowerCase().includes('common app personal statement'))
            );

            if (!hasPS) {
                const { error: psError } = await supabase.from('essays').insert({
                    user_id: userId,
                    title: 'Common App Personal Statement',
                    prompt: 'Choose one of the seven Common App prompts...',
                    word_limit: 650,
                    essay_type: 'Personal Statement',
                    is_completed: false,
                    content: ''
                });
                if (psError) console.error(`[ESSAY-SYNC] PS Error for ${userId}:`, psError);
                else count++;
            }
        }

        if (catalogEntry.application_platform === 'UC App') {
            const { data: ucPIQs } = await supabase
                .from('essays')
                .select('id')
                .eq('user_id', userId)
                .eq('essay_type', 'UC PIQ');

            if (!ucPIQs || ucPIQs.length < 4) {
                // Ensure all 8 options exist so they can choose 4
                for (let i = 1; i <= 8; i++) {
                    const { data: existingPIQ } = await supabase
                        .from('essays')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('title', `UC PIQ #${i}`)
                        .maybeSingle();

                    if (!existingPIQ) {
                        const { error: ucError } = await supabase.from('essays').insert({
                            user_id: userId,
                            title: `UC PIQ #${i}`,
                            prompt: `UC Personal Insight Question #${i}`,
                            word_limit: 350,
                            essay_type: 'UC PIQ',
                            is_completed: false,
                            content: ''
                        });
                        if (ucError) console.error(`[ESSAY-SYNC] UC Error #${i} for ${userId}:`, ucError);
                        else count++;
                    }
                }
            }
        }

        // 2. Create Supplemental Essays
        if (catalogEntry.essays) {
            for (const essay of catalogEntry.essays) {
                const { data: existing } = await supabase
                    .from('essays')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('college_id', collegeEntry.id)
                    .eq('title', `${collegeEntry.name} - ${essay.title}`)
                    .maybeSingle();

                if (!existing) {
                    const { error: insError } = await supabase.from('essays').insert({
                        user_id: userId,
                        college_id: collegeEntry.id,
                        title: `${collegeEntry.name} - ${essay.title}`,
                        prompt: essay.prompt,
                        word_limit: essay.word_limit,
                        essay_type: essay.essay_type || 'Supplemental',
                        is_completed: false,
                        content: ''
                    });
                    if (insError) console.error(`[ESSAY-SYNC] Failed to insert essay for ${collegeEntry.name}:`, insError);
                    else count++;
                }
            }
        }

        // 2. Create Default Tasks
        const defaultTasks = [
            { title: `Draft Supplemental Essays for ${collegeEntry.name}`, priority: 'High' },
            { title: `Request Transcripts for ${collegeEntry.name}`, priority: 'Medium' },
            { title: `Finalize LORs for ${collegeEntry.name}`, priority: 'Medium' }
        ];

        for (const task of defaultTasks) {
            const { data: existingTask } = await supabase
                .from('tasks')
                .select('id')
                .eq('user_id', userId)
                .eq('college_id', collegeEntry.id)
                .eq('title', task.title)
                .maybeSingle();

            if (!existingTask) {
                await supabase.from('tasks').insert({
                    user_id: userId,
                    college_id: collegeEntry.id,
                    title: task.title,
                    priority: task.priority,
                    completed: false,
                    status: 'Todo'
                });
            }
        }

        return { success: true, count };
    } catch (e) {
        console.error('Error creating essays:', e);
        return { success: false, error: e.message };
    }
}

async function saveConversation(userId, userMessage, aiResponse, metadata = {}) {
    await supabase.from('conversations').insert([
        { user_id: userId, role: 'user', content: userMessage },
        { user_id: userId, role: 'assistant', content: aiResponse, metadata }
    ]);
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AI Server listening on 0.0.0.0:${PORT}`);
    console.log(`Healthcheck path: /health`);
});

// --- Additional Helper Functions for Agentic Capabilities ---

async function handleUpdateProfile(userId, updates) {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select();
    if (error) return { success: false, error: error.message };
    return { success: true, profile: data };
}

async function handleCreateTasks(userId, tasks) {
    const toInsert = tasks.map(t => ({ user_id: userId, ...t, completed: false, status: 'Todo' }));
    const { data, error } = await supabase.from('tasks').insert(toInsert).select();
    if (error) return { success: false, error: error.message };
    return { success: true, count: data.length };
}

async function handleModifyTask(userId, action, taskId, taskData) {
    if (action === 'create') return handleCreateTasks(userId, [taskData]);
    if (action === 'delete') {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId);
        return { success: !error };
    }
    if (action === 'complete') {
        const { error } = await supabase.from('tasks').update({ completed: true }).eq('id', taskId).eq('user_id', userId);
        return { success: !error };
    }
    if (action === 'update') {
        const { error } = await supabase.from('tasks').update(taskData).eq('id', taskId).eq('user_id', userId);
        return { success: !error };
    }
    return { success: false, error: 'Invalid action' };
}

async function handleUpdateCollege(userId, collegeId, updates) {
    const { error } = await supabase.from('colleges').update(updates).eq('id', collegeId).eq('user_id', userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

async function handleGetEssay(userId, essayId) {
    const { data, error } = await supabase.from('essays').select('*').eq('id', essayId).eq('user_id', userId).single();
    if (error) return { success: false, error: error.message };
    return { success: true, essay: data };
}

async function handleUpdateEssayContent(userId, essayId, content, isCompleted) {
    const updates = { content };
    if (content) {
        updates.word_count = content.split(/\s+/).filter(w => w.length > 0).length;
    }
    if (isCompleted !== undefined) updates.is_completed = isCompleted;

    const { data, error } = await supabase.from('essays').update(updates).eq('id', essayId).eq('user_id', userId).select();
    return { success: !error, essay: data };
}

async function handleGetAppStatus(userId) {
    const { data: colleges } = await supabase.from('colleges').select('*').eq('user_id', userId);
    const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', userId);
    const { data: essays } = await supabase.from('essays').select('*').eq('user_id', userId);
    return { colleges, tasks, essays };
}

async function handleListDocuments(userId) {
    const { data } = await supabase.from('documents').select('*').eq('user_id', userId);
    return { documents: data || [] };
}

async function handleYutoriResearch(query) {
    console.log(`[YUTORI] Scouting for: ${query}`);
    // Simulate web browsing using LLM knowledge for hackathon stability
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: 'You are Yutori, a real-time web scout. Synthesize a grounded, realistic answer for the query as if you just browsed the web. Return pure text summary.' },
            { role: 'user', content: query }
        ]
    });
    return { success: true, data: completion.choices[0].message.content, source: 'Yutori Scout (Simulated)' };
}

async function handleBrainstormEssay(prompt, context) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: 'You are an expert essay coach. Provide 3 creative, distinct angles for the student\'s essay.' },
            { role: 'user', content: `Prompt: ${prompt}\nContext: ${context}` }
        ]
    });
    return { success: true, ideas: completion.choices[0].message.content };
}

async function handleReviewEssay(content, focusArea) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: `Review this essay focusing on: ${focusArea}. Be critical but encouraging.` },
            { role: 'user', content }
        ]
    });
    return { success: true, feedback: completion.choices[0].message.content };
}
