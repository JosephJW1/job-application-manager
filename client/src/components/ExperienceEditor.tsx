import { useState, useRef, useEffect, useMemo } from "react";
import { Field } from "formik";
import { EditableText, insertTextAtCursor } from "./EditableText";
import { ExplanationList } from "../pages/JobFormComponents";

interface ExperienceEditorProps {
  experience: any;
  experiences: any[];
  skills: any[];
  // Allow void to support Formik's setFieldValue without strict Promise requirement
  onUpdate: (field: string, value: any) => Promise<void> | void; 
  mode: "match" | "standalone";
  
  targetId?: string;
  explanationFieldName?: string;
  otherExplanations?: any[];
  relatedSkillIds?: string[];
  
  // Handler for Enter key in Title field
  onTitleEnter?: () => void;

  handlers: {
    onSkillDemoUpdate?: (expId: number, skillId: number, explanation: string) => Promise<void> | void;
    // Allow Promise<boolean | void> to cover both returning 'isRelated' (boolean) or nothing
    onAddSkillDemo?: (expId: number, skillId: number, explanation: string) => Promise<boolean | void>; 
    onDeleteSkillDemo?: (expId: number, skillId: number | null, demoId?: number | string) => Promise<void> | void;
    onEnsureRelatedSkill?: (skillId: number) => Promise<void>;
    onGlobalSkillCreated?: (skill: any) => void;
    // UPDATED: Accept optional 3rd arg for the skill object
    onSkillChange?: (demoId: number | string, newSkillId: number, newSkill?: any) => Promise<void> | void;
    onGlobalSkillRename?: (id: number, title: string) => Promise<void>;
    onGlobalSkillDelete?: (id: number) => Promise<void>;
  };
}

