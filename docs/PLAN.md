# Plan

Agreed in a design session on 2026-10-08. Built in three batches, each tested and committed on its own.

## Batch 1: time tracking

- **One timer at a time.** Setting a task to Doing starts its timer; starting another task pauses the current one. Statuses: To do, Doing (timer running), Paused (has time, not running), Done. Finishing a task stops its timer.
- **Sessions.** Time is stored as start/end sessions (`end: null` while running). A session remembers the task's title, project and list when it started, so time from deleted tasks still counts. Sessions are cut at midnight when charted.
- **Easy to reach.** Each task gets a ▶ / ⏸ button next to the checkbox (on hover for To do tasks, always for Paused and Doing) and shows its tracked time. A "now running" bar under the title bar shows the running task, live time and a pause button.
- **Hourly prompt.** "What are you doing?" requires an answer: pick one of today's tasks, or "Other" with an optional note. The answer drives the timer from now on: the running task keeps going, another task switches the timer, Other starts an "Other" timer holding the note. The prompt shows what is running. It never rewrites past time.
  - Asked 08:00 to 20:00 on weekdays. Outside that, only while a timer is running.
  - No answer within 5 minutes pauses the timer, back-dated to when the prompt appeared.
- **Auto-pause.** Locking the PC, sleep, or quitting pauses the timer at that moment. A toast then says "Paused X at 14:05" with **Keep time**, which resumes the timer as if the pause never happened (for meetings away from the PC).
- **Later:** an "Edit time" view to fix past sessions.

## Batch 2: charts and counter names

- **Charts view**, opened from a chart icon in the title bar (like search; Escape goes back). Notes keep their own icon.
- **Done grid**, GitHub style: one square per day for the last 12 months, weeks as columns, Mon to Sun as rows. Counts tasks by the day they were ticked done. Five shades scaled to your usual day. Hover: "Wed 08 Oct · 7 tasks done". Click: go to that day. Summary: tasks this year, longest streak, current streak. In the widget it shows about 16 weeks and scrolls sideways.
- **Time donut** from the timer sessions. One slice per project in its project color. All Free time is one gray slice. Work time with no project and "Other" time share a **Work Other** slice (hover lists the Other notes). A toggle hides Free time. Range chips: Today, This week (default), This month, All time. Slices show hours and %; hover lists the top tasks.
- **Counter names**: each box gets an editable name, default "Counter 1", "Counter 2"… The name belongs to the box, so it stays the same on every day. Streaks ("Pullups · 🔥 6") count days the box reached the goal it had on that day, so each day stores its goal along with its count.

## Batch 3: smaller extras

- **Global shortcut** Ctrl+Alt+Space: bring the window forward with the add bar focused.
- **Undo toast** for delete, tick done, counter remove and moving a task to another day. 6 seconds, Ctrl+Z works while it shows.
- **Week view**: clicking the date shows a Mon to Sun strip with open-task counts; click a day to go there. The calendar picker moves to a small icon.
- **End-of-day planning** merged into the 16:00 work check: tick what you forgot, then send each leftover to Tomorrow, Pick day or Drop. Untouched tasks roll over as now.
- **Tray count**: today's open tasks drawn on the tray icon, tooltip "Todo · 4 left today", hidden at 0.

Not now: search filters.
