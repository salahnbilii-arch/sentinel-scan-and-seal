import { useRef, type ChangeEvent, type ClipboardEvent, type TextareaHTMLAttributes } from "react";

type CodeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  onValueChange: (next: string) => void;
};

/**
 * Textarea for source code and logs. Paste is handled explicitly so the
 * clipboard text is inserted VERBATIM — newlines included. Relying on the
 * controlled onChange path alone lost multi-line pastes in the field (mobile
 * soft keyboards sanitise the pasted payload before the input event fires),
 * which collapsed scanned code onto a single line.
 */
export function CodeTextarea({ value, onValueChange, ...rest }: CodeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => onValueChange(event.target.value);

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onValueChange(value.slice(0, start) + text + value.slice(end));
    const caret = start + text.length;
    requestAnimationFrame(() => {
      if (el) {
        el.selectionStart = caret;
        el.selectionEnd = caret;
      }
    });
  };

  return <textarea ref={ref} value={value} onChange={onChange} onPaste={onPaste} {...rest} />;
}
