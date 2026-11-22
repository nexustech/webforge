/**
 * Claude Desktop (4.9): through Webforge's extension, which Claude Desktop installs and which
 * checks it's Webforge it talks to before it sends the key (ADR 0021). Main writes the extension
 * (`main/ai-clients/claude-desktop.ts`).
 */
export declare const claudeDesktop: {
  readonly id: "claude";
  readonly verifiesServer: true;
  readonly label: () => string;
  readonly defaultName: () => string;
  readonly hint: () => string;
  readonly steps: {
    readonly title: () => string;
    readonly items: () => string[];
  };
  readonly install: {
    readonly label: () => string;
    readonly said: (
      status: "failed" | "off" | "opened" | "shown" | "unknown",
      name: string,
    ) => string;
  };
};
//# sourceMappingURL=claude-desktop.d.ts.map
