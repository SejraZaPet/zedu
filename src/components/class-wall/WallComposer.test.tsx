import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import WallComposer from "./WallComposer";
vi.mock("@/components/assignments/AssignmentDescriptionEditor", () => ({default: ({content,onChange}: {content:string;onChange:(s:string)=>void}) => <textarea aria-label="Text příspěvku" value={content} onChange={e=>onChange(e.target.value)} />}));
vi.mock("@/components/assignments/AssignmentMaterialsEditor", () => ({default:()=>null}));
afterEach(cleanup);
describe("wall compose decisions", () => {
  it("passes default email off and comments on to publication", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    render(<WallComposer teacherId="t" targetName="[TEST]" onCreate={()=>{}} onPublish={publish} />);
    fireEvent.click(screen.getByRole("button",{name:"Sdílej něco s třídou…"}));
    fireEvent.change(screen.getByRole("textbox"), {target:{value:"[TEST] Text"}});
    fireEvent.click(screen.getByRole("button",{name:"Zveřejnit"}));
    await waitFor(()=>expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][0]).toMatchObject({description:"[TEST] Text",notifyEmail:false,commentsEnabled:true});
  });
  it("retries using saved draft ID, never creates another on retry", async () => {
    const publish = vi.fn(async (_draft, id, saved) => { if (!id) { saved("draft-id"); throw new Error("[TEST] unavailable"); } });
    render(<WallComposer teacherId="t" targetName="[TEST]" onCreate={()=>{}} onPublish={publish} />);
    fireEvent.click(screen.getByRole("button",{name:"Sdílej něco s třídou…"}));
    fireEvent.change(screen.getByRole("textbox"), {target:{value:"[TEST] Text"}});
    fireEvent.click(screen.getByRole("button",{name:"Zveřejnit"}));
    await waitFor(()=>expect(publish).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect((screen.getByRole("button",{name:"Zveřejnit"}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button",{name:"Zveřejnit"}));
    await waitFor(()=>expect(publish).toHaveBeenCalledTimes(2));
    expect(publish.mock.calls[1][1]).toBe("draft-id");
  });
});