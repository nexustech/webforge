import type { Decorator } from "@storybook/react-vite";
import { useState } from "react";
import { EditPanel, type EditPanelField } from "./edit-panel.js";

/**
 * One field in an Edit panel, for the Edit/Fields stories (R11): its label, help, error and device
 * dot drawn as the panel draws them. Changes to its value are kept; a list's changes aren't.
 */
export function FieldStory({
  field,
  device,
}: {
  readonly field: EditPanelField;
  /** The device being viewed, for a field set for one device only. */
  readonly device?: string;
}) {
  const [value, setValue] = useState(field.value);
  return (
    <EditPanel
      heading="Section"
      device={device}
      fields={[{ ...field, value }]}
      // A list reports a change to the list, not its new value: see the RepeatingList story.
      onChange={(_name, next) => (field.kind === "list" ? undefined : setValue(next))}
      onCommit={() => undefined}
    />
  );
}

/** The panel's size in the Edit/Fields stories. */
export const fieldStoryFrame: Decorator = (Story) => (
  <div className="h-96 w-72 bg-panel">
    <Story />
  </div>
);
