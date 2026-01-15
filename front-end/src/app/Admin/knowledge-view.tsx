'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
  useRef,
} from 'react';
import {
  DatabaseZap,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Pencil,
  ToggleLeft,
  ToggleRight,
  FileText,
  PlusCircle,
  Save,
  CornerDownLeft,
  Loader2,
  BookOpen,
  X,
  Cloud,
  CloudOff,
  AlertCircle,
  Maximize2,
  Minimize2,
  Table as TableIcon,
  List,
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import { toast } from 'sonner';

// ===== INTERFACES =====
interface KnowledgeItem {
  _id: string;
  topic: string;
  content: string;
  category: string;
  status: 'ACTIVE' | 'INACTIVE';
  is_sync: boolean;
  updatedAt: string;
}

interface CategoryOption {
  label: string;
  value: string;
}

interface KnowledgeViewProps {
  onBack: () => void;
}

interface KnowledgeListResponse {
  data: KnowledgeItem[];
}

interface SingleKnowledgeResponse {
  data: KnowledgeItem;
}

interface RagUpdateResponse {
  Message: string;
}

interface ErrorResponse {
  message: string;
}

interface KnowledgeDetailPanelProps {
  item: KnowledgeItem | null;
  mode: 'view' | 'edit' | 'add';
  onSave: (
    formData: Omit<KnowledgeItem, '_id' | 'updatedAt' | 'is_sync'>,
    isNew: boolean
  ) => void;
  onCancel: () => void;
  onEdit: () => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
  panelHeight?: number | undefined;
}

// -----------------------------
// LAZY Markdown Renderer
// -----------------------------
interface ReactMarkdownProps {
  children?: React.ReactNode;
  remarkPlugins?: unknown[];
  components?: Record<string, unknown>;
}

function MarkdownRenderer({ content }: { content: string }) {
  const [ReactMarkdownComponent, setReactMarkdownComponent] =
    useState<React.ComponentType<ReactMarkdownProps> | null>(null);
  const [remarkGfmPlugin, setRemarkGfmPlugin] = useState<unknown | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [rmModule, gfmModule] = await Promise.all([
          import('react-markdown'),
          import('remark-gfm'),
        ]);
        if (!mounted) return;

        const rmCandidate =
          (rmModule as { default?: React.ComponentType<ReactMarkdownProps> })
            .default ??
          (rmModule as unknown as React.ComponentType<ReactMarkdownProps>);

        const gfmCandidate =
          (gfmModule as { default?: unknown }).default ?? gfmModule;

        setReactMarkdownComponent(() => rmCandidate);
        setRemarkGfmPlugin(() => gfmCandidate);
      } catch (e) {
        console.error('Failed to load markdown renderer:', e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ReactMarkdownComponent || !remarkGfmPlugin) {
    return (
      <div className='prose prose-sm max-w-none text-[#13484f]'>
        <div className='whitespace-pre-wrap text-[#13484f]'>{content}</div>
      </div>
    );
  }

  const ReactMarkdown = ReactMarkdownComponent;
  const remarkGfm = remarkGfmPlugin;

  return (
    <div className='prose prose-sm max-w-none text-[#13484f]'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ ...props }) => (
            <div className='overflow-x-auto my-4 border border-[#13484f]/40 rounded-lg shadow-sm'>
              <table
                className='min-w-full divide-y divide-[#13484f]/20 text-sm'
                {...props}
              />
            </div>
          ),
          thead: ({ ...props }) => (
            <thead className='bg-[#13484f]/10' {...props} />
          ),
          th: ({ ...props }) => (
            <th
              className='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider
                         text-[#13484f] border-b border-[#13484f]/30'
              {...props}
            />
          ),
          tbody: ({ ...props }) => (
            <tbody
              className='divide-y divide-[#13484f]/20 bg-white/30'
              {...props}
            />
          ),
          tr: ({ ...props }) => (
            <tr className='hover:bg-[#13484f]/5 transition-colors' {...props} />
          ),
          td: ({ ...props }) => (
            <td
              className='px-4 py-3 whitespace-pre-wrap text-[#13484f]
                         border-r last:border-r-0 border-[#13484f]/20 align-top'
              {...props}
            />
          ),
          ul: ({ ...props }) => (
            <ul
              className='list-disc pl-5 space-y-1 my-2 text-[#13484f]'
              {...props}
            />
          ),
          ol: ({ ...props }) => (
            <ol
              className='list-decimal pl-5 space-y-1 my-2 text-[#13484f]'
              {...props}
            />
          ),
          li: ({ ...props }) => <li className='pl-1' {...props} />,
          h1: ({ ...props }) => (
            <h1
              className='text-2xl font-bold mt-6 mb-4 text-[#13484f]'
              {...props}
            />
          ),
          h2: ({ ...props }) => (
            <h2
              className='text-xl font-bold mt-5 mb-3 border-b border-[#13484f]/30 pb-2 text-black'
              {...props}
            />
          ),
          h3: ({ ...props }) => (
            <h3
              className='text-lg font-semibold mt-4 mb-2 text-[#13484f]'
              {...props}
            />
          ),
          strong: ({ ...props }) => (
            <span className='font-bold text-[#13484f]' {...props} />
          ),
          p: ({ ...props }) => (
            <p className='mb-3 leading-relaxed text-[#13484f]' {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// -----------------------------
// NEW: TABLE WIZARD MODAL (Styled to match Glassmorphism)
// -----------------------------
const TableWizardModal = ({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (markdown: string) => void;
}) => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [gridData, setGridData] = useState<string[][]>(
    Array(3)
      .fill('')
      .map(() => Array(3).fill(''))
  );

  useEffect(() => {
    setGridData((prev) => {
      const newGrid = Array(rows)
        .fill('')
        .map((_, rIndex) =>
          Array(cols)
            .fill('')
            .map((_, cIndex) => (prev[rIndex] && prev[rIndex][cIndex]) || '')
        );
      return newGrid;
    });
  }, [rows, cols]);

  const handleCellChange = (r: number, c: number, val: string) => {
    const newGrid = [...gridData];
    newGrid[r] = [...newGrid[r]];
    newGrid[r][c] = val;
    setGridData(newGrid);
  };

  const generateMarkdown = () => {
    if (rows < 1 || cols < 1) return;
    let md = '\n';
    // Header
    md +=
      '| ' +
      gridData[0].map((cell) => cell.trim() || 'Header').join(' | ') +
      ' |\n';
    // Separator
    md += '| ' + Array(cols).fill('---').join(' | ') + ' |\n';
    // Body
    for (let r = 1; r < rows; r++) {
      md +=
        '| ' +
        gridData[r].map((cell) => cell.trim() || ' ').join(' | ') +
        ' |\n';
    }
    md += '\n';
    onInsert(md);
    onClose();
  };

  return (
    <div className='fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95'>
      <div className='bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-[#13484f]/20'>
        {/* Header */}
        <div className='px-6 py-4 border-b border-[#13484f]/10 bg-[#13484f]/5 flex justify-between items-center'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-[#13484f]/10 rounded-lg text-[#13484f]'>
              <TableIcon className='w-5 h-5' />
            </div>
            <div>
              <h3 className='font-bold text-lg text-[#13484f]'>Table Wizard</h3>
              <p className='text-xs text-[#13484f]/70'>
                Buat tabel seperti di Excel.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-[#13484f]/10 rounded-full text-[#13484f]/60 hover:text-[#13484f] transition-colors'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Toolbar */}
        <div className='px-6 py-3 border-b border-[#13484f]/10 bg-white/50 flex items-center gap-4 text-sm'>
          <div className='flex items-center gap-2'>
            <label className='font-medium text-[#13484f]'>Baris:</label>
            <input
              type='number'
              min='2'
              max='20'
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value) || 2)}
              className='w-16 border border-[#13484f]/30 rounded px-2 py-1 text-center bg-white text-[#13484f]'
            />
          </div>
          <div className='flex items-center gap-2'>
            <label className='font-medium text-[#13484f]'>Kolom:</label>
            <input
              type='number'
              min='1'
              max='6'
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value) || 1)}
              className='w-16 border border-[#13484f]/30 rounded px-2 py-1 text-center bg-white text-[#13484f]'
            />
          </div>
        </div>

        {/* Grid Area */}
        <div className='flex-1 overflow-auto p-6 bg-[#13484f]/5'>
          <div className='inline-block min-w-full'>
            <div
              className='grid gap-1'
              style={{
                gridTemplateColumns: `50px repeat(${cols}, minmax(150px, 1fr))`,
              }}
            >
              <div className='bg-transparent'></div>
              {Array(cols)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={`h-${i}`}
                    className='text-center text-xs font-bold text-[#13484f] uppercase pb-1'
                  >
                    Kolom {i + 1}
                  </div>
                ))}
              {gridData.map((row, rIndex) => (
                <React.Fragment key={`row-${rIndex}`}>
                  <div className='flex items-center justify-center text-xs font-bold text-[#13484f]/60 bg-[#13484f]/10 rounded border border-[#13484f]/10'>
                    {rIndex === 0 ? 'HEAD' : rIndex}
                  </div>
                  {row.map((cell, cIndex) => (
                    <input
                      key={`${rIndex}-${cIndex}`}
                      value={cell}
                      onChange={(e) =>
                        handleCellChange(rIndex, cIndex, e.target.value)
                      }
                      placeholder={
                        rIndex === 0 ? 'Judul Header' : 'Isi data...'
                      }
                      className={`w-full p-2 text-sm border rounded focus:ring-2 focus:ring-[#13484f]/30 outline-none transition-all
                          ${
                            rIndex === 0
                              ? 'bg-[#13484f]/10 font-bold text-[#13484f] border-[#13484f]/30'
                              : 'bg-white text-[#13484f] border-[#13484f]/20'
                          }`}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='p-4 border-t border-[#13484f]/10 bg-white flex justify-end gap-3'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-[#13484f] hover:bg-[#13484f]/5 rounded-lg text-sm font-medium'
          >
            Batal
          </button>
          <button
            onClick={generateMarkdown}
            className='px-6 py-2 bg-[#13484f] hover:bg-[#0f3c42] text-white rounded-lg text-sm font-medium shadow-lg flex items-center gap-2'
          >
            <TableIcon className='w-4 h-4' />
            Sisipkan Tabel
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------
// Modals & Overlays
// -----------------------------
const MarkdownGuideModal = ({ onClose }: { onClose: () => void }) => (
  <div className='fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity'>
    <div className='bg-white rounded-2xl shadow-2xl border border-white/20 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200'>
      <div className='px-6 py-4 border-b border-[#13484f]/10 flex justify-between items-center bg-[#13484f]/5'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-[#13484f]/10 rounded-lg'>
            <BookOpen className='w-5 h-5 text-[#13484f]' />
          </div>
          <div>
            <h3 className='font-bold text-lg text-[#13484f]'>Panduan Format</h3>
            <p className='text-xs text-[#13484f]/60'>Cheat sheet Markdown</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className='p-2 hover:bg-[#13484f]/10 rounded-full transition-colors text-[#13484f]/50 hover:text-[#13484f]'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      <div className='p-6 overflow-y-auto space-y-8 bg-white'>
        {/* Konten panduan (Sama seperti sebelumnya tapi style disesuaikan) */}
        <div className='space-y-4'>
          <p className='text-sm text-[#13484f]'>
            Gunakan tombol <strong>+ Table Wizard</strong> untuk membuat tabel
            dengan mudah tanpa mengetik kode.
          </p>
        </div>
      </div>

      <div className='p-4 border-t border-[#13484f]/10 bg-white flex justify-end'>
        <button
          onClick={onClose}
          className='px-6 py-2.5 bg-[#13484f] hover:bg-[#0f3c42] text-white rounded-xl text-sm font-semibold shadow-lg'
        >
          Saya Mengerti
        </button>
      </div>
    </div>
  </div>
);

const RagOverlay = ({ visible }: { visible: boolean }) =>
  visible ? (
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center'>
        <div className='absolute inset-0 bg-black/30 backdrop-blur-sm' />
        <div className='relative z-10 max-w-lg w-[90%] bg-white rounded-lg p-4 flex items-start gap-3 shadow-xl'>
          <Loader2 className='w-5 h-5 text-[#13484f] animate-spin' />
          <div>
            <div className='font-semibold text-[#13484f]'>
              Memperbarui RAG — Mohon tunggu
            </div>
            <div className='text-sm text-[#13484f]/70'>
              Proses indexing sedang berjalan di server.
            </div>
          </div>
        </div>
      </div>
    </>
  ) : null;

// ===========================================
// RICH EDITOR (With Sync Scroll, Fullscreen, & Wizard)
// ===========================================

const insertAtCursor = (
  input: HTMLTextAreaElement,
  textToInsert: string,
  cursorOffset = 0
) => {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const text = input.value;
  const before = text.substring(0, start);
  const after = text.substring(end, text.length);

  const newValue = before + textToInsert + after;

  return {
    value: newValue,
    newCursorPos: start + textToInsert.length + cursorOffset,
  };
};

const RichMarkdownEditor = ({
  name,
  value,
  onChange,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) => {
  const [viewMode, setViewMode] = useState<'write' | 'split' | 'preview'>(
    'split'
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // --- SYNC SCROLL LOGIC ---
  const handleScroll = useCallback(
    (source: HTMLElement, target: HTMLElement) => {
      if (isScrollingRef.current) return;

      // Use requestAnimationFrame for smoothness
      window.requestAnimationFrame(() => {
        isScrollingRef.current = true;
        const percentage =
          source.scrollTop / (source.scrollHeight - source.clientHeight);

        if (target) {
          target.scrollTop =
            percentage * (target.scrollHeight - target.clientHeight);
        }

        setTimeout(() => {
          isScrollingRef.current = false;
        }, 50);
      });
    },
    []
  );

  useEffect(() => {
    const editor = textareaRef.current;
    const preview = previewRef.current;

    if (!editor || !preview) return;

    const handleEditorScroll = () => handleScroll(editor, preview);
    const handlePreviewScroll = () => handleScroll(preview, editor);

    editor.addEventListener('scroll', handleEditorScroll);
    preview.addEventListener('scroll', handlePreviewScroll);

    return () => {
      editor.removeEventListener('scroll', handleEditorScroll);
      preview.removeEventListener('scroll', handlePreviewScroll);
    };
  }, [handleScroll, viewMode]);

  // --- HANDLERS ---
  const handleToolbarClick = (action: string) => {
    if (action === 'table-wizard') {
      setShowWizard(true);
      return;
    }

    if (!textareaRef.current) return;

    let insertion = '';
    let offset = 0;

    switch (action) {
      case 'bold':
        insertion = '**Teks Tebal**';
        offset = -2;
        break;
      case 'italic':
        insertion = '*Teks Miring*';
        offset = -1;
        break;
      case 'h2':
        insertion = '\n## Sub Judul\n';
        offset = 0;
        break;
      case 'list':
        insertion = '\n- Poin 1\n- Poin 2\n';
        offset = 0;
        break;
    }

    const result = insertAtCursor(textareaRef.current, insertion, offset);

    const event = {
      target: { name, value: result.value },
    } as React.ChangeEvent<HTMLTextAreaElement>;

    onChange(event);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          result.newCursorPos,
          result.newCursorPos
        );
      }
    }, 0);
  };

  const handleWizardInsert = (markdown: string) => {
    if (!textareaRef.current) return;
    const result = insertAtCursor(textareaRef.current, markdown, 0);

    const event = {
      target: { name, value: result.value },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange(event);
  };

  // --- RENDER ---
  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-[#f8fafc] flex flex-col p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200' // Solid light background for Zen Mode
    : 'flex flex-col border border-[#13484f]/40 rounded-lg overflow-hidden bg-white/5 h-full min-h-[400px] transition-all duration-300'; // Glass mode for normal

  return (
    <>
      {showWizard && (
        <TableWizardModal
          onClose={() => setShowWizard(false)}
          onInsert={handleWizardInsert}
        />
      )}

      <div className={containerClass}>
        {/* TOOLBAR */}
        <div className='flex flex-wrap items-center justify-between p-2 border-b border-[#13484f]/20 bg-[#13484f]/5 shrink-0 gap-2'>
          <div className='flex gap-1 items-center'>
            <button
              type='button'
              onClick={() => handleToolbarClick('bold')}
              className='p-1.5 hover:bg-[#13484f]/10 rounded text-[#13484f] transition-colors'
              title='Bold'
            >
              <strong className='font-bold text-xs font-serif'>B</strong>
            </button>
            <button
              type='button'
              onClick={() => handleToolbarClick('italic')}
              className='p-1.5 hover:bg-[#13484f]/10 rounded text-[#13484f] transition-colors'
              title='Italic'
            >
              <em className='italic text-xs font-serif'>I</em>
            </button>
            <div className='w-px h-5 bg-[#13484f]/20 mx-1' />
            <button
              type='button'
              onClick={() => handleToolbarClick('list')}
              className='flex items-center gap-1.5 px-3 py-1 bg-[#13484f]/10 hover:bg-[#13484f]/20 text-[#13484f] rounded-md text-xs font-bold transition-colors ml-2 border border-[#13484f]/10s'
              title='List'
            >
              <List className='w-3.5 h-3.5' />
              <span>List</span>
            </button>

            {/* BUTTON TABLE WIZARD */}
            <button
              type='button'
              onClick={() => handleToolbarClick('table-wizard')}
              className='flex items-center gap-1.5 px-3 py-1 bg-[#13484f]/10 hover:bg-[#13484f]/20 text-[#13484f] rounded-md text-xs font-bold transition-colors ml-2 border border-[#13484f]/10'
              title='Buka Table Wizard'
            >
              <TableIcon className='w-3.5 h-3.5' />
              <span>Table Wizard</span>
            </button>
          </div>

          <div className='flex items-center gap-3'>
            <div className='flex bg-[#13484f]/10 rounded-md p-0.5'>
              {(['write', 'split', 'preview'] as const).map((m) => (
                <button
                  key={m}
                  type='button'
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1 text-[10px] uppercase font-bold rounded-sm transition-all ${
                    viewMode === m
                      ? 'bg-white shadow-sm text-[#13484f]'
                      : 'text-[#13484f]/60 hover:text-[#13484f]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              type='button'
              onClick={() => setIsFullscreen(!isFullscreen)}
              className='p-1.5 hover:bg-[#13484f]/10 rounded text-[#13484f] transition-colors'
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className='w-4 h-4' />
              ) : (
                <Maximize2 className='w-4 h-4' />
              )}
            </button>
          </div>
        </div>

        {/* EDITOR & PREVIEW AREA */}
        <div className='flex flex-1 overflow-hidden relative'>
          {/* LEFT: Writing Area */}
          <div
            className={`h-full flex flex-col transition-all duration-300 ${
              viewMode === 'preview'
                ? 'w-0 hidden'
                : viewMode === 'split'
                ? 'w-1/2 border-r border-[#13484f]/20'
                : 'w-full'
            }`}
          >
            <textarea
              ref={textareaRef}
              name={name}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              className='w-full h-full p-6 bg-transparent resize-none focus:outline-none text-sm font-mono leading-relaxed text-[#13484f] placeholder-[#13484f]/40'
              spellCheck={false}
              style={{ tabSize: 2 }}
            />
          </div>

          {/* RIGHT: Preview Area */}
          <div
            ref={previewRef}
            className={`h-full overflow-y-auto bg-white/40  transition-all duration-300 ${
              viewMode === 'write'
                ? 'w-0 hidden'
                : viewMode === 'split'
                ? 'w-1/2'
                : 'w-full'
            }`}
          >
            <div className='mb-4 text-[10px] font-bold text-[#13484f]/50 uppercase tracking-widest border-b border-[#13484f]/10 pb-2 select-none sticky top-0 bg-transparent backdrop-blur-sm z-10'>
              Live Preview, Perhatikan lagi Bagian kiri dengan kanan, karena ada perbedaan FPS antara Raw Data dengan React Markdown maka sinkronisasi posisi scroll mungkin tidak 100% akurat 
            </div>
            <div className='px-7 pb-6'>
              <Suspense
                fallback={
                  <Loader2 className='animate-spin w-5 h-5 text-[#13484f]' />
                }
              >
                <MarkdownRenderer content={value || '_Belum ada konten..._'} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// -----------------------------
// Modified InputField (Supports Rich Editor)
// -----------------------------
const InputField = ({
  label,
  name,
  value,
  onChange,
  isEditing,
  type = 'text',
  rows = 5,
  placeholder,
  useMarkdown = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  isEditing: boolean;
  type?: string;
  rows?: number;
  placeholder?: string;
  useMarkdown?: boolean;
}) => (
  <div className='mb-4 flex flex-col'>
    <label className='block text-sm font-medium text-[#13484f] mb-1'>
      {label}
    </label>
    {isEditing ? (
      type === 'textarea' && useMarkdown ? (
        <div className='flex-1'>
          <RichMarkdownEditor
            name={name}
            value={value}
            onChange={onChange as React.ChangeEventHandler<HTMLTextAreaElement>}
            placeholder={placeholder}
          />
        </div>
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          className='w-full bg-white/5 border border-[#13484f]/40 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#13484f]/30 focus:border-transparent transition-colors font-mono text-[#13484f] placeholder-[#13484f]/40'
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className='w-full bg-white/5 border border-[#13484f]/40 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#13484f]/30 focus:border-transparent transition-colors text-[#13484f] placeholder-[#13484f]/40'
        />
      )
    ) : (
      <div className='bg-white/5 p-4 rounded-lg text-sm leading-relaxed border border-[#13484f]/40 text-[#13484f] overflow-x-auto backdrop-blur-sm max-h-[500px] overflow-y-auto'>
        {useMarkdown ? (
          <Suspense
            fallback={<div className='text-sm text-[#13484f]'>{value}</div>}
          >
            <MarkdownRenderer content={value} />
          </Suspense>
        ) : (
          <span className='whitespace-pre-wrap text-[#13484f]'>{value}</span>
        )}
      </div>
    )}
  </div>
);

// ===== MAIN COMPONENT =====
export default function KnowledgeView({ onBack }: KnowledgeViewProps) {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view');
  const [isLoading, setIsLoading] = useState({
    list: true,
    rag: false,
    save: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for measuring layout
  const rootRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined);

  const calculatePanelHeight = useCallback(() => {
    const vw = window.innerWidth;
    if (vw < 1024) {
      setPanelHeight(undefined);
      return;
    }
    const rootRect = rootRef.current?.getBoundingClientRect();
    const headerRect = headerRef.current?.getBoundingClientRect();

    const availableHeight =
      (rootRect?.height ?? window.innerHeight) - (headerRect?.height ?? 0);
    const paddingSubtract = 32 + 24;
    const computed = Math.max(360, availableHeight - paddingSubtract);
    setPanelHeight(computed);
  }, []);

  useEffect(() => {
    calculatePanelHeight();
    const handler = () => {
      calculatePanelHeight();
    };
    window.addEventListener('resize', handler);
    const deb = setTimeout(() => calculatePanelHeight(), 120);
    return () => {
      window.removeEventListener('resize', handler);
      clearTimeout(deb);
    };
  }, [calculatePanelHeight]);

  // ===== FETCH DATA
  const fetchKnowledgeItems = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading((prev) => ({ ...prev, list: true }));

      const res = await fetch('http://localhost:5000/api/knowledge', {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('Gagal memuat data pengetahuan.');
      const data: KnowledgeListResponse = await res.json();

      setKnowledgeItems(data.data || []);
      setSelectedItem((prev) => {
        if (prev) return prev;
        if (!silent && data.data && data.data.length > 0) {
          return data.data[0];
        }
        return prev;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan tidak diketahui.'
      );
    } finally {
      if (!silent) setIsLoading((prev) => ({ ...prev, list: false }));
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeItems();
  }, [fetchKnowledgeItems]);

  const downloadKnowledgeAsTxt = useCallback((items: KnowledgeItem[]) => {
    const content = items
      .map(
        (item) =>
          `TOPIC: ${item.topic}\n` +
          `CATEGORY: ${item.category}\n` +
          `STATUS: ${item.status}\n` +
          `CONTENT:\n${item.content}\n` +
          `--------------------------------------------------\n`
      )
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `knowledge-backup-${timestamp}.txt`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);

  const handleUpdateRag = useCallback(async () => {
    if (knowledgeItems.length > 0) {
      downloadKnowledgeAsTxt(knowledgeItems);
    } else {
      toast.error('Tidak ada data untuk diunduh.');
      return;
    }

    setIsLoading((prev) => ({ ...prev, rag: true }));
    try {
      const res = await fetch('http://localhost:8080/do-rag');
      if (!res.ok) throw new Error('Proses RAG gagal di server AI.');

      const data: RagUpdateResponse = await res.json();
      await fetchKnowledgeItems(true);

      toast.success('Update RAG Selesai & Data Berhasil Diunduh', {
        description: data.Message || 'Proses berhasil.',
      });
    } catch (err) {
      toast.error('Error saat update RAG', {
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsLoading((prev) => ({ ...prev, rag: false }));
    }
  }, [knowledgeItems, downloadKnowledgeAsTxt, fetchKnowledgeItems]);

  // ===== SAVE ITEM =====
  const handleSaveItem = useCallback(
    async (
      formData: Omit<KnowledgeItem, '_id' | 'updatedAt' | 'is_sync'>,
      isNew: boolean
    ) => {
      setIsLoading((prev) => ({ ...prev, save: true }));
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew
        ? 'http://localhost:5000/api/knowledge'
        : `http://localhost:5000/api/knowledge/${selectedItem?._id}`;

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const errData: ErrorResponse = await res.json();
          throw new Error(errData.message || 'Gagal menyimpan data.');
        }

        const { data: savedItem }: SingleKnowledgeResponse = await res.json();
        await fetchKnowledgeItems(true);

        setSelectedItem(savedItem);
        toast.success(
          `Item "${savedItem.topic}" berhasil ${
            isNew ? 'dibuat' : 'diperbarui'
          }.`
        );
        setMode('view');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      } finally {
        setIsLoading((prev) => ({ ...prev, save: false }));
      }
    },
    [selectedItem, fetchKnowledgeItems]
  );

  // ===== TOGGLE STATUS =====
  const handleToggleStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/knowledge/${id}/status`,
          {
            method: 'PUT',
            credentials: 'include',
          }
        );
        if (!res.ok) throw new Error('Gagal mengubah status.');

        const { data: updatedItem }: SingleKnowledgeResponse = await res.json();
        await fetchKnowledgeItems(true);

        setSelectedItem(updatedItem);
        toast.success(
          `Status "${updatedItem.topic}" diubah menjadi ${updatedItem.status}`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      }
    },
    [fetchKnowledgeItems]
  );

  // ===== DELETE ITEM =====
  const executeDeleteItem = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`http://localhost:5000/api/knowledge/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Gagal menghapus data.');

        await fetchKnowledgeItems(true);

        setSelectedItem(null);
        setMode('view');
        toast.success('Item berhasil dihapus.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      }
    },
    [fetchKnowledgeItems]
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      if (!selectedItem) return;
      if (selectedItem.status !== 'INACTIVE' || !selectedItem.is_sync) {
        toast.error('Tidak Dapat Menghapus', {
          description:
            'Item harus dinonaktifkan (INACTIVE) dan disinkronkan (Update RAG) terlebih dahulu sebelum dihapus.',
        });
        return;
      }

      toast('Konfirmasi Hapus', {
        description: `Yakin ingin menghapus "${selectedItem.topic}" secara permanen?`,
        action: {
          label: 'Ya, Hapus',
          onClick: () => executeDeleteItem(id),
        },
        cancel: {
          label: 'Batal',
          onClick: () => {},
        },
        duration: 8000,
      });
    },
    [selectedItem, executeDeleteItem]
  );

  // ===== HANDLERS =====
  const handleSelectItem = useCallback((item: KnowledgeItem) => {
    setSelectedItem(item);
    setMode('view');
  }, []);

  const handleAddInfoClick = useCallback(() => {
    setSelectedItem(null);
    setMode('add');
  }, []);

  const handleCancelAction = useCallback(() => {
    if (mode === 'add' && knowledgeItems.length > 0)
      setSelectedItem(knowledgeItems[0]);
    setMode('view');
  }, [mode, knowledgeItems]);

  const handleEditClick = useCallback(() => setMode('edit'), []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return knowledgeItems;
    const q = searchQuery.toLowerCase();
    return knowledgeItems.filter(
      (item) =>
        item.topic.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [knowledgeItems, searchQuery]);

  // ===== UI RENDER =====
  return (
    <div ref={rootRef} className='p-4 sm:p-6 lg:p-8 max-h-3/4 flex flex-col'>
      <RagOverlay visible={isLoading.rag} />
      <header
        ref={headerRef}
        className='mb-8 flex justify-between items-start glass-card p-6 border border-white/10'
      >
        <div>
          <h1 className='text-3xl font-bold text-[#13484f] tracking-tight'>
            Knowledge Base
          </h1>
          <p className='text-[#13484f] mt-1'>
            Manajemen dan monitoring Basis Pengetahuan chatbot.
          </p>
        </div>
        <button
          onClick={onBack}
          className='flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium bg-[#090909] text-white hover:brightness-105 transition-all'
        >
          <CornerDownLeft className='w-4 h-4' />
          <span>Kembali ke History</span>
        </button>
      </header>

      <section className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
        <div className='glass-card p-6 flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-[#13484f]'>Update RAG</h2>
            <p className='text-[#13484f] mt-1'>
              Perbarui model dengan data terbaru (Wajib jika ada perubahan).
            </p>
          </div>
          <button
            onClick={handleUpdateRag}
            disabled={isLoading.rag}
            className='flex items-center gap-2 bg-[#13484f] hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:bg-gray-400'
          >
            {isLoading.rag ? (
              <>
                <Loader2 className='w-5 h-5 animate-spin' />
                <span>Memperbarui...</span>
              </>
            ) : (
              <>
                <DatabaseZap className='w-5 h-5' />
                <span>Update RAG</span>
              </>
            )}
          </button>
        </div>

        <div className='glass-card p-6 flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-[#13484f]'>
              Tambah Informasi
            </h2>
            <p className='text-[#13484f] mt-1'>Input item pengetahuan baru.</p>
          </div>
          <button
            onClick={handleAddInfoClick}
            className='flex items-center gap-2 bg-[#ED910C] hover:bg-[#13484f] text-white font-semibold px-4 py-2 rounded-lg transition-colors'
            disabled={mode !== 'view' || isLoading.rag}
          >
            <PlusCircle className='w-5 h-5' />
            <span>Add Info</span>
          </button>
        </div>
      </section>

      <section className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 flex-1 pb-3'>
        {/* Left list column */}
        <div
          className='lg:col-span-1 glass-card h-auto flex flex-col overflow-hidden'
          style={panelHeight ? { height: panelHeight } : undefined}
        >
          <div className='p-4 border-b border-white/10 bg-white/5'>
            <h2 className='text-sm font-semibold flex items-center mb-3 gap-2 text-[#13484f] uppercase tracking-wider'>
              <FileText className='w-4 h-4' /> Knowledge List
            </h2>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Cari Judul, Kategori...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full bg-white/5 text-gray-100 rounded-lg border border-[#13484f]/90 pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-colors'
                disabled={mode !== 'view' || isLoading.rag}
              />
            </div>
          </div>
          <div className='overflow-y-auto flex-1 p-3 space-y-2'>
            {isLoading.list ? (
              <div className='flex justify-center items-center h-full text-gray-400'>
                <Loader2 className='w-8 h-8 animate-spin' />
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const preview =
                  item.content && item.content.length > 180
                    ? item.content.slice(0, 180) + '...'
                    : item.content;
                return (
                  <button
                    key={item._id}
                    onClick={() => handleSelectItem(item)}
                    disabled={mode !== 'view' || isLoading.rag}
                    className={`w-full text-left p-3 rounded-lg transition-all border ${
                      selectedItem?._id === item._id
                        ? 'bg-white/8 border-primary/40'
                        : 'border-transparent hover:bg-white/6'
                    }`}
                  >
                    <div className='flex justify-between items-center mb-1'>
                      <p className='font-bold text-[#13484f] text-sm truncate w-[70%]'>
                        {item.topic}
                      </p>
                      <div className='flex items-center gap-1.5'>
                        {item.is_sync ? (
                          <Cloud className='w-3.5 h-3.5 text-blue-400' />
                        ) : (
                          <CloudOff className='w-3.5 h-3.5 text-orange-400' />
                        )}

                        {item.status === 'ACTIVE' ? (
                          <CheckCircle className='w-4 h-4 text-green-400' />
                        ) : (
                          <XCircle className='w-4 h-4 text-red-400' />
                        )}
                      </div>
                    </div>
                    <p className='text-xs text-[#13484f] truncate'>{preview}</p>
                    <div className='flex items-center justify-between mt-1'>
                      <p className='text-[10px] text-[#13484f]'>
                        {item.category}
                      </p>
                      <p className='text-[10px] text-[#13484f]'>
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className='text-center text-gray-400 p-8 text-sm'>
                <p>{error || 'Item pengetahuan tidak ditemukan.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right detail column */}
        <div
          className='lg:col-span-2 glass-card h-auto flex flex-col overflow-hidden'
          style={panelHeight ? { height: panelHeight } : undefined}
        >
          <KnowledgeDetailPanel
            item={selectedItem}
            mode={mode}
            onSave={handleSaveItem}
            onCancel={handleCancelAction}
            onEdit={handleEditClick}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDeleteItem}
            isSaving={isLoading.save}
            panelHeight={panelHeight}
          />
        </div>
      </section>
    </div>
  );
}

// ===== DETAIL PANEL COMPONENT =====
const initialFormData = {
  topic: '',
  content: '',
  category: '',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
};

const KnowledgeDetailPanel = React.memo(function KnowledgeDetailPanel({
  item,
  mode,
  onSave,
  onCancel,
  onEdit,
  onToggleStatus,
  onDelete,
  isSaving,
  panelHeight,
}: KnowledgeDetailPanelProps) {
  const isAdding = mode === 'add';
  const isEditing = mode === 'edit';
  const [formData, setFormData] = useState(initialFormData);
  const [showGuide, setShowGuide] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  useEffect(() => {
    if (isAdding || isEditing) {
      setIsLoadingCategories(true);
      fetch('http://localhost:5000/api/knowledge/categories')
        .then((res) => res.json())
        .then((json) => {
          if (!json.error && json.data) {
            const options = json.data.map((cat: { name: string }) => ({
              label: cat.name,
              value: cat.name,
            }));
            setCategoryOptions(options);
          }
        })
        .catch((err) => {
          console.error('Gagal load kategori:', err);
        })
        .finally(() => setIsLoadingCategories(false));
    }
  }, [isAdding, isEditing]);

  useEffect(() => {
    if (item && !isAdding) {
      setFormData({
        topic: item.topic,
        content: item.content,
        category: item.category,
        status: item.status,
      });
    } else if (isAdding) {
      setFormData(initialFormData);
    }
  }, [item, mode, isAdding]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (newValue: CategoryOption | null) => {
    setFormData((prev) => ({
      ...prev,
      category: newValue ? newValue.value : '',
    }));
  };

  const handleSaveClick = () => {
    if (!formData.topic || !formData.content || !formData.category) {
      toast.warning('Judul, Konten, dan Kategori tidak boleh kosong.');
      return;
    }
    onSave(formData, isAdding);
  };

  if (!item && !isAdding) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-gray-400'>
        <div className='p-6 bg-white/5 rounded-full mb-4'>
          <FileText className='w-10 h-10 text-gray-200' />
        </div>
        <p>Pilih atau buat item pengetahuan untuk ditampilkan.</p>
      </div>
    );
  }

  return (
    <>
      {showGuide && <MarkdownGuideModal onClose={() => setShowGuide(false)} />}

      <div className='flex flex-col h-full'>
        <header className='p-4 border-b border-white/10 flex justify-between items-center bg-white/5'>
          <div>
            <h3 className='font-bold text-[#13484f]'>
              {isAdding
                ? 'Tambah Informasi'
                : isEditing
                ? 'Edit Item'
                : item?.topic}
            </h3>
            {item && !isAdding && (
              <div className='flex items-center gap-2 mt-1'>
                <p className='text-xs text-[#13484f] font-mono'>
                  ID: {item._id}
                </p>
              </div>
            )}
          </div>
          <div className='flex flex-wrap gap-2'>
            {(isAdding || isEditing) && (
              <button
                type='button'
                onClick={() => setShowGuide(true)}
                className='px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium transition-colors'
                title='Lihat Panduan Format Teks'
              >
                Panduan
              </button>
            )}

            {isAdding || isEditing ? (
              <>
                <button
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className='px-3 py-1.5 bg-[#13484f] text-white rounded-lg text-sm font-medium hover:bg-[#0f6b66] transition-colors disabled:opacity-50 flex items-center gap-1'
                >
                  {isSaving ? (
                    <Loader2 className='w-3 h-3 animate-spin' />
                  ) : (
                    <Save className='w-3 h-3' />
                  )}
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
                <button
                  onClick={onCancel}
                  className='px-3 py-1.5 bg-white/5 text-[#13484f] rounded-lg text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-1 border border-[#13484f]/20'
                >
                  <CornerDownLeft className='w-3 h-3' />
                  <span>Batal</span>
                </button>
              </>
            ) : (
              item && (
                <>
                  <button
                    onClick={() => onToggleStatus(item._id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                      item.status === 'ACTIVE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.status === 'ACTIVE' ? (
                      <>
                        <ToggleLeft className='w-3 h-3' />
                        <span>Nonaktifkan</span>
                      </>
                    ) : (
                      <>
                        <ToggleRight className='w-3 h-3' />
                        <span>Aktifkan</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={onEdit}
                    className='px-3 py-1.5 bg-[#389EA9] text-blue-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-1'
                  >
                    <Pencil className='w-3 h-3' />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => onDelete(item._id)}
                    className='px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1'
                  >
                    <Trash2 className='w-3 h-3' />
                    <span>Hapus</span>
                  </button>
                </>
              )
            )}
          </div>
        </header>

        <div
          className='flex-1 overflow-y-auto p-6 bg-white/5 space-y-4 flex flex-col'
          style={panelHeight ? { maxHeight: panelHeight - 24 } : undefined}
        >
          {!isAdding && item && (
            <div className='flex flex-wrap gap-3 mb-4 shrink-0'>
              <div
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  item.status === 'ACTIVE'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {item.status === 'ACTIVE' ? (
                  <CheckCircle className='w-4 h-4' />
                ) : (
                  <XCircle className='w-4 h-4' />
                )}
                <span>
                  Status: {item.status === 'ACTIVE' ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>

              <div
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  item.is_sync
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-orange-50 text-orange-700'
                }`}
              >
                {item.is_sync ? (
                  <Cloud className='w-4 h-4' />
                ) : (
                  <AlertCircle className='w-4 h-4' />
                )}
                <span>
                  Sync RAG:{' '}
                  {item.is_sync ? 'Sudah (Synced)' : 'Belum (Tekan Update RAG)'}
                </span>
              </div>
            </div>
          )}

          <div className='shrink-0'>
            <InputField
              label='Judul/Topik'
              name='topic'
              value={formData.topic}
              onChange={handleChange}
              isEditing={isAdding || isEditing}
              placeholder='Contoh: Beasiswa DARMASISWA'
            />
          </div>

          <div className='mb-4 shrink-0'>
            <label className='block text-sm font-medium text-[#13484f] mb-1'>
              Kategori
            </label>
            {isAdding || isEditing ? (
              <CreatableSelect
                isClearable
                isDisabled={isLoadingCategories}
                isLoading={isLoadingCategories}
                onChange={handleCategoryChange}
                onCreateOption={(inputValue) => {
                  handleCategoryChange({
                    label: inputValue,
                    value: inputValue,
                  });
                }}
                options={categoryOptions}
                value={
                  formData.category
                    ? { label: formData.category, value: formData.category }
                    : null
                }
                placeholder='Pilih atau Ketik Kategori Baru...'
                classNames={{
                  control: (state) =>
                    `!bg-white/5 !border !border-[#13484f]/40 !rounded-lg !text-sm !shadow-none !p-1.5 ${
                      state.isFocused
                        ? '!ring-2 !ring-[#13484f] !border-transparent'
                        : ''
                    }`,
                  menu: () =>
                    '!bg-white/5 !border !border-[#13484f]/40 !rounded-lg !mt-1',
                  option: (state) =>
                    `!cursor-pointer !text-sm ${
                      state.isFocused
                        ? '!bg-[#13484f]/10 !text-[#13484f]'
                        : '!bg-white/5 !text-[#13484f]'
                    }`,
                  singleValue: () => '!text-[#13484f]',
                  input: () => '!text-[#13484f]',
                  placeholder: () => '!text-[#13484f]/50',
                }}
              />
            ) : (
              <div className='bg-white/5 p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-[#13484f]/40 text-[#13484f]'>
                {formData.category}
              </div>
            )}
          </div>

          <div className='flex-1 flex flex-col min-h-[400px]'>
            <InputField
              label='Konten Pengetahuan'
              name='content'
              value={formData.content}
              onChange={handleChange}
              isEditing={isAdding || isEditing}
              type='textarea'
              rows={15}
              placeholder='Gunakan toolbar di atas untuk tabel & format.'
              useMarkdown={true}
            />
            {(isAdding || isEditing) && (
              <div className='text-xs text-[#13484f]/60 mt-1 flex justify-end shrink-0'>
                * Tips: Gunakan tombol Table Wizard & Fullscreen di pojok kanan
                editor.
              </div>
            )}
          </div>

          {item && !isAdding && (
            <div className='mt-4 text-xs text-[#13484f] flex justify-between shrink-0'>
              <span>
                Terakhir Diperbarui: {new Date(item.updatedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
});
