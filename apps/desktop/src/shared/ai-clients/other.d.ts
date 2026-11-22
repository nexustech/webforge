/** Any other app that connects to an MCP server at an address, such as Cursor (4.9, ADR 0021). */
export declare const otherApp: {
  readonly id: "other";
  readonly verifiesServer: false;
  readonly label: () => string;
  readonly defaultName: () => string;
  readonly hint: () => string;
  readonly copy: {
    readonly label: () => string;
    readonly copyLabel: () => string;
    readonly value: (address: string) => string;
  };
  readonly note: () => string;
};
//# sourceMappingURL=other.d.ts.map
