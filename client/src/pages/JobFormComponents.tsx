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
             const result = await onCreate(search);
             if (result === false) return; 

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
        <div style={{ position: "absolute", zIndex: 100, width: "100%", background: "var(--bg-surface)", borderRadius: "8px", border: "1px solid var(--border-color)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", marginTop: "4px" }}>
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
                      background: "var(--bg-selected)",
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
                      border: "1px solid var(--border-color)",
                      borderLeft: "1px solid var(--border-color)",
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      background: "var(--bg-selected)",
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

export const ExplanationList = ({ targetId, experienceId, experiences, allSkills, relatedSkillIds, onSkillDemoUpdate, onAddSkillDemo, onDeleteSkillDemo, onGlobalSkillCreated, onSkillChange, onGlobalSkillRename, onGlobalSkillDelete, onEnsureRelatedSkill }: any) => {
  const [skillColWidth, setSkillColWidth] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const selectedExp = useMemo(() => {
      if (!experienceId || !experiences) return null;
      return experiences.find((e: any) => e.id.toString() === experienceId.toString());
  }, [experienceId, experiences]);
  
  const displaySkills = useMemo(() => {
    if (!selectedExp) return [];
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
  
  // Search & Selection States
  const [skillSearch, setSkillSearch] = useState("");
  const [explSearch, setExplSearch] = useState("");
  const [selectedDemos, setSelectedDemos] = useState<any[]>([]); 
  const [localAddedSkills, setLocalAddedSkills] = useState<number[]>([]);
  const [showAddForm, setShowAddForm] = useState(false); 

  useEffect(() => {
    setLocalAddedSkills([]);
  }, [relatedSkillIds]);

  // Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = e.clientX - startXRef.current;
        const newWidth = Math.max(100, startWidthRef.current + delta); // Min width 100px
        setSkillColWidth(newWidth);
    };
    const handleMouseUp = () => {
        if (draggingRef.current) {
            draggingRef.current = false;
            document.body.style.cursor = "default";
        }
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const visibleSkills = useMemo(() => {
      let filtered = displaySkills;

      if (filterRelated) {
          filtered = filtered.filter((s: any) => {
            if (s.isOrphan) return true;
            if (localAddedSkills.includes(s.id)) return true;
            return relatedSkillIds && relatedSkillIds.includes(s.id.toString());
          });
      }

      if (skillSearch || explSearch) {
          const lowerSkill = skillSearch.toLowerCase();
          const lowerExpl = explSearch.toLowerCase();
          filtered = filtered.filter((s: any) => {
              const skillMatch = s.title?.toLowerCase().includes(lowerSkill);
              const explMatch = (s.ExpSkillDemo?.explanation || "").toLowerCase().includes(lowerExpl);
              return skillMatch && explMatch;
          });
      }

      return filtered;
  }, [displaySkills, filterRelated, relatedSkillIds, localAddedSkills, skillSearch, explSearch]);

  const availableSkills = (allSkills || []).filter((s: any) => !displaySkills.find((es: any) => es.id === s.id && !es.isOrphan));

  const handlePotentialConflict = async (title: string) => {
      const conflict = displaySkills.find((s: any) => s.title.toLowerCase() === title.toLowerCase());
      if (!conflict) return false;

      const isRelated = relatedSkillIds && relatedSkillIds.includes(conflict.id.toString());
      
      if (isRelated) {
          alert(`The skill "${conflict.title}" is already in use on this experience.`);
      } else {
          if (window.confirm(`The skill "${conflict.title}" is already in use on this experience.\n\nDo you want to add it to the Requirement's Related Skills instead of creating a duplicate?`)) {
              if (onEnsureRelatedSkill) {
                  await onEnsureRelatedSkill(conflict.id);
                  setLocalAddedSkills(prev => [...prev, conflict.id]); 
              }
          }
      }
      return true; 
  };

  const handleCreateAndSelect = async (val: string, forRowId: number | null = null, currentDemoId: number | string | null = null) => {
      if (await handlePotentialConflict(val)) return false;

      try {
          const res = await api.post("/lists/skills", { title: val });
          if (onGlobalSkillCreated) onGlobalSkillCreated(res.data);
          
          if (forRowId !== null && currentDemoId !== null) {
              if (onSkillChange) onSkillChange(currentDemoId, res.data.id);
              setChangingSkillDemoId(null);
          } else {
              setNewSkillId(res.data.id);
          }
          return true;
      } catch (err: any) {
          alert("Error creating skill: " + err.message);
          return false;
      }
  };

  const handleAddNew = async () => {
    if (!selectedExp) return; 
    if (!newSkillId || !onAddSkillDemo) return;
    setIsAdding(true);
    
    const isRelated = await onAddSkillDemo(selectedExp.id, newSkillId, newExplanation);
    
    if (isRelated === true) {
        setLocalAddedSkills(prev => [...prev, newSkillId]);
    }
    
    setNewSkillId(null);
    setNewExplanation("");
    setIsAdding(false);
    setShowAddForm(false); 
  };

  const handleCancelAdd = () => {
      setNewSkillId(null);
      setNewExplanation("");
      setIsAdding(false);
      setShowAddForm(false);
  };

  const handleToggleSelect = (id: any) => {
      setSelectedDemos(prev => {
          if (prev.includes(id)) return prev.filter(i => i !== id);
          return [...prev, id];
      });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedDemos(visibleSkills.map((s: any) => s.id));
      } else {
          setSelectedDemos([]);
      }
  };

  const handleBulkDelete = async () => {
      if (!selectedExp) return;
      if (selectedDemos.length === 0) return;
      if (!window.confirm(`Delete ${selectedDemos.length} selected skills?`)) return;

      for (const id of selectedDemos) {
          const skill = displaySkills.find((s: any) => s.id === id);
          if (skill && onDeleteSkillDemo) {
              await onDeleteSkillDemo(selectedExp.id, skill.isOrphan ? null : skill.id);
          }
      }
      setSelectedDemos([]);
  };

  // --- DYNAMIC GRID COLUMNS ---
  // Default to 1fr 1fr (half and half) if width is not set
  const gridCols = `35px ${skillColWidth ? `${skillColWidth}px` : "1fr"} 1fr auto`;

  if (!selectedExp) return null;

  return (
    <div style={{ marginTop: "20px" }}> 
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <label style={{marginBottom: 0, display: "block"}}>Skill Demonstrations</label>
          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              {selectedDemos.length > 0 && (
                  <button 
                    type="button"
                    onClick={handleBulkDelete}
                    className="btn-ghost"
                    style={{ color: "var(--danger)", border: "1px solid var(--danger)", background: "rgba(239, 68, 68, 0.1)", padding: "4px 12px", fontSize: "0.85rem" }}
                  >
                      Delete Selected ({selectedDemos.length})
                  </button>
              )}
              <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", cursor: "pointer", marginBottom: 0, display: "flex", alignItems: "center" }}>
                <input 
                    type="checkbox" 
                    checked={filterRelated} 
                    onChange={e => setFilterRelated(e.target.checked)} 
                    style={{ width: "auto", margin: "0 6px 0 0", marginBottom: 0 }} 
                />
                Show only Related Skills
              </label>
          </div>
      </div>

      {/* HEADER ROW WITH SEARCH AND RESIZER */}
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: "8px", alignItems: "end", marginBottom: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "8px" }}>
              <input 
                type="checkbox" 
                checked={visibleSkills.length > 0 && selectedDemos.length === visibleSkills.length}
                onChange={handleSelectAll}
                style={{ width: "auto", marginBottom: 0 }}
                disabled={visibleSkills.length === 0}
              />
          </div>
          
          {/* SKILL COLUMN HEADER WITH RESIZER */}
          <div style={{ position: "relative" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "2px" }}>Skill</label>
              <input 
                value={skillSearch} 
                onChange={(e) => setSkillSearch(e.target.value)} 
                placeholder="Filter Skills..." 
                style={{ width: "100%", fontSize: "0.85rem", padding: "4px 8px", height: "32px", marginBottom: 0 }} 
              />
              {/* Draggable Divider Handle */}
              <div 
                  onMouseDown={(e) => {
                      draggingRef.current = true;
                      startXRef.current = e.clientX;
                      // If width is null (default), get actual current pixel width to start dragging smoothly
                      if (skillColWidth === null) {
                         const parentEl = e.currentTarget.parentElement;
                         startWidthRef.current = parentEl ? parentEl.offsetWidth : 180;
                      } else {
                         startWidthRef.current = skillColWidth;
                      }
                      document.body.style.cursor = "col-resize";
                      e.preventDefault();
                  }}
                  style={{ 
                      position: "absolute", 
                      right: "-6px", 
                      top: 0, 
                      bottom: 0, 
                      width: "8px", 
                      cursor: "col-resize", 
                      zIndex: 10,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center"
                  }}
                  title="Drag to resize"
              >
                  <div style={{ width: "1px", height: "100%", background: "var(--border-color)" }} />
              </div>
          </div>

          <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "2px" }}>Explanation</label>
              <input 
                value={explSearch} 
                onChange={(e) => setExplSearch(e.target.value)} 
                placeholder="Filter Explanations..." 
                style={{ width: "100%", fontSize: "0.85rem", padding: "4px 8px", height: "32px", marginBottom: 0 }} 
              />
          </div>
          <div style={{ width: "34px" }}></div>
      </div>

      <div style={{ display: "grid", gap: "8px" }}>
        {visibleSkills.map((s: any) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: gridCols, gap: "8px", alignItems: "stretch" }}>
             
             {/* CHECKBOX */}
             <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                 <input 
                    type="checkbox" 
                    checked={selectedDemos.includes(s.id)} 
                    onChange={() => handleToggleSelect(s.id)}
                    style={{ width: "auto", marginBottom: 0, cursor: "pointer" }}
                 />
             </div>

             <div style={{ height: "100%", position: "relative" }}>
                 {changingSkillDemoId === s.demoId ? (
                     <div style={{ display: "flex", height: "100%", alignItems: "stretch" }}>
                         <div 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setChangingSkillDemoId(null)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "30px",
                                background: "rgba(239, 68, 68, 0.1)",
                                borderTop: "1px solid var(--danger)",
                                borderBottom: "1px solid var(--danger)",
                                borderLeft: "1px solid var(--danger)",
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
                                options={allSkills?.filter((sk: any) => sk.id === s.id || !displaySkills.find((ds: any) => ds.id === sk.id && !ds.isOrphan)) || []}
                                placeholder="Select Skill..."
                                initialSearch={s.isOrphan ? "" : s.title} 
                                initialValue={s.isOrphan ? undefined : s.id} 
                                onSelect={(newId: number) => {
                                    if (onSkillChange) onSkillChange(s.demoId, newId);
                                    setChangingSkillDemoId(null);
                                }}
                                onCancel={() => setChangingSkillDemoId(null)} 
                                onCreate={(val: string) => handleCreateAndSelect(val, s.id, s.demoId)}
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
                                 background: "var(--bg-input)",
                                 borderTop: "1px solid var(--border-color)",
                                 borderBottom: "1px solid var(--border-color)",
                                 borderLeft: "1px solid var(--border-color)",
                                 borderRight: "none",
                                 borderTopLeftRadius: "4px",
                                 borderBottomLeftRadius: "4px",
                                 cursor: "pointer",
                                 color: "var(--text-muted)",
                                 fontSize: "0.7rem",
                                 transition: "background 0.2s"
                             }}
                             title="Change Associated Skill"
                             onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                             onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-input)"}
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
                                borderLeft: "1px solid var(--border-color)" 
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
                 border: s.isOrphan ? "1px solid var(--danger)" : undefined,
                 background: s.isOrphan ? "rgba(239, 68, 68, 0.05)" : undefined
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
                    style={{ color: "var(--danger)", padding: "0 10px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--danger)", background: "rgba(239, 68, 68, 0.1)" }}
                    title="Remove Skill from Experience"
                 >
                     🗑️
                 </button>
             )}
          </div>
        ))}

        {/* ADD NEW ROW / CREATE BUTTON */}
        {showAddForm ? (
            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: "8px", alignItems: "stretch" }}>
                 
                 {/* Empty cell for checkbox column */}
                 <div></div>

                 <div style={{ height: "100%" }}>
                    <SearchableDropdown 
                        options={availableSkills}
                        onSelect={(id: number) => setNewSkillId(id)}
                        onCreate={(val: string) => handleCreateAndSelect(val)}
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
                        autoFocus={true} // Focus when opened
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
                         border: "1px solid var(--border-color)", 
                         background: newSkillId ? "var(--bg-surface)" : "var(--bg-input)",
                         fontSize: "0.9rem"
                     }}
                     disabled={!newSkillId}
                     onKeyDown={(e) => { 
                         if(e.key === "Enter") handleAddNew(); 
                         if(e.key === "Escape") handleCancelAdd();
                     }}
                 />

                 <div style={{ display: "flex", gap: "4px" }}>
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
                            border: "1px solid var(--success)", 
                            background: "rgba(16, 185, 129, 0.1)",
                            opacity: !newSkillId ? 0.5 : 1,
                            cursor: !newSkillId ? "not-allowed" : "pointer"
                        }}
                        title="Add to Experience"
                     >
                         {isAdding ? "..." : "✓"}
                     </button>
                     <button 
                        type="button" 
                        onClick={handleCancelAdd}
                        className="btn-ghost"
                        style={{ 
                            color: "var(--danger)", 
                            padding: "0 10px", 
                            height: "100%", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            border: "1px solid var(--danger)", 
                            background: "rgba(239, 68, 68, 0.1)",
                            cursor: "pointer"
                        }}
                        title="Cancel"
                     >
                         ✕
                     </button>
                 </div>
            </div>
        ) : (
            <button 
                type="button" 
                onClick={() => setShowAddForm(true)}
                className="btn-secondary"
                style={{ width: "100%", textAlign: "center", border: "1px dashed var(--border-color)", padding: "8px", color: "var(--text-muted)" }}
            >
                Create
            </button>
        )}
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