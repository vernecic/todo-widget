# Todo

Desktop todo list for Windows with a widget mode. Electron + React + TypeScript (electron-vite).

## Commands

```
npm install
npm run dev        # run with hot reload
npm run dist       # build installer: dist/Todo Setup 1.0.0.exe
npm run typecheck
npm run icon       # regenerate build/icon.png and resources/icon.png
```

## Using it

- Add bar: `Send invoice #google !!` adds to the shown day with project "google" and medium priority (`!` low, `!!` medium, `!!!` high).
- Tasks are split into WORK and FREE TIME. Click a header to collapse it. The pill in the add bar picks which list new tasks go to. Move a task between lists by dragging it onto the other list (or its header), from the right-click menu, or with the List field.
- Free time has daily counter boxes (starting with 0 / 100, 0 / 50, 0 / 20). Type a number in "+ add" and press Enter to add it; `-5` takes 5 away. Click either number to type a new one: the left is that day's count, the right is the goal for every day. The dashed + box adds a counter; hover a box for x to remove it.
- Weekdays at 16:00, if today's work tasks are still open, a notification and a "Work check" dialog ask whether any are actually done.
- Click a task to open status, notes, subtasks, day, project, priority, reminder and repeat.
- Status is To do, Doing, Paused or Done. Doing means the task's timer is running; only one task runs at a time, so starting another pauses the current one. Start or pause with the ▶ / ⏸ button next to the checkbox, the Status field, or the right-click menu. Tracked time shows on the task, and a bar under the title bar shows what is running. Ticking a task done stops its timer.
- The timer pauses by itself when the screen locks, the PC sleeps or Todo closes. A toast then offers **Keep time**, which resumes it as if it never stopped.
- Every hour (weekdays 08:00 to 20:00, other times only while a timer runs), in the first 10 minutes of the hour, the app asks "What are you doing?". Pick one of today's tasks, or Other with an optional note. The answer sets what the timer runs from now on; Other runs an "Other" timer. Left unanswered for 5 minutes, the timer pauses from when the prompt appeared.
- Notes (notebook icon in the title bar) lists every answer by day as `11:00 Doing: …`. Click an entry to edit it, hover to delete it, or use "Add entry" to log something now.
- Drag the grip to reorder. Drop a task on ◀ or ▶ to move it a day.
- Right-click a task for move and delete. `Del` deletes the focused task.
- Click the colored stripe to change priority.
- Title bar: search, projects, light/dark, widget mode, pin on top (widget only), close to tray.
- Quit from the tray icon menu. Reminders only fire while the app is running.

## Data

`%APPDATA%\todo-app\data.json`, saved on every change. `data.backup.json` is the copy from the previous start.
Storage goes through `StorageAdapter` in `src/renderer/src/lib/storage.ts`, so a Supabase adapter can replace the local file later.
