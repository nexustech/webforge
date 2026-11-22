import { describeChannels } from "./contract-kit.test-helper.js";
import { previewChannels } from "./preview.js";

describeChannels("preview", previewChannels, {
  // The address of a page the preview opened: the kit can't make an http address.
  previewNextOpened: { response: "http://127.0.0.1:54321/0123456789abcdef/index.html" },
});
