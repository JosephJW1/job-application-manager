import { useState, useRef, useEffect, useMemo } from "react";
import { useFormikContext } from "formik";
import { useFormState } from "../context/FormStateContext";
import api from "../api";

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

// --- COMPONENT: EDITABLE INSERT BUTTON ---
interface EditableBtnProps {
  value?: string; 
  placeholder?: string;
  targetId: string; 
  onSave?: (newValue: string) => Promise<void>; 
  onInsert?: (e: React.MouseEvent) => void; 
  style?: React.CSSProperties;
  className?: string;
  isChip?: boolean; 
}

export const EditableInsertButton = ({ value, placeholder, targetId, onSave, onInsert, style, className, isChip }: EditableBtnProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value || "");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTempVal(value || ""); }, [value]);
  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

  const handleInsert = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (onInsert) onInsert(e);
    else insertTextAtCursor(targetId, value, e);
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

  const containerStyle: React.CSSProperties = {
    ...safeStyle,
    position: "relative", 
    display: "inline-flex", 
    alignItems: "stretch", 
    padding: 0,
    overflow: "hidden",
    border: isEditing ? "1px solid var(--primary)" : (style?.border || "1px solid #cbd5e1"),
    cursor: isEditing ? "default" : "pointer",
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
      onClick={!isEditing ? handleInsert : undefined}
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
          {value || <span style={{opacity: 0.5}}>{placeholder}</span>}
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

// --- COMPONENT: SEARCHABLE DROPDOWN ---
export const SearchableDropdown = ({ 
  label, 
  name, 
  options, 
  multiple = false, 
  createEndpoint,    
  onCreate, 
  onSelect, 
  onOptionCreated,
  onRename,
  placeholder,
  renderOption,
  headerContent 
}: any) => {
  const { values, setFieldValue } = useFormikContext<any>() || {};
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<any[]>([]);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getRawValue = () => {
    if (!name || !values) return undefined;
    const path = name.split('.');
    let val = values;
    for (let p of path) {
        if (val === undefined) return undefined;
        val = val[p];
    }
    return val;
  };
  
  const rawValue = getRawValue();

  const selectedIds = useMemo(() => {
    return Array.isArray(rawValue) ? rawValue : (rawValue ? [rawValue] : []);
  }, [rawValue]);

  useEffect(() => {
    const lowerSearch = search.toLowerCase();
    setFilteredOptions(options.filter((opt: any) => 
      !selectedIds.includes(opt.id) && opt.title.toLowerCase().includes(lowerSearch)
    ));
  }, [search, options, selectedIds]);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: number) => {
    if (onSelect) {
        onSelect(id);
    } else {
        if (multiple) setFieldValue(name, [...selectedIds, id]);
        else setFieldValue(name, id);
    }
    setSearch("");
    if(!multiple) setIsOpen(false);
  };

  const handleRemove = (idToRemove: number) => setFieldValue(name, selectedIds.filter((id: number) => id !== idToRemove));
  
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      
      if (!search.trim()) return;

      const exactMatch = options.find((o: any) => o.title.toLowerCase() === search.toLowerCase());
      
      // LOGIC: Prefer creation if it's not an exact match
      const canCreate = !!onCreate || !!createEndpoint;
      const targetMatch = exactMatch || (!canCreate && filteredOptions.length > 0 ? filteredOptions[0] : null);

      if (targetMatch) { 
          handleSelect(targetMatch.id); 
          return; 
      }

      if (onCreate) {
        onCreate(search);
        setSearch("");
        setIsOpen(false);
        if (inputRef.current) inputRef.current.blur();
      } else if (createEndpoint) {
        try {
          const res = await api.post(createEndpoint, { title: search });
          if(onOptionCreated) onOptionCreated(res.data);
          handleSelect(res.data.id);
        } catch (err: any) { alert("Error: " + err.message); }
      }
    }
  };
  
  const getTitle = (id: number) => options.find((o: any) => o.id === id)?.title || id;

  return (
    <div ref={wrapperRef} style={{ marginBottom: label ? "1.2rem" : 0, position: "relative", width: "100%" }}>
      {(label || headerContent) && (
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px"}}>
           {label && <label style={{marginBottom: 0}}>{label}</label>}
           {headerContent}
        </div>
      )}
      
      <input 
        ref={inputRef} 
        type="text" 
        placeholder={placeholder || (multiple || onSelect ? "+ Add item..." : "Select or Type to create...")} 
        value={search} 
        onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
        }} 
        onFocus={() => setIsOpen(true)} 
        onClick={() => { if(!isOpen) setIsOpen(true); }}
        onKeyDown={handleKeyDown} 
        autoComplete="off" 
        style={{ marginBottom: 0, width: "100%" }} 
      />
      
      {isOpen && (
        <div style={{ position: "absolute", zIndex: 100, width: "100%", maxHeight: "250px", overflowY: "auto", background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", marginTop: "4px" }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt: any) => (
              <div 
                key={opt.id} 
                onClick={() => handleSelect(opt.id)} 
                style={{ padding: "10px 15px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: "0.9rem" }} 
                onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"} 
                onMouseLeave={(e) => e.currentTarget.style.background = "white"}
              >
                {renderOption ? renderOption(opt) : opt.title}
              </div>
            ))
          ) : (<div style={{ padding: "12px", color: "#64748b", fontSize: "0.9rem", textAlign: "center" }}>{search ? <span>Press <strong>Enter</strong> to create "{search}"</span> : "Type to search..."}</div>)}
        </div>
      )}

      {multiple && !onSelect && selectedIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
          {selectedIds.map((id: number) => (
            <div key={id} style={{ display: "inline-flex", alignItems: "stretch", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
               <EditableInsertButton 
                  targetId="" 
                  value={getTitle(id)}
                  onSave={onRename ? (val) => onRename(id, val) : undefined}
                  onInsert={(e) => { e.preventDefault(); }} 
                  isChip={true}
                  style={{ 
                    borderTopRightRadius: 0, 
                    borderBottomRightRadius: 0, 
                    borderRight: "none",
                    background: "#e0e7ff",
                    color: "var(--primary)",
                    fontWeight: 500,
                    fontSize: "0.85rem"
                  }}
               />
               
               <button 
                  type="button" 
                  onClick={() => handleRemove(id)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderLeft: "1px solid rgba(0,0,0,0.1)",
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    background: "#e0e7ff",
                    color: "var(--primary)",
                    cursor: "pointer",
                    padding: "0 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  title="Remove Skill"
               >
                 ×
               </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- COMPONENT: EXPLANATION LIST ---
export const ExplanationList = ({ targetId, experienceId, experiences, allSkills, relatedSkillIds, onSkillDemoUpdate, onAddSkillDemo, onDeleteSkillDemo, onGlobalSkillCreated }: any) => {
  if (!experienceId) return null;
  const selectedExp = experiences.find((e: any) => e.id.toString() === experienceId.toString());
  if (!selectedExp) return null;
  
  const displaySkills = selectedExp.DemonstratedSkills || [];
  
  const [filterRelated, setFilterRelated] = useState(true);
  const [newSkillId, setNewSkillId] = useState<number | null>(null);
  const [newExplanation, setNewExplanation] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Filter skills to display based on the checkbox
  const visibleSkills = filterRelated 
    ? displaySkills.filter((s: any) => relatedSkillIds && relatedSkillIds.includes(s.id.toString()))
    : displaySkills;

  // Available skills to add (exclude those already in experience)
  const availableSkills = (allSkills || []).filter((s: any) => !displaySkills.find((es: any) => es.id === s.id));

  const handleAddNew = async () => {
    if (!newSkillId || !onAddSkillDemo) return;
    setIsAdding(true);
    await onAddSkillDemo(selectedExp.id, newSkillId, newExplanation);
    setNewSkillId(null);
    setNewExplanation("");
    setIsAdding(false);
  };

  return (
    <div style={{ marginTop: "20px" }}> 
      {/* Title */}
      <label style={{marginBottom: "10px", display: "block"}}>Skill Demonstrations</label>

      {/* Checkbox to filter related skills */}
      <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", cursor: "pointer", marginBottom: "8px", display: "flex", alignItems: "center" }}>
           <input 
             type="checkbox" 
             checked={filterRelated} 
             onChange={e => setFilterRelated(e.target.checked)} 
             style={{ width: "auto", margin: "0 6px 0 0", marginBottom: 0 }} 
           />
           Show only Related Skills
      </label>

      <div style={{ display: "grid", gap: "8px" }}>
        {/* EXISTING ITEMS */}
        {visibleSkills.map((s: any) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: "8px", alignItems: "stretch" }}>
             {/* Column 1: Title */}
             <button 
                type="button" 
                onMouseDown={(e) => e.preventDefault()} 
                onClick={(e) => insertTextAtCursor(targetId, s.title, e)} 
                className="btn-secondary" 
                style={{ textAlign: "left", whiteSpace: "normal", height: "auto", padding: "8px", fontSize: "0.9rem", fontWeight: "bold", color: "var(--primary)", overflow: "hidden" }}
                title="Insert Title"
             >
                {s.title}
             </button>

             {/* Column 2: Explanation */}
             <EditableInsertButton 
               targetId={targetId}
               value={s.ExpSkillDemo?.explanation}
               placeholder="No explanation saved"
               onSave={async (newExp) => {
                  if (onSkillDemoUpdate) await onSkillDemoUpdate(selectedExp.id, s.id, newExp);
               }}
               style={{ 
                 textAlign: "left", 
                 whiteSpace: "normal", 
                 height: "auto", 
                 fontSize: "0.9rem",
                 color: s.ExpSkillDemo?.explanation ? "inherit" : "#ccc"
               }}
             />

             {/* Column 3: Delete */}
             {onDeleteSkillDemo && (
                 <button 
                    type="button" 
                    onClick={() => {
                        if(window.confirm(`Remove "${s.title}" from this experience?`)) {
                            onDeleteSkillDemo(selectedExp.id, s.id);
                        }
                    }}
                    className="btn-ghost"
                    style={{ color: "var(--danger)", padding: "0 10px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #fee2e2", background: "#fef2f2" }}
                    title="Remove Skill from Experience"
                 >
                     🗑️
                 </button>
             )}
          </div>
        ))}

        {/* --- ADD NEW SKILL FORM --- */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: "8px", alignItems: "stretch" }}>
             {/* Column 1: Dropdown */}
             <div style={{ height: "100%" }}>
                <SearchableDropdown 
                    options={availableSkills}
                    onSelect={(id: number) => setNewSkillId(id)}
                    createEndpoint="/lists/skills" 
                    onOptionCreated={(newSkill: any) => { 
                        if(onGlobalSkillCreated) onGlobalSkillCreated(newSkill); 
                        setNewSkillId(newSkill.id);
                    }}
                    placeholder={
                        newSkillId 
                        ? (allSkills?.find((s: any) => s.id === newSkillId)?.title || "Selected") 
                        : "Select or Create..."
                    }
                />
             </div>

             {/* Column 2: Input */}
             <input 
                 className="input" 
                 placeholder={newSkillId ? "Enter explanation..." : "Select a skill first"} 
                 value={newExplanation}
                 onChange={(e) => setNewExplanation(e.target.value)}
                 style={{ 
                     marginBottom: 0, 
                     height: "100%", 
                     border: "1px solid #cbd5e1", 
                     background: newSkillId ? "white" : "#f1f5f9",
                     fontSize: "0.9rem"
                 }}
                 disabled={!newSkillId}
                 onKeyDown={(e) => { if(e.key === "Enter") handleAddNew(); }}
             />

             {/* Column 3: Add Tick */}
             <button 
                type="button" 
                onClick={handleAddNew}
                className="btn-ghost"
                disabled={!newSkillId || isAdding}
                style={{ 
                    color: "var(--success)", 
                    padding: "0 10px", 
                    height: "100%", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    border: "1px solid #d1fae5", 
                    background: "#ecfdf5",
                    opacity: !newSkillId ? 0.5 : 1,
                    cursor: !newSkillId ? "not-allowed" : "pointer"
                }}
                title="Add to Experience"
             >
                 {isAdding ? "..." : "✓"}
             </button>
        </div>
      </div>
    </div>
  );
};

// --- HELPER: SYNC FORMIK DIRTY STATE ---
export const FormObserver = () => {
    const { dirty } = useFormikContext();
    const { setIsDirty } = useFormState();
    useEffect(() => {
      setIsDirty(dirty);
      return () => setIsDirty(false);
    }, [dirty, setIsDirty]);
    return null;
  };