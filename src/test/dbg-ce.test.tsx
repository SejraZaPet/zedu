import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    if (el.classList.contains("pointer-events-none")) return { left:0,top:0,width:1600,height:900,right:1600,bottom:900,x:0,y:0,toJSON:()=>({}) } as DOMRect;
    return { left:160,top:90,width:800,height:180,right:960,bottom:270,x:160,y:90,toJSON:()=>({}) } as DOMRect;
  };
});
it("dbg", () => {
  const { container } = render(<SlideBody slide={{ projector:{headline:"H"}, blocks:[{id:"t1",type:"paragraph",visible:true,props:{text:"Ahoj"}} as any] }} editable onChangeBlock={vi.fn()} />);
  const els = container.querySelectorAll("[contenteditable]");
  els.forEach((e) => console.log("CE:", e.getAttribute("contenteditable"), e.className.slice(0,40)));
  expect(1).toBe(1);
});
