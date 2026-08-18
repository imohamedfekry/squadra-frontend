import { useEffect, useMemo, useRef } from "react"
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { colorPicker, colorPickerTheme } from "@replit/codemirror-css-color-picker";
import { getLanguageExtension } from "./extensions/language-extension";
import { interactiveValues } from "./extensions/interact";
import { customTheme, editorHighlightExtension } from "./extensions/theme";
import { customSetup } from "./extensions/custom-setup";
import { minimap } from "./extensions/minimap";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";
import type { SyncState } from "@/store/editor-sync.store";

interface Props {
  fileName: string;
  yText: Y.Text;
  provider: HocuspocusProvider;
  syncState: SyncState;
}

export const CodeEditor = ({
  fileName,
  yText,
  provider,
  syncState,
}: Props) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editableCompartmentRef = useRef(new Compartment());
  const initialReadOnlyRef = useRef(syncState !== "ready");

  const languageExtension = useMemo(() => {
    return getLanguageExtension(fileName)
  }, [fileName])

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      parent: editorRef.current,
      extensions: [
        customTheme,
        editorHighlightExtension,
        customSetup,
        languageExtension,
        colorPicker,
        colorPickerTheme,
        ...interactiveValues,
        keymap.of([indentWithTab, ...yUndoManagerKeymap]),
        minimap(),
        indentationMarkers(),
        yCollab(yText, provider.awareness),
        editableCompartmentRef.current.of([
          EditorState.readOnly.of(initialReadOnlyRef.current),
          EditorView.editable.of(!initialReadOnlyRef.current),
        ]),
      ],
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [languageExtension, yText, provider]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const readOnly = syncState !== "ready";

    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [syncState]);

  return (
    <div ref={editorRef} className="size-full pl-4 bg-background" />
  );
};