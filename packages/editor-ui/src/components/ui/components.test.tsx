import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog.js";
import { Button } from "./button.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command.js";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./context-menu.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "./menubar.js";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable.js";
import { ScrollArea, ScrollBar } from "./scroll-area.js";
import { Toaster, toast } from "./sonner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  WithTooltip,
} from "./tooltip.js";

// Test content is not UI text; the UI-string guard skips test files.

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("is a non-submitting button with the compact size by default", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toContain("h-7");
  });

  it("applies variants and sizes, and renders its child with asChild", () => {
    render(
      <>
        <Button variant="destructive" size="icon">
          X
        </Button>
        <Button asChild variant="link">
          <a href="#help">Help</a>
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "X" }).className).toContain("bg-destructive");
    const link = screen.getByRole("link", { name: "Help" });
    expect(link.className).toContain("text-info");
    expect(link.hasAttribute("type")).toBe(false);
  });
});

describe("Tabs", () => {
  it("switches content with the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="add">
        <TabsList>
          <TabsTrigger value="add">Add</TabsTrigger>
          <TabsTrigger value="layers">Layers</TabsTrigger>
        </TabsList>
        <TabsContent value="add">Add content</TabsContent>
        <TabsContent value="layers">Layers content</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole("tabpanel").textContent).toBe("Add content");
    await user.click(screen.getByRole("tab", { name: "Add" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tabpanel").textContent).toBe("Layers content");
    expect(screen.getByRole("tab", { name: "Layers" }).getAttribute("data-state")).toBe("active");
  });

  it("lifts a strip's active tab, and fills a side list's chosen row with the accent (#524, #564)", () => {
    const list = (orientation: "horizontal" | "vertical") =>
      render(
        <Tabs defaultValue="a" orientation={orientation}>
          <TabsList>
            <TabsTrigger value="a">{orientation}</TabsTrigger>
          </TabsList>
        </Tabs>,
      );
    list("horizontal");
    list("vertical");
    const strip = screen.getByRole("tab", { name: "horizontal" });
    const side = screen.getByRole("tab", { name: "vertical" });

    // Each style answers to its own orientation only: a side list's accent fill must not be
    // painted over by the strip's gradient, a background image (#564).
    expect(strip.getAttribute("data-orientation")).toBe("horizontal");
    expect(side.getAttribute("data-orientation")).toBe("vertical");
    for (const tab of [strip, side]) {
      const active = tab.className.split(" ").filter((name) => name.includes("[state=active]"));
      expect(
        active.every(
          (name) =>
            name.startsWith("data-[orientation=horizontal]:") ||
            name.startsWith("data-[orientation=vertical]:"),
        ),
        tab.className,
      ).toBe(true);
    }
    expect(side.className).toContain("data-[orientation=vertical]:data-[state=active]:bg-accent");
    expect(strip.className).toContain(
      "data-[orientation=horizontal]:data-[state=active]:bg-linear-to-b",
    );
  });
});

describe("ToggleGroup", () => {
  it("chooses one option", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ToggleGroup type="single" defaultValue="desktop" onValueChange={onValueChange}>
        <ToggleGroupItem value="desktop">Desktop</ToggleGroupItem>
        <ToggleGroupItem value="mobile">Mobile</ToggleGroupItem>
      </ToggleGroup>,
    );
    await user.click(screen.getByRole("radio", { name: "Mobile" }));
    expect(onValueChange).toHaveBeenCalledWith("mobile");
  });
});

describe("Dialog", () => {
  it("opens, has a translated close button, and closes", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Page Settings</DialogTitle>
            <DialogDescription>Title and description</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog", { name: "Page Settings" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: t("ui.close") }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("can leave out the close button", () => {
    render(
      <Dialog open>
        <DialogContent showClose={false} aria-describedby={undefined}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole("button", { name: t("ui.close") })).toBeNull();
  });
});

