import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { createStore } from "zustand/vanilla";
import { PhonePreviewDialog, type PhoneState } from "./PhonePreviewDialog.js";

/** The dialog showing `state`, as Preview on Phone… opens it. */
function Showing({ state }: { readonly state: PhoneState }) {
  const [store] = useState(() => createStore<PhoneState>(() => state));
  return <PhonePreviewDialog state={store} />;
}

// File → Preview on Phone… (3.2, F-PV-1): the preview's address on the Wi-Fi as a QR code.
const meta = {
  title: "Preview/PhonePreviewDialog",
  component: Showing,
} satisfies Meta<typeof Showing>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The address as a code for the phone's camera, written out too, and who else can open it. */
export const Ready: Story = {
  args: {
    state: {
      status: "ready",
      url: "http://192.168.1.23:52114/4f9c2a7e1b6d3f08a5c7e9b2d4f6a8c0/index.html",
    },
  },
};

/** While the preview starts. */
export const Starting: Story = { args: { state: { status: "starting" } } };

/** The computer isn't on a network: what to do about it. */
export const Offline: Story = { args: { state: { status: "offline" } } };
