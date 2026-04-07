const fetch = require('node-fetch');
async function run() {
  const res = await fetch('http://localhost:3000/api/onboarding/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test_user',
      conversationHistory: [
        { role: 'assistant', content: 'What is your name?' },
        { role: 'user', content: 'My name is Kabir' },
        { role: 'assistant', content: 'Nice to meet you Kabir. What high school do you go to and what is your UW and W GPA?' },
        { role: 'user', content: 'I go to Gunn High School. My UW GPA is 3.9 and my W GPA is 4.3' }
      ]
    })
  });
  console.log(await res.json());
}
run();
