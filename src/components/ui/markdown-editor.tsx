"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  SquareCode,
  Link as LinkIcon,
  ImagePlus,
  Youtube,
  Undo2,
  Redo2,
  Eye,
  FileCode,
  Columns,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { uploadFile, API_BASE } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";

// Las imágenes se guardan en el Markdown con ruta relativa (/media/...),
// pero dentro del editor deben resolverse contra el backend para visualizarse.
const toEditor = (md: string) => md.replaceAll("](/media/", `](${API_BASE}/media/`);
const fromEditor = (md: string) => md.replaceAll(`](${API_BASE}/media/`, "](/media/");

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // Clases extra para la tarjeta contenedora (p.ej. "flex-1" dentro de un
  // diálogo flex para que el editor rellene el alto disponible).
  className?: string;
  // Alto del área de edición (clase Tailwind). Por defecto h-[450px];
  // usar "h-full min-h-[300px]" cuando la tarjeta ya tiene alto flexible.
  height?: string;
}

// Editor de contenido del docente. Es WYSIWYG (TipTap) pero el contrato con el
// resto de la app sigue siendo Markdown: `value`/`onChange` transportan Markdown
// (tiptap-markdown convierte en ambos sentidos), así las vistas del estudiante
// y el backend no cambian.
export function MarkdownEditor({ value, onChange, placeholder = "Escribe aquí el contenido...", className = "", height = "h-[450px]" }: MarkdownEditorProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // Modos de vista: visual (WYSIWYG), markdown crudo, o ambos lado a lado
  const [viewMode, setViewMode] = React.useState<"visual" | "source" | "split">("visual");
  const sourceMode = viewMode === "source";
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const editor = useEditor({
    // Next.js hace SSR del primer render: evita mismatch de hidratación
    // (TipTap solo debe renderizarse en el cliente).
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TiptapImage,
      TiptapLink.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: false, transformPastedText: true, linkify: true }),
    ],
    content: toEditor(value),
    onUpdate: ({ editor }) => {
      // tiptap-markdown añade storage.markdown con el serializador
      onChange(fromEditor((editor.storage as any).markdown.getMarkdown()));
    },
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert max-w-none flex-1 overflow-y-auto p-4 text-sm leading-relaxed focus:outline-none " +
          // Placeholder: párrafo vacío muestra el texto de ayuda
          "[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:pointer-events-none",
      },
      // Pegar una imagen (Ctrl+V) la sube e inserta en el cursor
      handlePaste: (_view, event) => {
        const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
        if (file) {
          uploadAndInsertImage(file);
          return true;
        }
        return false;
      },
      // Arrastrar y soltar una imagen sobre el editor la sube e inserta
      handleDrop: (_view, event) => {
        const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
        if (file) {
          event.preventDefault();
          uploadAndInsertImage(file);
          return true;
        }
        return false;
      },
    },
  });

  // Sincroniza cambios externos de `value` (abrir diálogo, restaurar borrador)
  // sin pisar lo que el docente está escribiendo.
  React.useEffect(() => {
    if (!editor) return;
    const current = fromEditor((editor.storage as any).markdown.getMarkdown());
    if (current !== value) {
      editor.commands.setContent(toEditor(value || ""));
    }
  }, [value, editor]);

  // Sube la imagen al backend (/api/uploads) y la inserta como nodo imagen
  const uploadAndInsertImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("El archivo debe ser una imagen (JPG, PNG, GIF, WebP o SVG)");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await uploadFile("/api/uploads", file);
      // URL absoluta para que el editor la muestre; se guarda relativa en el Markdown
      editor?.chain().focus().setImage({ src: `${API_BASE}${url}`, alt: file.name.replace(/\.[^.]+$/, "") }).run();
    } catch (err) {
      setUploadError((err as Error).message || "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleImagePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (file) uploadAndInsertImage(file);
  };

  // Enlace externo (URL en el texto seleccionado)
  const handleSetLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace:", previous ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url.trim() }).run();
  };

  // Video: se inserta como enlace; en la vista del estudiante se embebe (YouTube/Vimeo)
  const handleInsertVideo = () => {
    if (!editor) return;
    const url = window.prompt("Pega la URL del video (YouTube o Vimeo):");
    if (!url?.trim()) return;
    if (!/youtube\.com|youtu\.be|vimeo\.com/.test(url)) {
      setUploadError("La URL no parece de YouTube o Vimeo");
      return;
    }
    setUploadError(null);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "paragraph",
        content: [{ type: "text", text: `🎥 Video de apoyo`, marks: [{ type: "link", attrs: { href: url.trim() } }] }],
      })
      .run();
  };

  const toolbar: {
    icon: React.ReactNode;
    label: string;
    action: () => void;
    active?: boolean;
    disabled?: boolean;
  }[] = editor
    ? [
        { icon: <Undo2 className="h-4 w-4" />, label: "Deshacer", action: () => editor.chain().focus().undo().run(), disabled: !editor.can().undo() },
        { icon: <Redo2 className="h-4 w-4" />, label: "Rehacer", action: () => editor.chain().focus().redo().run(), disabled: !editor.can().redo() },
        { icon: <Bold className="h-4 w-4" />, label: "Negrita (Ctrl+B)", action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
        { icon: <Italic className="h-4 w-4" />, label: "Cursiva (Ctrl+I)", action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
        { icon: <Heading1 className="h-4 w-4" />, label: "Título 1", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive("heading", { level: 1 }) },
        { icon: <Heading2 className="h-4 w-4" />, label: "Título 2", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
        { icon: <List className="h-4 w-4" />, label: "Lista", action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
        { icon: <ListOrdered className="h-4 w-4" />, label: "Lista numerada", action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
        { icon: <Quote className="h-4 w-4" />, label: "Cita", action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote") },
        { icon: <Code className="h-4 w-4" />, label: "Código en línea", action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive("code") },
        { icon: <SquareCode className="h-4 w-4" />, label: "Bloque de código", action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive("codeBlock") },
        { icon: <LinkIcon className="h-4 w-4" />, label: "Enlace", action: handleSetLink, active: editor.isActive("link") },
        { icon: <Youtube className="h-4 w-4" />, label: "Video (YouTube/Vimeo, se embebe al publicar)", action: handleInsertVideo },
      ]
    : [];

  // Conteo aproximado sobre el Markdown (dato, va en mono según el sistema)
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <Card className={`flex flex-col border border-border overflow-hidden bg-background transition-all ${isFullscreen ? "fixed inset-4 z-50 shadow-2xl" : "relative"} ${className}`}>
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 p-2">
        <div className="flex flex-wrap items-center gap-1">
          {toolbar.map((btn, idx) => (
            <Button
              key={idx}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted",
                btn.active && "bg-muted text-brand dark:text-brand-gold"
              )}
              title={btn.label}
              onClick={btn.action}
              disabled={btn.disabled || sourceMode}
            >
              {btn.icon}
            </Button>
          ))}
          {/* Subir imagen: botón propio con input de archivo oculto */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Subir imagen (JPG/PNG/GIF/WebP/SVG, máx. 5 MB)"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sourceMode}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleImagePicked}
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant={viewMode === "visual" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setViewMode("visual")}
              title="Editor visual (WYSIWYG)"
            >
              <Eye className="h-3 w-3" /> Visual
            </Button>
            <Button
              type="button"
              variant={viewMode === "source" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setViewMode("source")}
              title="Ver/editar el Markdown en crudo"
            >
              <FileCode className="h-3 w-3" /> Markdown
            </Button>
            <Button
              type="button"
              variant={viewMode === "split" ? "secondary" : "ghost"}
              size="sm"
              className="hidden h-7 gap-1 px-2 text-xs md:flex"
              onClick={() => setViewMode("split")}
              title="Visual y Markdown lado a lado"
            >
              <Columns className="h-3 w-3" /> Dividido
            </Button>
          </div>
          <div className="h-4 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Error de subida de imagen o URL de video inválida */}
      {uploadError && (
        <div className="animate-fade-in border-t border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {uploadError}
        </div>
      )}

      {/* Área de edición */}
      <div className={`flex min-h-[300px] flex-1 flex-col ${isFullscreen ? "h-[calc(100vh-160px)]" : height}`}>
        <div className={`grid min-h-0 flex-1 ${viewMode === "split" ? "md:grid-cols-2 md:divide-x md:divide-border" : "grid-cols-1"}`}>
          {viewMode !== "source" && (
            <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col [&_.ProseMirror]:min-h-full" />
          )}
          {viewMode !== "visual" && (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck
              className="scrollbar-thin min-h-[200px] w-full flex-1 resize-none border-0 bg-transparent p-4 font-mono text-sm leading-6 text-foreground outline-none focus:outline-none"
            />
          )}
        </div>
        {/* Pie del editor: conteo y ayuda */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="hidden min-w-0 truncate sm:inline">
            {uploading ? "Subiendo imagen…" : "Pega o arrastra una imagen para subirla · Ctrl+B/I para formato"}
          </span>
          <span className="shrink-0 whitespace-nowrap font-mono tabular-nums">
            {words} palabras · {value.length} caracteres
          </span>
        </div>
      </div>
    </Card>
  );
}
