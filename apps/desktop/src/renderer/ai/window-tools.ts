import { type WindowToolName, windowTool } from "../../shared/ai-tools.js";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";

/** The window's answer to each of its own tools (#981): one missing fails typecheck. */
export type WindowToolHandlers = {
  readonly [name in WindowToolName]: (request: AiRequest) => AiResponse | Promise<AiResponse>;
};

/**
 * `request` answered by the window's own tool, if it's for one (4.9, #981): by its definition,
 * and only as the kind it is. Anything else is the command layer's, and `undefined` here. A held
 * reply (6.9e) has only those that read: a change of its goes to its draft, never to the site.
 */
export function answerWindowTool(
  handlers: WindowToolHandlers,
  request: AiRequest,
): AiResponse | Promise<AiResponse> | undefined {
  const tool = windowTool(request.name);
  if (tool === undefined || tool.kind !== request.kind) return undefined;
  if (request.stage !== undefined && tool.kind !== "query") return undefined;
  return handlers[tool.name](request);
}
