import type { Meta, StoryObj } from "@storybook/react-vite";
import type { LicencesResult, Notice } from "../../shared/ipc/app.js";
import { type LicencesApi, LicencesDialog } from "./LicencesDialog.js";

/** A few of the packages the app ships, as its build lists them. */
const PACKAGES: Notice[] = [
  {
    name: "@fontsource-variable/inter",
    version: "5.2.8",
    licence: "OFL-1.1",
    homepage: "https://fontsource.org/fonts/inter",
    text: "Copyright 2020 The Inter Project Authors\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.",
  },
  { name: "@puckeditor/core", version: "0.23.0", licence: "MIT", text: "MIT License" },
  { name: "better-sqlite3", version: "12.5.0", licence: "MIT", text: "The MIT License (MIT)" },
  {
    name: "electron",
    version: "44.10.2",
    licence: "MIT",
    text: "Copyright (c) Electron contributors",
  },
  { name: "react", version: "19.2.0", licence: "MIT", text: "MIT License" },
  { name: "ssh2", version: "1.17.0", licence: "MIT", text: "Copyright Brian White." },
  {
    name: "tweetnacl",
    version: "0.14.5",
    licence: "Unlicense",
    text: "This is free and unencumbered software released into the public domain.",
  },
  { name: "zod", version: "4.3.6", licence: "MIT", text: "MIT License" },
];

/** The main process's side: the list as `result`. */
const licencesOf = (result: LicencesResult): LicencesApi => ({
  listLicences: async () => result,
  openChromiumLicences: async () => true,
});

const meta = {
  title: "Dialogs/Open-Source Licences",
  component: LicencesDialog,
  tags: ["full-window"],
  args: {
    open: true,
    onOpenChange: () => undefined,
    licences: licencesOf({ status: "listed", packages: PACKAGES }),
  },
} satisfies Meta<typeof LicencesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every package with its version and licence, found by name or licence. */
export const Licences: Story = {};

/** The build's list couldn't be read: Chromium's are still there. */
export const CouldNotRead: Story = {
  args: { licences: licencesOf({ status: "failed" }) },
};
