/**
 * Claude Code (5.13, AIA-13): at the address directly, added by a command the person runs, with
 * the key in an environment variable, never in the command. Its setup is three steps, each with
 * what it copies (#1245): the command that adds it, the one that gives the terminal the key for
 * this computer's shell, with the key, and starting Claude Code in that terminal.
 */
export declare const claudeCode: {
  readonly id: "claudeCode";
  readonly verifiesServer: false;
  readonly label: () => string;
  readonly defaultName: () => string;
  readonly hint: () => string;
  readonly setup: {
    readonly title: () => string;
    readonly steps: (
      address: string,
      shell: import("../mcp-setup.js").ShellKind,
    ) => (
      | {
          text: string;
          command: {
            value: string;
            copyLabel: string;
          };
          key?: never;
        }
      | {
          text: string;
          command: {
            value: string;
            copyLabel: string;
          };
          key: true;
        }
      | {
          command?: never;
          key?: never;
          text: string;
        }
    )[];
  };
  readonly note: () => string;
};
//# sourceMappingURL=claude-code.d.ts.map