describe("AlertDialog", () => {
  it("confirms with the action and focuses Cancel first", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button>Delete page</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>You can undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await user.click(screen.getByRole("button", { name: "Delete page" }));
    expect(screen.getByRole("alertdialog", { name: "Delete page?" })).toBeTruthy();
    expect(document.activeElement?.textContent).toBe("Cancel");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("DropdownMenu", () => {
  it("shows items, checkbox and radio items, and runs the chosen item", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Publish</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Destinations</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onSelect}>
              Publish now<DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem inset variant="destructive">
              Remove
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>Open when done</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="netlify">
            <DropdownMenuRadioItem value="netlify">Netlify</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Settings</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Open when done" })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: "Netlify" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Remove" }).getAttribute("data-variant")).toBe(
      "destructive",
    );
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: /Publish now/ }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("ContextMenu", () => {
  it("opens on right-click", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Heading</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Heading</ContextMenuLabel>
          <ContextMenuItem>
            Duplicate<ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset variant="destructive">
            Delete
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem checked>Hidden</ContextMenuCheckboxItem>
          <ContextMenuSub open>
            <ContextMenuSubTrigger>Move</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Up</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText("Heading"));
    expect(screen.getByRole("menuitem", { name: /Duplicate/ })).toBeTruthy();
    expect(screen.getByRole("menuitemcheckbox", { name: "Hidden" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Up" })).toBeTruthy();
  });
});

describe("Menubar", () => {
  it("opens a menu from the bar", async () => {
    const user = userEvent.setup();
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              Reset Panels<MenubarShortcut>Ctrl+0</MenubarShortcut>
            </MenubarItem>
            <MenubarItem inset variant="destructive">
              Close
            </MenubarItem>
            <MenubarSeparator />
            <MenubarCheckboxItem checked>Advanced mode</MenubarCheckboxItem>
            <MenubarSub open>
              <MenubarSubTrigger>Theme</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>Dark</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    expect(screen.getByRole("menuitem", { name: /Reset Panels/ })).toBeTruthy();
    expect(screen.getByRole("menuitemcheckbox", { name: "Advanced mode" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Dark" })).toBeTruthy();
  });
});

describe("Command", () => {
  it("filters commands as you type and runs the chosen one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandEmpty>Nothing found</CommandEmpty>
          <CommandGroup heading="Pages">
            <CommandItem onSelect={onSelect}>
              Add page<CommandShortcut>Ctrl+N</CommandShortcut>
            </CommandItem>
            <CommandItem>Reset Panels</CommandItem>
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </Command>,
    );
    await user.type(screen.getByRole("combobox"), "add");
    expect(screen.queryByRole("option", { name: "Reset Panels" })).toBeNull();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("option", { name: /Add page/ }));
    expect(onSelect).toHaveBeenCalledTimes(2);
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("Nothing found")).toBeTruthy();
  });
});

describe("Tooltip", () => {
  it("shows its text when the trigger is focused", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Undo</Button>
          </TooltipTrigger>
          <TooltipContent>Undo the last change</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Undo" }).focus();
    });
    expect(await screen.findByRole("tooltip")).toBeTruthy();
  });

  it("stays shut for focus the keyboard didn't give, such as a dialog's after a click (5.5)", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Publish…</Button>
          </TooltipTrigger>
          <TooltipContent>Publish your site</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const button = screen.getByRole("button", { name: "Publish…" });
    const matches = button.matches.bind(button);
    // As Chromium answers after a click: the focus isn't the keyboard's.
    vi.spyOn(button, "matches").mockImplementation((selector) =>
      selector === ":focus-visible" ? false : matches(selector),
    );
    await act(async () => {
      button.focus();
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("is a button's tooltip prop, with no provider above and no title (#1011)", async () => {
    render(
      <Button size="icon" aria-label="Rotate" tooltip="Rotate the device">
        R
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Rotate" });
    expect(button.hasAttribute("title")).toBe(false);
    await act(async () => {
      button.focus();
    });
    expect((await screen.findByRole("tooltip")).textContent).toBe("Rotate the device");
  });

  it("shows a disabled button's tooltip on hover, from a wrapper (#1011)", async () => {
    render(
      <Button size="icon" aria-label="Move Up" tooltip="Move Up" disabled>
        U
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Move Up" });
    expect(button.parentElement?.tagName).toBe("SPAN");
    await userEvent.hover(button.parentElement ?? button);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Move Up");
  });

  it("keeps a button that can be disabled in its wrapper, enabled or not (#1011)", () => {
    const view = render(
      <Button size="icon" aria-label="Move Up" tooltip="Move Up" disabled={false}>
        U
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Move Up" });
    expect(button.parentElement?.tagName).toBe("SPAN");
    view.rerender(
      <Button size="icon" aria-label="Move Up" tooltip="Move Up" disabled>
        U
      </Button>,
    );
    // The same element: turning disabled didn't remount it.
    expect(screen.getByRole("button", { name: "Move Up" })).toBe(button);
  });

  it("describes a button in a wrapper by its tooltip while it's open (#1011)", async () => {
    render(
      <Button size="icon" aria-label="Copy" tooltip="Copy (Ctrl+C)" disabled={false}>
        C
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button.hasAttribute("aria-describedby")).toBe(false);
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await screen.findByRole("tooltip");
    // The button, not only the wrapper Radix describes: it's what a screen reader is on.
    const description = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Copy (Ctrl+C)");
  });

  it("describes a disabled button by its tooltip while it's disabled (#1011)", () => {
    const view = render(
      <Button size="icon" aria-label="Undo" tooltip="Nothing to undo." disabled>
        U
      </Button>,
    );
    // Not focusable, so its tooltip never opens from the keyboard: the reason is there anyway.
    const button = screen.getByRole("button", { name: "Undo" });
    const description = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Nothing to undo.");
    view.rerender(
      <Button size="icon" aria-label="Undo" tooltip="Nothing to undo." disabled={false}>
        U
      </Button>,
    );
    expect(button.hasAttribute("aria-describedby")).toBe(false);
  });

  it("keeps a button with a tooltip working as a menu's trigger (#1011)", async () => {
    render(
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button size="icon" aria-label="Add" tooltip="Add">
            +
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("menuitem", { name: "Link" })).toBeTruthy();
  });

  it("gives a toggle's option a tooltip, keeping its own on or off (#1011)", async () => {
    render(
      <ToggleGroup type="single" value="mobile">
        <ToggleGroupItem value="desktop" aria-label="Desktop" tooltip="Desktop (Ctrl+1)">
          D
        </ToggleGroupItem>
        <ToggleGroupItem value="mobile" aria-label="Mobile" tooltip="Mobile (Ctrl+3)">
          M
        </ToggleGroupItem>
      </ToggleGroup>,
    );
    const mobile = screen.getByRole("radio", { name: "Mobile" });
    expect(mobile.getAttribute("data-state")).toBe("on");
    expect(mobile.hasAttribute("title")).toBe(false);
    await userEvent.hover(mobile);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Mobile (Ctrl+3)");
    // The tooltip's trigger sets `data-state` too ("delayed-open"): the option's must win.
    expect(mobile.getAttribute("data-state")).toBe("on");
  });

  it("shows a tooltip on any element, and on a cut-short one only when it's cut (#1011)", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <WithTooltip tooltip="Locked">
          <span>L</span>
        </WithTooltip>
        <WithTooltip tooltip="Published to example.com" whenCut>
          <p className="truncate">Published to example.com</p>
        </WithTooltip>
      </TooltipProvider>,
    );
    // Its text fits (a test's page lays nothing out): no tooltip, even after a while.
    await userEvent.hover(screen.getByText("Published to example.com"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.hover(screen.getByText("L"));
    expect((await screen.findByRole("tooltip")).textContent).toBe("Locked");
  });
});

describe("ScrollArea", () => {
  it("renders its content in a viewport, with an optional horizontal bar", () => {
    render(
      <ScrollArea className="h-10" type="always">
        <p>Long content</p>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>,
    );
    expect(
      screen.getByText("Long content").closest("[data-slot=scroll-area-viewport]"),
    ).toBeTruthy();
  });
});

describe("Resizable", () => {
  it("lays out panels with a keyboard-operable separator", () => {
    render(
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="30%">Left</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>Canvas</ResizablePanel>
      </ResizablePanelGroup>,
    );
    expect(screen.getByText("Left")).toBeTruthy();
    expect(screen.getByRole("separator")).toBeTruthy();
  });
});

describe("Toaster", () => {
  // A closing toast leaves 200 ms later, on a timer of Sonner's that unmounting doesn't cancel. A
  // test that ends before then lets the timer fire after the environment's teardown, failing the
  // run on "window is not defined" (#1477). Before the file's cleanup, no toast is still closing.
  afterEach(() => {
    expect(
      document.querySelector('[data-sonner-toast][data-removed="true"]'),
      "a toast is still closing as the test ends (#1477)",
    ).toBeNull();
  });

  it("shows toasts with an action", async () => {
    const onUndo = vi.fn();
    render(<Toaster theme="light" />);
    act(() => {
      toast("Deleted Heading", { action: { label: "Undo", onClick: onUndo } });
    });
    expect(await screen.findByText("Deleted Heading")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
    // Its action closes the toast, which then leaves.
    await waitForElementToBeRemoved(() => screen.queryByText("Deleted Heading"));
  });
});
