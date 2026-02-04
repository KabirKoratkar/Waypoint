const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkEssays() {
    const userId = 'e0d08ad7-1a58-414c-845b-d33b38d3939a';
    const { data: essays } = await supabase.from('essays').select('*').eq('user_id', userId).order('created_at', { ascending: false });

    console.log(`Essays for ${userId}:`);
    essays.forEach(e => {
        console.log(` - ${e.title} (College ID: ${e.college_id})`);
    });
}

checkEssays();
