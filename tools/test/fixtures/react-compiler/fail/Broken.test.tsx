// Fixture for check-react-compiler: tests aren't checked, whatever they do.
import { useRef } from "react";

export function ReadsRefInATest() {
  const last = useRef("x");
  return <p>{last.current}</p>;
}
