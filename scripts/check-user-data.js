const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkUserData() {
    // Get the latest user
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (!profiles || profiles.length === 0) {
        console.log('No users found');
        return;
    }

    const user = profiles[0];
    console.log('User:', user.id, user.full_name);

    const { data: colleges, error: colError } = await supabase
        .from('colleges')
        .select('*')
        .eq('user_id', user.id);

    if (colError) console.error('Colleges Error:', colError);
    console.log('Colleges:', JSON.stringify(colleges, null, 2));

    // AVOID JOIN to prevent relationship errors
    const { data: essays, error: essError } = await supabase
        .from('essays')
        .select('*')
        .eq('user_id', user.id);

    if (essError) console.error('Essays Error:', essError);

    // Manual map to see if they'd show up in UI
    const mapped = (essays || []).map(e => ({
        ...e,
        college_name: colleges.find(c => c.id === e.college_id)?.name || 'Unknown'
    }));

    console.log('Essays (Mapped):', JSON.stringify(mapped, null, 2));
}

checkUserData();
