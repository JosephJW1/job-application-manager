import { useState, useRef, useEffect, useMemo } from "react";
import { useFormikContext } from "formik";
import { useFormState } from "../context/FormStateContext";
import api from "../api";
import { EditableText, insertTextAtCursor } from "../components/EditableText";
import { ItemList } from "../components/ItemList";

// Re-export for compatibility
export { EditableText, insertTextAtCursor };

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
  headerContent,
  initialValue,
  autoFocus,
  onCancel,
  initialSearch,
  onDeleteOption,
  onOpen
}: any) => {
  const { values, setFieldValue } = useFormikContext<any>() || {};
  const [search, setSearch] = useState(initialSearch || ""); 
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null); 
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getRawValue = () => {
    if (initialValue !== undefined) return initialValue; 
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
    
    let filtered = options.filter((opt: any) => 
      opt.title.toLowerCase().includes(lowerSearch)
    );

    filtered = filtered.sort((a: any, b: any) => {
        const aSelected = selectedIds.includes(a.id);
        const bSelected = selectedIds.includes(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
    });

    setFilteredOptions(filtered);
    setActiveId(null); 

  }, [search, options, selectedIds]);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
          setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
      if (autoFocus && inputRef.current) {
          setIsOpen(true);
          inputRef.current.focus();
      }
  }, [autoFocus]);

  const handleSelect = (id: number) => {
    try {
        if (onSelect) {
            onSelect(id);
        } else {
            if (multiple) {
                if (!selectedIds.includes(id)) {
                    setFieldValue(name, [...selectedIds, id]);
                }
            } else {
                setFieldValue(name, id);
            }
        }
    } catch (err) {
        console.error("Selection error:", err);
    }
    
    setSearch("");
    if(!multiple) setIsOpen(false);
  };

  const handleRemove = (idToRemove: number) => setFieldValue(name, selectedIds.filter((id: number) => id !== idToRemove));
  
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        if (filteredOptions.length === 0) return;
        
        if (activeId === null) {
            setActiveId(filteredOptions[0].id);
        } else {
            const currentIndex = filteredOptions.findIndex(o => o.id === activeId);
            const nextIndex = (currentIndex + 1) % filteredOptions.length;
            setActiveId(filteredOptions[nextIndex].id);
        }
    } 
    else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        if (filteredOptions.length === 0) return;

        if (activeId === null) {
            setActiveId(filteredOptions[filteredOptions.length - 1].id);
        } else {
            const currentIndex = filteredOptions.findIndex(o => o.id === activeId);
            const prevIndex = (currentIndex - 1 + filteredOptions.length) % filteredOptions.length;
            setActiveId(filteredOptions[prevIndex].id);
        }
    }
    else if (e.key === "Enter") {
      e.preventDefault();
      
      const activeOption = filteredOptions.find(o => o.id === activeId);
      if (activeId !== null && isOpen && activeOption) {
          handleSelect(activeId); 
          return;
      }

      if (!search.trim()) return;

      const exactMatch = options.find((o: any) => o.title.toLowerCase() === search.toLowerCase());
      if (exactMatch) {
          handleSelect(exactMatch.id);
          return;
      }

      const canCreate = !!onCreate || !!createEndpoint;
      if (canCreate) {
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
          return;
      }

      if (filteredOptions.length > 0) {
          handleSelect(filteredOptions[0].id);
      }
    } 
    else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        if (onCancel) onCancel();
    }
  };
  
  const handleBlur = (e: React.FocusEvent) => {
      if (onCancel) {
          if (wrapperRef.current && wrapperRef.current.contains(e.relatedTarget as Node)) { return; }
          onCancel();
      }
  };

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
        autoFocus={autoFocus} 
        type="text" 
        placeholder={placeholder || (multiple || onSelect ? "+ Add item..." : "Select or Type to create...")} 
        value={search} 
        onChange={(e) => {
            setSearch(e.target.value);
            setActiveId(null); 
            if (!isOpen) setIsOpen(true);
        }} 
        onBlur={handleBlur}
        onFocus={() => setIsOpen(true)} 
        onClick={() => { if(!isOpen) setIsOpen(true); }}
        onKeyDown={handleKeyDown} 
        autoComplete="off" 
        style={{ marginBottom: 0, width: "100%" }} 
      />
      
      {isOpen && (
        // FIX: Removed maxHeight and overflowY from here. 
        // The internal <ItemList> (via .item-list CSS class) now handles the scrolling.
        <div style={{ position: "absolute", zIndex: 100, width: "100%", background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", marginTop: "4px" }}>
            <ItemList 
                items={filteredOptions}
                selectedIds={selectedIds}
                activeId={activeId}
                onItemClick={(item) => handleSelect(item.id)}
                onDelete={onDeleteOption} 
                onRename={onRename}       
                onOpen={onOpen}
                renderContent={renderOption}
                emptyMessage={search ? <span>Press <strong>Enter</strong> to create "{search}"</span> : "Type to search..."}
            />
        </div>
      )}

      {multiple && !onSelect && selectedIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
          {selectedIds.map((id: number) => {
            const exists = options.find((o:any) => o.id === id);
            if (!exists) return null;

            return (
              <div key={id} style={{ display: "inline-flex", alignItems: "stretch", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                 <EditableText 
                    targetId="" 
                    value={exists.title} 
                    onSave={onRename ? (val) => onRename(id, val) : undefined}
                    onClick={(e) => { 
                        e.preventDefault();
                        if(onOpen) onOpen(id); 
                    }} 
                    isChip={true}
                    style={{ 
                      borderTopRightRadius: 0, 
                      borderBottomRightRadius: 0, 
                      borderRight: "none",
                      background: "#e0e7ff",
                      color: "var(--primary)",
                      fontWeight: 500,
                      fontSize: "0.85rem",
                      cursor: onOpen ? "pointer" : "default"
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ExplanationList = ({ targetId, experienceId, experiences, allSkills, relatedSkillIds, onSkillDemoUpdate, onAddSkillDemo, onDeleteSkillDemo, onGlobalSkillCreated, onSkillChange, onGlobalSkillRename, onGlobalSkillDelete }: any) => {
  if (!experienceId) return null;
  const selectedExp = experiences.find((e: any) => e.id.toString() === experienceId.toString());
  if (!selectedExp) return null;
  
  const displaySkills = useMemo(() => {
    if (selectedExp.SkillDemonstrations) {
      return selectedExp.SkillDemonstrations
        .map((d: any) => {
           if (!d.Skill) {
               return { 
                   id: `orphan-${d.id}`, 
                   title: "⚠ No Skill Selected", 
                   isOrphan: true,
                   demoId: d.id,
                   ExpSkillDemo: { explanation: d.explanation }
               };
           }
           return {
               ...d.Skill,
               demoId: d.id, 
               ExpSkillDemo: { explanation: d.explanation }
           };
        });
    }
    return [];
  }, [selectedExp]);
  
  const [filterRelated, setFilterRelated] = useState(true);
  const [newSkillId, setNewSkillId] = useState<number | null>(null);
  const [newExplanation, setNewExplanation] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [changingSkillDemoId, setChangingSkillDemoId] = useState<number | string | null>(null);

  const visibleSkills = filterRelated 
    ? displaySkills.filter((s: any) => {
        if (s.isOrphan) return true;
        return relatedSkillIds && relatedSkillIds.includes(s.id.toString());
    })
    : displaySkills;

  const availableSkills = (allSkills || []).filter((s: any) => !displaySkills.find((es: any) => es.id === s.id && !es.isOrphan));

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
      <label style={{marginBottom: "10px", display: "block"}}>Skill Demonstrations</label>

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
        {visibleSkills.length > 0 ? visibleSkills.map((s: any) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: "8px", alignItems: "stretch" }}>
             <div style={{ height: "100%", position: "relative" }}>
                 
                 {changingSkillDemoId === s.demoId ? (
                     <div style={{ display: "flex", height: "100%", alignItems: "stretch" }}>
                         <div 
                            onClick={() => setChangingSkillDemoId(null)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "30px",
                                background: "#fef2f2",
                                borderTop: "1px solid #fee2e2",
                                borderBottom: "1px solid #fee2e2",
                                borderLeft: "1px solid #fee2e2",
                                borderRight: "none",
                                borderTopLeftRadius: "4px",
                                borderBottomLeftRadius: "4px",
                                cursor: "pointer",
                                color: "var(--danger)",
                                fontSize: "0.9rem",
                                transition: "background 0.2s"
                            }}
                            title="Cancel Selection"
                         >
                            ✕
                         </div>

                         <div style={{ flex: 1 }}>
                             <SearchableDropdown 
                                autoFocus={true} 
                                options={allSkills}
                                placeholder="Select Skill..."
                                initialSearch={s.isOrphan ? "" : s.title} 
                                initialValue={s.isOrphan ? undefined : s.id} 
                                onSelect={(newId: number) => {
                                    if (onSkillChange) onSkillChange(s.demoId, newId);
                                    setChangingSkillDemoId(null);
                                }}
                                onCancel={() => setChangingSkillDemoId(null)} 
                                createEndpoint="/lists/skills"
                                onOptionCreated={onGlobalSkillCreated}
                                onRename={onGlobalSkillRename}
                                onDeleteOption={async (id: number) => {
                                    if(window.confirm("Warning: You are about to delete this skill globally from all experiences and requirements.\n\nAre you sure?")) {
                                        if (onGlobalSkillDelete) await onGlobalSkillDelete(id);
                                    }
                                }}
                             />
                         </div>
                     </div>
                 ) : (
                     <div style={{ display: "flex", height: "100%", alignItems: "stretch" }}>
                         <div 
                             onClick={() => setChangingSkillDemoId(s.demoId)}
                             style={{
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 width: "30px",
                                 background: "rgba(0,0,0,0.03)",
                                 borderTop: "1px solid #cbd5e1",
                                 borderBottom: "1px solid #cbd5e1",
                                 borderLeft: "1px solid #cbd5e1",
                                 borderRight: "none",
                                 borderTopLeftRadius: "4px",
                                 borderBottomLeftRadius: "4px",
                                 cursor: "pointer",
                                 color: "var(--text-muted)",
                                 fontSize: "0.7rem",
                                 transition: "background 0.2s"
                             }}
                             title="Change Associated Skill"
                             onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.08)"}
                             onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}
                         >
                             ▼
                         </div>

                         <EditableText 
                            targetId={targetId}
                            value={s.title}
                            onClick={(e) => insertTextAtCursor(targetId, s.title, e)}
                            onSave={async (newVal) => {
                                if (s.isOrphan) return;
                                if (newVal === s.title) return; 
                                if (window.confirm(`Warning: You are renaming the skill "${s.title}" to "${newVal}".\n\nThis will update this skill in ALL other experiences and requirements where it is used.\n\nAre you sure?`)) {
                                    if (onGlobalSkillRename) await onGlobalSkillRename(s.id, newVal);
                                }
                            }}
                            style={{ 
                                flex: 1, 
                                borderTopLeftRadius: 0, 
                                borderBottomLeftRadius: 0,
                                borderLeft: "1px solid rgba(0,0,0,0.1)" 
                            }}
                         />
                     </div>
                 )}
             </div>

             <EditableText 
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
                 color: s.ExpSkillDemo?.explanation ? "inherit" : "#ccc",
                 border: s.isOrphan ? "1px solid #fc8181" : undefined,
                 background: s.isOrphan ? "#fff5f5" : undefined
               }}
             />

             {onDeleteSkillDemo && (
                 <button 
                    type="button" 
                    onClick={() => {
                        if(window.confirm(`Remove "${s.title}" from this experience?`)) {
                            onDeleteSkillDemo(selectedExp.id, s.isOrphan ? null : s.id);
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
        )) : (
            <div style={{ padding: "10px", textAlign: "center", color: "#999", fontSize: "0.9rem", border: "1px dashed #e2e8f0" }}>
                {filterRelated ? "No related skills found." : "No skills added to this experience yet."}
            </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: "8px", alignItems: "stretch" }}>
             <div style={{ height: "100%" }}>
                <SearchableDropdown 
                    options={availableSkills}
                    onSelect={(id: number) => setNewSkillId(id)}
                    createEndpoint="/lists/skills" 
                    onOptionCreated={(newSkill: any) => { 
                        if(onGlobalSkillCreated) onGlobalSkillCreated(newSkill); 
                        setNewSkillId(newSkill.id);
                    }}
                    onRename={onGlobalSkillRename}
                    onDeleteOption={onGlobalSkillDelete}
                    placeholder={
                        newSkillId 
                        ? (allSkills?.find((s: any) => s.id === newSkillId)?.title || "Selected") 
                        : "Select or Create..."
                    }
                />
             </div>

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

export const FormObserver = () => {
    const { dirty } = useFormikContext();
    const { setIsDirty } = useFormState();
    useEffect(() => {
      setIsDirty(dirty);
      return () => setIsDirty(false);
    }, [dirty, setIsDirty]);
    return null;
  };