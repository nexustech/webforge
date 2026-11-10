import type { Area, WindowContext } from "../editor/areas.js";
import { registerNotes } from "./register-notes.js";

/** Notes on elements (UX-17, #868): their commands and their dialog. */
export const notesArea: Area<WindowContext> = {
  id: "notes",
  register: ({ commands, windowDialogs, session }) =>
    registerNotes(commands, windowDialogs, session),
};
