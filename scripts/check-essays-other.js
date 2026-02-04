const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkEssays() {
    const userId = '1a7f7b2b-7b4e-412a-9af3-e9386f2bef1c';
    const { data: essays } = await supabase.from('essays').select('*').eq('user_id', userId);
    console.log(`Essays for ${userId}: ${essays.length}`);
    essays.forEach(e => console.log(` - ${e.title}`));
}

checkEssays();
