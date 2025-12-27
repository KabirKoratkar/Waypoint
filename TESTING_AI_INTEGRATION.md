# Testing AI Counselor → Calendar Integration

## How It Works 🔄

When you tell the AI counselor "I want to apply to Georgia Tech", it automatically:

1. ✅ **Adds Georgia Tech to database** → Shows up on Colleges page
2. ✅ **Creates essay tasks** → Shows up on Essays page  
3. ✅ **Adds deadline to calendar** → Jan 4, 2025 appears on Calendar
4. ✅ **Creates tasks** → Shows up on Dashboard and Calendar

Everything is interconnected through the Supabase database!

## Test Steps

### Step 1: Start Both Servers

**Terminal 1 - Frontend:**
```bash
cd collegeapps-ai
python3 -m http.server 8000
```

**Terminal 2 - Backend (AI Server):**
```bash
cd collegeapps-ai/backend
npm start
```

### Step 2: Open AI Counselor

Navigate to: `http://localhost:8000/ai-counselor.html`

### Step 3: Test with Georgia Tech

Type this message:
```
I want to apply to Georgia Tech
```

**What the AI will do:**
1. Call `addCollege("Georgia Tech")`
2. Add Georgia Tech to your colleges table with:
   - Name: Georgia Institute of Technology
   - Deadline: January 4, 2025
   - Platform: Common App
   - Test Policy: Test Optional
   - LORs: 1 required

3. Call `createEssays("Georgia Tech")`
4. Create 3 essay tasks:
   - Common App Personal Statement (650 words)
   - Why Georgia Tech (300 words)
   - Diversity Essay (300 words)

5. Respond with confirmation

### Step 4: Verify Integration

**Check Calendar:**
1. Go to `http://localhost:8000/calendar.html`
2. Navigate to **January 2025**
3. Look at **January 4th**
4. You should see: 🔴 **Georgia Institute of Technology - RD**

**Check Colleges Page:**
1. Go to `http://localhost:8000/colleges.html`
2. Georgia Tech should appear in your college list

**Check Essays Page:**
1. Go to `http://localhost:8000/essays.html`
2. You should see 3 new essays for Georgia Tech

**Check Dashboard:**
1. Go to `http://localhost:8000/dashboard.html`
2. Tasks related to Georgia Tech should appear

### Step 5: Test Calendar Filtering

1. Go back to Calendar
2. Click the **College Filter** dropdown
3. Select **Georgia Institute of Technology**
4. Calendar should now show ONLY Georgia Tech's deadline
5. Select **All Colleges** to see everything again

### Step 6: Test Event Details

1. On the calendar, click on the **Jan 4** Georgia Tech deadline
2. A modal should pop up showing:
   - Event Type: Deadline
   - Date: Saturday, January 4, 2025
   - College: Georgia Institute of Technology
   - Platform: Common App
   - Deadline Type: RD
   - Status: Not Started
   - Quick action button: "View College"

## More Test Examples

### Add Multiple Colleges

Try saying:
```
I also want to apply to Stanford and MIT
```

The AI will:
- Add both colleges
- Create essays for both
- Both deadlines appear on calendar (Jan 1 for MIT, Jan 5 for Stanford)

### Ask About Requirements

Try:
```
What are the requirements for Georgia Tech?
```

The AI will use `getCollegeRequirements()` to tell you about:
- Essay requirements
- Test policy
- LOR requirements
- Deadline

### Create Custom Tasks

Try:
```
Can you remind me to request letters of recommendation for Georgia Tech by December 28?
```

The AI will create a task that shows up on:
- Dashboard
- Calendar (on Dec 28)

## Expected Calendar View

After adding Georgia Tech, your January 2025 calendar should show:

```
January 2025
Sun  Mon  Tue  Wed  Thu  Fri  Sat
                  1    2    3    4
                 MIT       🔴GT
 5    6    7    8    9   10   11
🔴Stanford
12   13   14   15   16   17   18
              🔴USC
              🔴UConn
              🔴USD
...
```

Legend:
- 🔴 = College Deadline
- 🔵 = Essay Due Date
- 🟣 = Task

## Troubleshooting

### "Failed to connect to AI"

**Problem:** Backend server not running

**Solution:**
```bash
cd backend
npm start
```

### "College not found in database"

**Problem:** College not in `college-data.js`

**Solution:** Georgia Tech is already in the database! Make sure you're using the exact name or a close match like:
- "Georgia Tech" ✅
- "Georgia Institute of Technology" ✅
- "GT" ✅

### Calendar doesn't show Georgia Tech

**Problem:** Page not refreshing

**Solution:**
1. Hard refresh the calendar page (Cmd+Shift+R or Ctrl+Shift+R)
2. Or close and reopen the calendar tab

### No essays created

**Problem:** AI didn't call `createEssays()`

**Solution:** Try being more explicit:
```
I want to apply to Georgia Tech. Can you add it to my list and create the essay tasks?
```

## What Makes This Cool 🎉

The integration means:
1. **One action, everywhere updated** - Tell AI once, updates everywhere
2. **Real-time sync** - Everything pulls from same database
3. **No manual entry** - AI does all the data entry for you
4. **Smart filtering** - Calendar automatically includes new colleges in filters
5. **Linked data** - Click college on calendar → goes to college page

## Next Steps

Try adding all your colleges through the AI counselor:
```
I'm applying to Stanford, MIT, USC, Georgia Tech, Carnegie Mellon, and University of Michigan
```

Watch as your calendar fills up with all the deadlines automatically! 🚀
