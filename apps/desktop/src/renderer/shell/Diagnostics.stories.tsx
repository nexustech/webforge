import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiagnosticsDialog } from "./Diagnostics.js";

// Help › Diagnostics… (5.41, BD-2): what the usage summary holds, in words, before a tester saves
// it to attach to a report. Nothing is sent.

const noop = () => undefined;

const meta = {
  title: "Dialogs/Diagnostics",
  component: DiagnosticsDialog,
  tags: ["full-window"],
  args: {
    open: true,
    onOpenChange: noop,
    status: null,
    onSave: noop,
    onOpenFolder: noop,
    onClear: noop,
    diagnostics: {
      installId: "5d0c1f6e-6a2b-4c3d-8e9f-0a1b2c3d4e5f",
      since: Date.UTC(2026, 10, 1),
      computer: {
        version: "0.3.0",
        channel: "beta",
        platform: "win32",
        arch: "x64",
        osVersion: "10.0.26300",
        memoryGb: 16,
        scale: 1.5,
        language: "en",
      },
      counts: [
        { field: "sites.started", name: "template", count: 3 },
        { field: "sites.templates", name: "cafe", count: 2 },
        { field: "sites.firstEdits", count: 4 },
        { field: "sites.previews", count: 5 },
        { field: "sites.exports", count: 1 },
        { field: "tour.taken", count: 1 },
        { field: "used.added", name: "Hero", count: 2 },
        { field: "failures.crashReports", count: 1 },
      ],
      timings: [
        { field: "startup", samples: 3, medianMs: 1100 },
        { field: "openSite", samples: 2, medianMs: 2400 },
        { field: "export", samples: 0, medianMs: 0 },
        { field: "preview", samples: 0, medianMs: 0 },
      ],
    },
  },
} satisfies Meta<typeof DiagnosticsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A tester's summary after a few days: what they did, what failed, and how long things took. */
export const Summary: Story = {};

/** Just saved, to attach to a report. */
export const Saved: Story = { args: { status: "saved" } };
