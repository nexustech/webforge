// Fixture for check-react-compiler: a component and a hook the compiler compiles.
import { useRef, useState } from "react";

export function useCount(start: number) {
  const [count, setCount] = useState(start);
  return { count, add: () => setCount((current) => current + 1) };
}

export function Counter({ start }: { readonly start: number }) {
  const { count, add } = useCount(start);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <button ref={button} type="button" onClick={() => add()}>
      {count}
    </button>
  );
}
