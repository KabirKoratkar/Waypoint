const fetch = require('node-fetch');

async function test() {
  const url = 'https://qcwwxiqgylzvvvjoiphq.supabase.co/rest/v1/profiles?select=high_school_name,weighted_gpa,unweighted_gpa,intended_major&limit=1';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjd3d4aXFneWx6dnZ2am9pcGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzg0MjIsImV4cCI6MjA3OTg1NDQyMn0.v_70i3s8bOR9uwAi7fVZlXf-i6FeCpEN_-psTciF__4';
  
  const res = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  
  const json = await res.json();
  console.log("DB Test Response:", JSON.stringify(json));
}
test();
