import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    if (el.classList.contains("pointer-events-none")) return { left:0,top:0,width:1600,height:900 } as any;
    return { left:160,top:90,width:800,height:180 } as any;
  };
});
it("dbg", () => {
  const onChangeBlock = vi.fn();
  const { container } = render(<SlideBody slide={{ projector:{headline:"H"}, blocks:[{id:"b1",type:"paragraph",visible:true,props:{text:"x"}} as any] }} editable onChangeBlock={onChangeBlock} />);
  const inner = container.querySelector("[data-slide-block-id='b1']");
  console.log("inner?", !!inner);
  const wrapper = inner!.closest("div.touch-none") as HTMLElement;
  console.log("wrapper?", !!wrapper, wrapper?.className);
  console.log("layer?", !!container.querySelector(".pointer-events-none"));
  fireEvent.pointerDown(wrapper, { button: 0, clientX: 200, clientY: 200 });
  fireEvent(window, new MouseEvent("pointermove", { clientX: 240, clientY: 200 } as any));
  console.log("calls", onChangeBlock.mock.calls.length);
});
