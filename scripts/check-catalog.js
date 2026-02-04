const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkCatalog() {
    const { data } = await supabase.from('college_catalog').select('name, essays').eq('name', 'Stanford University').single();
    console.log(`Colleges: ${data.name}`);
    console.log(`Essays count: ${data.essays?.length}`);
    data.essays?.forEach(e => console.log(` - ${e.title}`));
}

checkCatalog();
