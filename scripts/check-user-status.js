const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkUserStatus() {
    const userId = 'e0d08ad7-1a58-414c-845b-d33b38d3939a';
    console.log(`Checking status for user: ${userId}`);

    // 1. Check colleges
    const { data: colleges } = await supabase.from('colleges').select('*').eq('user_id', userId);
    console.log('\n--- COLLEGES ---');
    if (!colleges || colleges.length === 0) {
        console.log('No colleges found for this user.');
    } else {
        colleges.forEach(c => console.log(` - [${c.id}] ${c.name}`));
    }

    // 2. Check essays
    const { data: essays } = await supabase.from('essays').select('*').eq('user_id', userId);
    console.log('\n--- ESSAYS ---');
    if (!essays || essays.length === 0) {
        console.log('No essays found for this user.');
    } else {
        essays.forEach(e => console.log(` - [${e.college_id}] ${e.title}`));
    }
}

checkUserStatus();
