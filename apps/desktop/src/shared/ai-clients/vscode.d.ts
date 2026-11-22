/**
 * VS Code, for GitHub Copilot (5.13, AIA-13): at the address directly, added through its install
 * link, which main opens (`main/ai-clients/vscode.ts`). VS Code asks for the key, and keeps it.
 */
export declare const vsCode: {
  readonly id: "vscode";
  readonly verifiesServer: false;
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
//# sourceMappingURL=vscode.d.ts.map
