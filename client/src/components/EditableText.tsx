import { useState, useRef, useEffect } from "react";

// --- HELPER: TEXT INSERTION ---
export const insertTextAtCursor = (targetId: string, text: string | undefined, e: React.MouseEvent | React.ChangeEvent | { ctrlKey?: boolean }) => {
  if (!text) return;
  
  // FIX: Prevent default browser behavior (navigating, scrolling on some elements)
  if (e && 'preventDefault' in e && typeof (e as any).preventDefault === 'function') {
      (e as any).preventDefault();
  }
  
  let valToInsert = text;
  // Logic: Lowercase unless ctrlKey is pressed (or passed manually)
  if (e && 'ctrlKey' in e && !(e as any).ctrlKey) {
     valToInsert = text.toLowerCase();
  }

  const textarea = document.getElementById(targetId) as HTMLTextAreaElement;
  if (textarea) {
    // FIX: Focus the textarea so insertion works, but prevent the browser from scrolling the page
    textarea.focus({ preventScroll: true });
    
    const success = document.execCommand("insertText", false, valToInsert);
    if (!success) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.setRangeText(valToInsert, start, end, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
};

// --- COMPONENT: EDITABLE TEXT ---
interface EditableTextProps {
  value?: string; 
  placeholder?: string;
  targetId?: string; // Optional: Only needed if default click behavior is to insert text
  onSave?: (newValue: string) => Promise<void>; 
  onClick?: (e: React.MouseEvent) => void; 
  style?: React.CSSProperties;
  className?: string;
  isChip?: boolean;
  children?: React.ReactNode; // NEW: Allow custom content display
}

export const EditableText = ({ value, placeholder, targetId, onSave, onClick, style, className, isChip, children }: EditableTextProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value || "");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTempVal(value || ""); }, [value]);
  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    
    if (onClick) {
        onClick(e);
    } else if (targetId) {
        insertTextAtCursor(targetId, value, e);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    setLoading(true);
    try {
      await onSave(tempVal);
      setIsEditing(false);
    } catch (err) {
      alert("Failed to save update");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setTempVal(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault(); 
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const { padding, paddingLeft, paddingRight, paddingTop, paddingBottom, ...safeStyle } = style || {};

  // Standardize padding logic to ensure identical height in both states
  const standardPadding = isChip ? "4px 8px" : "8px 12px";

  const borderColor = isEditing ? "var(--primary)" : "var(--border-color)";

  // Detect if 'border' shorthand is explicitly passed in props.
  const hasBorderOverride = style?.border !== undefined;

  // Use explicit sides instead of 'border' shorthand for defaults to avoid React warnings when mixing shorthands.
  const defaultBorderStyles = hasBorderOverride ? {} : {
      borderTop: `1px solid ${borderColor}`,
      borderRight: `1px solid ${borderColor}`,
      borderBottom: `1px solid ${borderColor}`,
      borderLeft: `1px solid ${borderColor}`,
  };

  const containerStyle: React.CSSProperties = {
    position: "relative", 
    display: "inline-flex", 
    alignItems: "stretch", 
    padding: 0,
    overflow: "hidden",
    cursor: isEditing ? "default" : (onClick || targetId ? "pointer" : "default"),
    // Apply defaults first, then overrides
    ...defaultBorderStyles, 
    ...safeStyle,
  };

  const textStyle: React.CSSProperties = {
    flex: 1,
    padding: standardPadding,
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const actionStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px", 
    borderLeft: "1px solid var(--border-color)",
    background: isEditing ? "var(--success)" : "var(--bg-hover)",
    color: isEditing ? "white" : "var(--text-muted)",
    cursor: "pointer",
    transition: "background 0.2s",
  };

  return (
    <div 
      className={`btn-secondary ${className || ""}`}
      style={containerStyle}
      onClick={!isEditing ? handleClick : undefined}
      onMouseDown={(e) => !isEditing && e.preventDefault()} 
    >
      {isEditing ? (
        <div style={{ flex: 1, display: "flex", width: "100%" }}>
           <input 
             ref={inputRef}
             value={tempVal}
             onChange={(e) => setTempVal(e.target.value)}
             onKeyDown={handleKeyDown}
             onBlur={handleCancel} 
             style={{ 
               width: "100%", 
               border: "none", 
               background: "var(--bg-surface)", 
               font: "inherit", 
               padding: standardPadding, // Match View mode padding exactly
               margin: 0, // Reset any global input margins (fixes height jump)
               outline: "none",
               color: "var(--text-main)"
             }}
           />
        </div>
      ) : (
        <div style={textStyle} title={value}>
          {children ? children : (value || <span style={{opacity: 0.5}}>{placeholder}</span>)}
        </div>
      )}

      {onSave && (
        <div 
          style={actionStyle}
          onMouseDown={(e) => e.preventDefault()}
          onClick={isEditing ? (e) => { e.stopPropagation(); handleSave(); } : handleEditClick}
          onMouseEnter={(e) => !isEditing && (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => !isEditing && (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
          title={isEditing ? "Save (Enter)" : "Edit"}
        >
          {loading ? (
             <span style={{fontSize: "10px", lineHeight: 1}}>...</span> 
          ) : isEditing ? (
             <span style={{ fontSize: "14px", fontWeight: "bold", lineHeight: 1 }}>✓</span>
          ) : (
             <span style={{ fontSize: "12px", lineHeight: 1 }}>✎</span>
          )}
        </div>
      )}
    </div>
  );
};