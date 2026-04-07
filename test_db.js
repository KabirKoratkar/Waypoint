const fetch = require('node-fetch');

async function test() {
  const url = 'https://collegeapps-ai-production-28c4.up.railway.app/api/profile/save';
  const data = {"userId": "123", "high_school_name": "test", "weighted_gpa": 4.0, "graduation_year": 2026};
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const json = await res.json();
  console.log("DB Test Response:", JSON.stringify(json));
}
test();