export const ExperienceEditor = ({
  experience,
  experiences,
  skills,
  onUpdate,
  mode,
  targetId,
  explanationFieldName,
  otherExplanations,
  relatedSkillIds,
  onTitleEnter,
  handlers
}: ExperienceEditorProps) => {
  const [dropdownState, setDropdownState] = useState<{ field: string; top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownState(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!experience) return null;

  // Helper to strictly ensure we return a Promise<void> for EditableText
  const handleUpdate = async (field: string, val: string) => {
      await onUpdate(field, val);
  };

  const handleFieldClick = (field: string, e: React.MouseEvent) => {
    if (mode === "match" && targetId) {
      insertTextAtCursor(targetId, experience[field], e);
    } else if (mode === "standalone") {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDropdownState({
        field,
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      });
    }
  };

  const handleUniqueValueSelect = (val: string) => {
    if (window.confirm(`This will replace the existing ${dropdownState?.field} content. Proceed?`)) {
      if (dropdownState?.field) {
        onUpdate(dropdownState.field, val);
      }
    }
    setDropdownState(null);
  };

  const uniqueOptions = useMemo(() => {
    if (!dropdownState || !experiences) return [];
    const field = dropdownState.field;
    const values = experiences
      .filter(e => e.id !== experience.id)
      .map(e => e[field])
      .filter(v => v && typeof v === 'string' && v.trim() !== "");
    return [...new Set(values)].sort();
  }, [dropdownState, experiences, experience.id]);

  const insertBtnStyle = { 
    padding: "4px 8px", 
    fontSize: "0.8rem", 
    flex: 1, 
    whiteSpace: "nowrap" as const, 
    overflow: "hidden", 
    textOverflow: "ellipsis", 
    textAlign: "center" as const,
    cursor: mode === "match" ? "copy" : "pointer" 
  };

  return (
    <>
      <div style={{ marginBottom: "10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            
          {mode === "standalone" && (
             <div style={{ marginBottom: "5px" }}>
                <label style={{fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "2px"}}>Title</label>
                <Field name="title">
                   {({ field }: any) => (
                       <input 
                          {...field}
                          autoFocus
                          placeholder="Experience Title..."
                          style={{ 
                              fontSize: "1.1rem", 
                              fontWeight: "bold", 
                              width: "100%",
                              padding: "8px",
                              border: "1px solid var(--border-color)",
                              borderRadius: "4px",
                              marginBottom: "5px",
                              display: "block"
                          }}
                          onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (onTitleEnter) onTitleEnter();
                              }
                          }}
                       />
                   )}
                </Field>
             </div>
          )}

          <div style={{ display: "flex", gap: "5px", width: "100%" }}>
            <EditableText 
                targetId={targetId} 
                value={experience.position} 
                placeholder="Position" 
                style={insertBtnStyle} 
                onSave={(val) => handleUpdate('position', val)}
                onClick={(e) => handleFieldClick('position', e)}
            />
            <EditableText 
                targetId={targetId} 
                value={experience.location} 
                placeholder="Location" 
                style={insertBtnStyle} 
                onSave={(val) => handleUpdate('location', val)}
                onClick={(e) => handleFieldClick('location', e)}
            />
            <EditableText 
                targetId={targetId} 
                value={experience.duration} 
                placeholder="Duration" 
                style={insertBtnStyle} 
                onSave={(val) => handleUpdate('duration', val)}
                onClick={(e) => handleFieldClick('duration', e)}
            />
          </div>
          <div style={{ display: "flex", width: "100%" }}>
              <EditableText 
                targetId={targetId} 
                value={experience.description} 
                placeholder="Description" 
                style={{...insertBtnStyle, textAlign: "left"}} 
                onSave={(val) => handleUpdate('description', val)}
                onClick={(e) => handleFieldClick('description', e)}
              />
          </div>
        </div>
      </div>
      
      {dropdownState && (
        <div 
            ref={dropdownRef}
            style={{ 
                position: "absolute", 
                top: dropdownState.top, 
                left: dropdownState.left, 
                zIndex: 1000, 
                background: "var(--bg-surface)", 
                border: "1px solid var(--border-color)", 
                borderRadius: "4px", 
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)", 
                maxHeight: "200px", 
                overflowY: "auto", 
                minWidth: "150px" 
            }}
        >
            {uniqueOptions.length > 0 ? (
                uniqueOptions.map((opt, idx) => (
                    <div 
                        key={idx} 
                        onClick={() => handleUniqueValueSelect(opt)}
                        style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-color)", color: "var(--text-main)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
                    >
                        {opt}
                    </div>
                ))
            ) : (
                <div style={{ padding: "8px 12px", color: "var(--text-muted)", fontStyle: "italic" }}>No other values found</div>
            )}
        </div>
      )}

      {mode === "match" && explanationFieldName && targetId && (
          <Field 
            id={targetId} 
            name={explanationFieldName} 
            as="textarea" 
            rows={3} 
            placeholder={`How does "${experience.title}" meet this requirement?`} 
            style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, resize: "vertical" }} 
          />
      )}

      {mode === "match" && otherExplanations && otherExplanations.length > 0 && targetId && (
          <select
              style={{ width: "100%", borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, background: "var(--bg-input)", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "10px", cursor: "pointer", padding: "4px 8px", height: "auto" }}
              value=""
              onChange={(e) => { if(e.target.value) { insertTextAtCursor(targetId, e.target.value, { ctrlKey: true } as any); e.target.value = ""; } }}
          >
              <option value="" disabled selected hidden>-- Copy from similar requirement --</option>
              {otherExplanations.map((item: any, idx: number) => (
                  <option key={idx} value={item.explanation}>{item.reqDesc.substring(0,60)}... → {item.explanation.substring(0,120)}...</option>
              ))}
          </select>
      )}
      
      <ExplanationList 
          targetId={targetId} 
          experienceId={experience.id} 
          // Pass the live experience object to ensure list updates when form values change
          experience={experience}
          experiences={experiences} 
          allSkills={skills} 
          relatedSkillIds={relatedSkillIds} 
          onSkillDemoUpdate={handlers.onSkillDemoUpdate}
          onAddSkillDemo={handlers.onAddSkillDemo} 
          onEnsureRelatedSkill={handlers.onEnsureRelatedSkill}
          onDeleteSkillDemo={handlers.onDeleteSkillDemo}
          onGlobalSkillCreated={handlers.onGlobalSkillCreated}
          onSkillChange={handlers.onSkillChange} 
          onGlobalSkillRename={handlers.onGlobalSkillRename}
          onGlobalSkillDelete={handlers.onGlobalSkillDelete}
      />
    </>
  );
};