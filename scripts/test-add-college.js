const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // May need to install or use local environment
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testAddCollege() {
    const userId = 'e0d08ad7-1a58-414c-845b-d33b38d3939a';
    const collegeName = 'Stanford University';

    console.log(`Manually triggering backend add for ${collegeName}...`);

    try {
        const response = await fetch('http://localhost:3001/api/colleges/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, collegeName, type: 'Target' })
        });

        const result = await response.json();
        console.log('Backend response:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('Success! College ID:', result.collegeId);

            // Check if it's in the DB now
            const { data } = await supabase.from('colleges').select('*').eq('id', result.collegeId).single();
            console.log('DB Record:', JSON.stringify(data, null, 2));
        } else {
            console.error('Backend failed:', result.error);
        }
    } catch (e) {
        console.error('Fetch error (is server running?):', e.message);
    }
}

testAddCollege();
