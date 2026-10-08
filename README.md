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
- Status is To do, Doing or Done. Set Doing from the task's Status field or the right-click menu ("Mark as doing"). Doing tasks get an amber outline, a dot in the checkbox and a "Doing" tag. Ticking a task done ends Doing.
- Every hour, in the first 10 minutes of the hour, the app asks "What are you doing?". It brings the window back if it was hidden and also shows a notification. Writing is optional: tap one of your Doing tasks to fill it in, or Skip (Enter on an empty field or Escape also skips). Skipped hours are still logged.
- Notes (notebook icon in the title bar) lists every answer by day as `11:00 Doing: …`. Click an entry to edit it, hover to delete it, or use "Add entry" to log something now.
- Drag the grip to reorder. Drop a task on ◀ or ▶ to move it a day.
- Right-click a task for move and delete. `Del` deletes the focused task.
- Click the colored stripe to change priority.
- Title bar: search, projects, light/dark, widget mode, pin on top (widget only), close to tray.
- Quit from the tray icon menu. Reminders only fire while the app is running.

## Data

`%APPDATA%\todo-app\data.json`, saved on every change. `data.backup.json` is the copy from the previous start.
Storage goes through `StorageAdapter` in `src/renderer/src/lib/storage.ts`, so a Supabase adapter can replace the local file later.
