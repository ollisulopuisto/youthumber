# Session undo and branches

Each accepted project update gets its own node. There is no 60-entry limit,
image-byte pruning or time-based merging. Editing after Undo keeps the old
branch. Choose its tip in the "Undo branches" menu, then Undo to earlier
states. Redo follows the last visited branch. Projects have separate trees
within the same window, so Undo never changes a different project.

This history is in memory, only for this window's lifetime. Closing, refreshing
or crashing loses it. Existing project autosave is separate, still delayed and
not a promise that the latest on-screen edit survived a crash. Exported JSON
contains the project, not this session history. Browser tabs have independent
sessions. No explicit named-fork UI or cross-project history is added.

Snapshots share unchanged image values. New cutouts can still cost many MB
per edit; there is no claim of infinite RAM. No automatic pruning is done, so
long sessions with many unique images can exhaust browser memory. Undo covers
project state, not undoing exported files, external services or app preferences.
