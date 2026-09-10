import { describe, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { LessonBlock } from "@/components/LessonBlockRenderer";
describe("d", () => { it("x", () => {
  const { container } = render(<LessonBlock block={{ id:"a", type:"paragraph", visible:true, props:{ text:"<p>x</p>", backgroundStyle:"tip" } } as any} />);
  console.log(container.innerHTML.slice(0,400));
});});
