const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSchema() {
    const { data: colleges } = await supabase.from('colleges').select('*').limit(1);
    const { data: essays } = await supabase.from('essays').select('*').limit(1);

    console.log('--- Colleges Table Columns ---');
    if (colleges && colleges.length > 0) console.log(Object.keys(colleges[0]));

    console.log('\n--- Essays Table Columns ---');
    if (essays && essays.length > 0) console.log(Object.keys(essays[0]));
}

checkSchema();
