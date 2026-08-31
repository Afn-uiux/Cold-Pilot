"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import DOMPurify from "dompurify";

export interface RichTextEditorHandle {
  exec(cmd: string, value?: string): void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor({ value, onChange, placeholder, className }, ref) {
    const divRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      exec(cmd, value) {
        const div = divRef.current;
        if (!div) return;
        div.focus();
        document.execCommand(cmd, false, value);
        onChange(div.innerHTML);
      },
    }));

    useEffect(() => {
      const div = divRef.current;
      if (!div) return;
      if (div.innerHTML !== value && document.activeElement !== div) {
        // this is a raw innerHTML sink; sanitize here rather than relying on
        // every caller feeding pre-cleaned data
        div.innerHTML = DOMPurify.sanitize(value);
      }
    }, [value]);

    return (
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={"rich-text-editor " + (className || "")}
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        onBlur={() => onChange(divRef.current?.innerHTML ?? value)}
      />
    );
  }
);

export default RichTextEditor;
