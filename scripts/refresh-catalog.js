const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function refreshCatalog() {
    console.log('🚀 Starting Catalog Refresh (Deep AI Research)...');

    // 1. Get all colleges in catalog
    const { data: catalog, error } = await supabase
        .from('college_catalog')
        .select('name, id');

    if (error) {
        console.error('Failed to fetch catalog:', error);
        return;
    }

    console.log(`Found ${catalog.length} colleges to refresh.`);

    for (const entry of catalog) {
        console.log(`\n🔍 Researching: ${entry.name}...`);

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{
                    role: 'system',
                    content: `You are a world-class college admissions researcher. 
                    Provide accurate, comprehensive 2024-2025 admissions data for ${entry.name}.
                    
                    CRITICAL INSTRUCTION FOR ESSAYS:
                    - Find EVERY supplemental essay required for 2024-2025.
                    - Most top schools (like Stanford, Harvard, etc.) have 3-5+ short questions or long essays.
                    - Include specific prompts and word limits.
                    
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

            const { error: updateError } = await supabase
                .from('college_catalog')
                .update({
                    ...data
                })
                .eq('id', entry.id);

            if (updateError) {
                console.error(`❌ Failed to update ${entry.name}:`, updateError.message);
            } else {
                console.log(`✅ Updated ${entry.name} (${data.essays?.length || 0} essays found)`);
            }

        } catch (e) {
            console.error(`❌ AI Research failed for ${entry.name}:`, e.message);
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n✨ Catalog Refresh Complete!');
}

refreshCatalog();
