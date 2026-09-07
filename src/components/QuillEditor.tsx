import React, { useEffect, useRef } from 'react';
import Quill from 'quill';

interface QuillEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export const QuillEditor: React.FC<QuillEditorProps> = ({
  value,
  onChange,
  placeholder = 'Nhập nội dung bài giảng tại đây...',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const isInternalChangeRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear container to prevent duplicate toolbars/editors
    containerRef.current.innerHTML = '';

    const editorDiv = document.createElement('div');
    containerRef.current.appendChild(editorDiv);

    const quill = new Quill(editorDiv, {
      theme: 'snow',
      placeholder: placeholder,
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: [] }],
          ['clean'],
        ],
      },
    });

    quillRef.current = quill;

    if (value) {
      quill.root.innerHTML = value;
    }

    quill.on('text-change', (_delta, _oldDelta, source) => {
      if (source === 'user') {
        isInternalChangeRef.current = true;
        const html = quill.root.innerHTML;
        onChange(html);
        isInternalChangeRef.current = false;
      }
    });

    return () => {
      quillRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  // Update value from outside if changed externally
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    if (isInternalChangeRef.current) return;

    const currentHtml = quill.root.innerHTML;
    if (value !== currentHtml) {
      const selection = quill.getSelection();
      quill.root.innerHTML = value || '';
      if (selection) {
        try {
          quill.setSelection(selection);
        } catch {
          // ignore selection out of bounds
        }
      }
    }
  }, [value]);

  return (
    <div className={`quill-editor-wrapper bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs ${className}`}>
      <div ref={containerRef} className="min-h-[280px] text-slate-900 text-sm font-sans" />
    </div>
  );
};
