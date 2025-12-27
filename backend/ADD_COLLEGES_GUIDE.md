# Adding Sample Colleges to Calendar

## Quick Setup

Follow these steps to populate your calendar with the 8 colleges and their deadlines.

## Step 1: Open Supabase SQL Editor

1. Go to [supabase.com](https://supabase.com) and log in
2. Select your **CollegeApps** project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

## Step 2: Run the SQL Script

1. Open the file: `backend/add-sample-colleges.sql`
2. Copy the entire contents
3. Paste into the Supabase SQL editor
4. Click **Run** (bottom right)

## Step 3: Verify Data

You should see a success message. To verify:

1. Click **Table Editor** in the left sidebar
2. Select the **colleges** table
3. You should see 8 colleges with deadlines

## Step 4: View in Calendar

1. Start your local server: `python3 -m http.server 8000`
2. Navigate to: `http://localhost:8000/calendar.html`
3. You should see:
   - **Jan 1**: MIT deadline
   - **Jan 5**: Stanford deadline
   - **Jan 15**: USC, UConn, USD deadlines
   - **Jan 31**: Washington State deadline
   - **Feb 1**: ASU, Ole Miss deadlines
   - Plus various tasks throughout December and January

## The 8 Colleges Added

| College | Deadline | Type | Platform |
|---------|----------|------|----------|
| **MIT** | Jan 1, 2025 | RD | Common App |
| **Stanford** | Jan 5, 2025 | RD | Common App |
| **USC** | Jan 15, 2025 | RD | Common App |
| **UConn** | Jan 15, 2025 | RD | Common App |
| **U San Diego** | Jan 15, 2025 | RD | Common App |
| **Washington State** | Jan 31, 2025 | RD | Common App |
| **Arizona State** | Feb 1, 2025 | RD | Common App |
| **Ole Miss** | Feb 1, 2025 | RD | Common App |

## Sample Tasks Added

The script also adds 6 sample tasks:
- **Dec 22**: Request LORs for Stanford
- **Dec 24**: Update Activities List
- **Dec 26**: Finalize Common App Essay
- **Dec 27**: MIT Maker Portfolio
- **Dec 28**: Complete Stanford Supplements
- **Jan 25**: Submit Transcript to ASU

## Troubleshooting

### "User ID not found"

If you get an error about user ID:

1. First, find your user ID:
   ```sql
   SELECT id, email FROM profiles;
   ```

2. Copy your user ID (looks like: `abc123-def456-...`)

3. Replace this line in the SQL script:
   ```sql
   (SELECT id FROM profiles LIMIT 1)
   ```
   
   With your actual ID:
   ```sql
   'your-actual-user-id-here'
   ```

### "Colleges already exist"

If you've already added these colleges, you'll get a duplicate error. You can either:

1. **Delete existing colleges first:**
   ```sql
   DELETE FROM colleges;
   DELETE FROM tasks;
   ```

2. **Or skip this step** if you already have colleges in your database

## Next Steps

Once the data is loaded:

1. ✅ Open the calendar view
2. ✅ Test the filters (filter by college or event type)
3. ✅ Navigate between months
4. ✅ Click on events to see details
5. ✅ Try the AI counselor to add more colleges!

---

**Enjoy your fully populated calendar!** 📅✨
