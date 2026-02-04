const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function listUsers() {
    const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(10);
    console.log('--- USERS ---');
    users.forEach(u => console.log(`${u.created_at} | ${u.id} | ${u.full_name} | ${u.email}`));

    const { data: colleges } = await supabase.from('colleges').select('*').order('created_at', { ascending: false }).limit(10);
    console.log('\n--- COLLEGES ---');
    colleges.forEach(c => console.log(`${c.created_at} | User: ${c.user_id} | ${c.name}`));
}

listUsers();
