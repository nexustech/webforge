// Fixture for check-react-compiler: what the compiler reports or skips.
import { useRef } from "react";

export function ReadsRefWhileDrawing({ value }: { readonly value: string }) {
  const last = useRef(value);
  return <p>{last.current}</p>;
}

export function OptedOut() {
  "use no memo";
  return <p />;
}
