import { createContext, useContext } from "react";

/** Element that Radix popups (Select, Popover, Dropdown, Tooltip) portal into.
 * Fullscreen/high z-index layers provide their own element so popups stay visible above them. */
export const PortalContainerContext = createContext<HTMLElement | null>(null);
export const usePortalContainer = () => useContext(PortalContainerContext) ?? undefined;
