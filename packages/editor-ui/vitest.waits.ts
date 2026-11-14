import { configure } from "@testing-library/react";
import { WAIT_MS } from "../../vitest.load.js";

// Testing Library's waits last `WAIT_MS` by default (ADR 0014 §4, #1052), not one second.
configure({ asyncUtilTimeout: WAIT_MS });
