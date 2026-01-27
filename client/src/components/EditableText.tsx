import { useState, useRef, useEffect } from "react";

// --- HELPER: TEXT INSERTION ---
export const insertTextAtCursor = (targetId: string, text: string | undefined, e: React.MouseEvent | React.ChangeEvent) => {
  if (!text) return;
  
  let valToInsert = text;
  if (e && 'ctrlKey' in e && !(e as React.MouseEvent).ctrlKey) {
     valToInsert = text.toLowerCase();
  }

  const textarea = document.getElementById(targetId) as HTMLTextAreaElement;
  if (textarea) {
    textarea.focus();
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

  const borderColor = isEditing ? "var(--primary)" : "#cbd5e1";

  const containerStyle: React.CSSProperties = {
    position: "relative", 
    display: "inline-flex", 
    alignItems: "stretch", 
    padding: 0,
    overflow: "hidden",
    cursor: isEditing ? "default" : (onClick || targetId ? "pointer" : "default"),
    border: `1px solid ${borderColor}`,
    ...safeStyle,
  };

  const textStyle: React.CSSProperties = {
    flex: 1,
    padding: isChip ? "4px 8px" : "8px 12px",
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
    borderLeft: "1px solid rgba(0,0,0,0.1)",
    background: isEditing ? "var(--success)" : "rgba(0,0,0,0.03)",
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
               background: "white", 
               font: "inherit", 
               padding: "4px 8px",
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
          onMouseEnter={(e) => !isEditing && (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
          onMouseLeave={(e) => !isEditing && (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
          title={isEditing ? "Save (Enter)" : "Edit"}
        >
          {loading ? (
             <span style={{fontSize: "10px"}}>...</span> 
          ) : isEditing ? (
             <span style={{ fontSize: "14px", fontWeight: "bold" }}>✓</span>
          ) : (
             <span style={{ fontSize: "12px" }}>✎</span>
          )}
        </div>
      )}
    </div>
  );
};