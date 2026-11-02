import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Když se změní (např. data položky), boundary se sama obnoví. */
  resetKey?: string;
}
interface State {
  hasError: boolean;
  lastKey?: string;
}

/** Zachytí pád náhledu jedné položky, aby nezbělal celý editor. */
export default class EditorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, lastKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.lastKey) return { hasError: false, lastKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: unknown) {
    console.error("EditorErrorBoundary", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <p className="mb-2 text-foreground">
          Náhled této aktivity se nepodařilo zobrazit. Vaše práce je uložená, upravte prosím aktivitu nebo klikněte na Zkusit znovu.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            this.setState({ hasError: false });
          }}
        >
          Zkusit znovu
        </Button>
      </div>
    );
  }
}
