import { useEffect, useState } from "react";
import { Formik, Form, Field } from "formik";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext";
import { SearchableDropdown, ExplanationList, FormObserver } from "./JobFormComponents";
import { insertTextAtCursor, EditableText } from "../components/EditableText";
import type { Skill, Experience } from "../types";

export const EditJobRequirement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setIsDirty } = useFormState();
  
  const [jobDraft, setJobDraft] = useState<any>(null);
  const [activeReqIndex, setActiveReqIndex] = useState<number>(0);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [activeMatchIndices, setActiveMatchIndices] = useState<{[key: number]: number}>({});
  
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [filterByRelatedSkills, setFilterByRelatedSkills] = useState(true);
  const [filterByAllSkills, setFilterByAllSkills] = useState(false); 

  const fetchLists = async () => {
    try {
      const [skillRes, expRes] = await Promise.all([
        api.get("/lists/skills"),
        api.get("/experiences")
      ]);
      setSkills(skillRes.data);
      setExperiences(expRes.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchLists();

    const storedDraft = sessionStorage.getItem("job_form_draft");
    if (storedDraft) {
      setJobDraft(JSON.parse(storedDraft));
    } else {
      alert("No job draft found. Returning to Job list.");
      navigate("/add-job");
    }

    if (location.state?.reqIndex !== undefined) {
      setActiveReqIndex(location.state.reqIndex);
    }
  }, [navigate, location.state]);

  const refreshSkills = (newItem: Skill) => setSkills(prev => [...prev, newItem]);
  const getExpTitle = (id: string | number) => experiences.find(e => e.id.toString() === id?.toString())?.title || "-";
  const getFullExp = (id: string | number) => experiences.find(e => e.id.toString() === id?.toString());

  const getExpSkills = (exp: any) => {
    if (exp.SkillDemonstrations) {
        return exp.SkillDemonstrations
            .map((d: any) => d.Skill || { id: "orphan", title: "⚠ No Skill", isOrphan: true })
            .filter((s: any) => s != null);
    }
    return [];
  };

  const handleCreateTempExperience = (title: string, setFieldValue: any, currentMatches: any[]) => {
    const tempId = -Date.now(); 
    const newExp: Experience = { 
        id: tempId, 
        title, 
        description: "", 
        location: "", 
        position: "", 
        duration: "", 
        DemonstratedSkills: [] 
    };
    
    setExperiences(prev => [...prev, newExp]);
    setFieldValue(`requirements.${activeReqIndex}.matches`, [
        ...currentMatches, 
        { experienceId: tempId, matchExplanation: "" }
    ]);
    setActiveMatchIndices(prev => ({...prev, [activeReqIndex]: currentMatches.length}));
  };

  // --- ACTIONS ---
  const updateExperience = async (id: number, field: string, value: string) => {
    if (id < 0) {
        setExperiences(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
        return;
    }
    try {
      await api.put(`/experiences/${id}`, { [field]: value });
      setExperiences(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    } catch (e: any) { console.error(e); throw e; }
  };

  const updateSkill = async (id: number, newTitle: string) => {
    try {
      await api.put(`/lists/skills/${id}`, { title: newTitle });
      await fetchLists();
    } catch (e: any) { console.error(e); throw e; }
  };

  const deleteGlobalSkill = async (id: number) => {
    try {
        await api.delete(`/lists/skills/${id}`);
        await fetchLists();
    } catch (e: any) {
        alert("Error deleting skill: " + (e.response?.data?.error || e.message));
    }
  };
  
  const handleOpenExperience = (id: number, currentValues: any) => {
      sessionStorage.setItem("job_form_draft", JSON.stringify(currentValues));
      navigate("/add-experience", { 
          state: { 
              newId: id,
              returnPath: "/edit-requirement",
              targetField: "experience_edit_mode" 
          } 
      });
  };

  const handleDeleteExperience = async (id: number) => {
      if (!window.confirm("Are you sure you want to delete this Experience permanently from the database?")) return;
      try {
          await api.delete(`/experiences/${id}`);
          await fetchLists();
      } catch (e: any) { alert("Error: " + e.message); }
  };

  const updateSkillDemonstration = async (expId: number, skillId: number, newExplanation: string) => {
    if (expId < 0) return;
    try {
        await api.put(`/experiences/${expId}/demo/${skillId}`, { explanation: newExplanation });
        fetchLists();
    } catch (e: any) { console.error(e); throw e; }
  };
  
  const handleSkillReassign = async (demoId: number, newSkillId: number) => {
      try {
          await api.put(`/experiences/demo/${demoId}`, { SkillId: newSkillId });
          fetchLists(); 
      } catch (e: any) { alert("Error reassigning skill: " + e.message); }
  };

  const handleAddSkillDemonstration = async (expId: number, skillId: number, explanation: string) => {
    const skillObj = skills.find(s => s.id === skillId);
    if (!skillObj) return;

    if (expId < 0) {
        setExperiences(prev => prev.map(e => {
            if(e.id !== expId) return e;
            return {
                ...e,
                DemonstratedSkills: [...(e.DemonstratedSkills || []), { ...skillObj, ExpSkillDemo: { explanation } }]
            };
        }));
        return;
    }
    try {
        await api.post(`/experiences/${expId}/demo`, { skillId, explanation });
        await fetchLists();
    } catch (e: any) { alert("Error adding skill: " + e.message); }
  };

  const handleDeleteSkillDemonstration = async (expId: number, skillId: number | null) => {
    if (!skillId) { alert("Cannot delete orphan via this button."); return; }
    if (expId < 0) return;
    try {
        await api.delete(`/experiences/${expId}/demo/${skillId}`);
        await fetchLists();
    } catch (e: any) { alert("Error removing skill: " + e.message); }
  };

  const handleSave = async (values: any, { resetForm }: any) => {
    try {
      sessionStorage.setItem("job_form_draft", JSON.stringify(values));

      const tempIds = new Set<number>();
      values.requirements.forEach((r: any) => {
          r.matches?.forEach((m: any) => {
             if (m.experienceId < 0) tempIds.add(m.experienceId);
          });
      });

      const idMap = new Map<number, number>();
      for (const tempId of tempIds) {
          const tempExp = experiences.find(e => e.id === tempId);
          if (tempExp) {
             const { id, DemonstratedSkills, ...payload } = tempExp;
             const skillPayload = DemonstratedSkills?.map((s: any) => ({
                 skillId: s.id,
                 explanation: s.ExpSkillDemo?.explanation || ""
             })) || [];
             
             const res = await api.post("/experiences", { ...payload, skillDemonstrations: skillPayload });
             idMap.set(tempId, res.data.id);
          }
      }

      const newValues = { ...values };
      newValues.requirements = newValues.requirements.map((r: any) => ({
          ...r,
          matches: r.matches?.map((m: any) => ({
             ...m,
             experienceId: idMap.has(m.experienceId) ? idMap.get(m.experienceId) : m.experienceId
          }))
       }));

      if (newValues.id) {
        await api.put(`/jobs/${newValues.id}`, newValues);
        alert("Changes saved to Database successfully.");
      } else {
        alert("Changes saved to Draft (Job not created yet).");
      }
      
      await fetchLists();
      resetForm({ values: newValues });
      setIsDirty(false);

    } catch (e: any) {
      alert("Error saving: " + e.message);
    }
  };

  const handleReturn = (isDirty: boolean) => {
    if (isDirty && !window.confirm("You have unsaved changes. Return without saving?")) return;
    navigate("/add-job", { state: { returnFromReq: true } });
  };

  const handleSwitchReq = (newIndex: number, isDirty: boolean, resetForm: any) => {
     if (newIndex === activeReqIndex) return;
     if (isDirty) {
        if (!window.confirm("You have unsaved changes. Switch without saving?")) return;
        resetForm(); 
     }
     setActiveReqIndex(newIndex);
     setIsDirty(false); 
     setIsEditingDesc(false);
  };

  if (!jobDraft) return <div className="page-container">Loading...</div>;

  return (
    <div className="page-container">
      <div className="card-header">
         <h2 style={{margin:0}}>Edit Requirement</h2>
         <button onClick={() => handleReturn(false)} className="btn-ghost">Back</button>
      </div>

      <Formik initialValues={jobDraft} enableReinitialize onSubmit={handleSave}>
        {({ values, setFieldValue, dirty, submitForm, resetForm }) => {
           const reqIndex = activeReqIndex;
           const currentReq = values.requirements[reqIndex];
           if (!currentReq) return <div>Error: Requirement not found</div>;
           
           const reqSkillIds = (currentReq.skillIds || []).map((id: any) => id.toString());

           const filteredExperiences = experiences.filter(exp => {
                if (reqSkillIds.length === 0) return true;
                const expSkills = getExpSkills(exp);
                const expSkillIds = expSkills.map((s: any) => s.id && s.id.toString());
                if (filterByAllSkills) return reqSkillIds.every((reqId: string) => expSkillIds.includes(reqId));
                if (filterByRelatedSkills) return reqSkillIds.some((reqId: string) => expSkillIds.includes(reqId));
                return true;
           });

           // --- WRAPPER TO CHECK IF SKILL SHOULD BE ADDED TO REQUIREMENT ---
           const checkAndAddRelatedSkill = (skillId: number) => {
               const currentSkillIds = values.requirements[reqIndex].skillIds || [];
               if (!currentSkillIds.includes(skillId)) {
                   const skill = skills.find(s => s.id === skillId);
                   const skillName = skill ? skill.title : "Unknown Skill";
                   if (window.confirm(`The skill "${skillName}" is not listed in this Requirement's Related Skills.\n\nDo you want to add it?`)) {
                       setFieldValue(`requirements.${reqIndex}.skillIds`, [...currentSkillIds, skillId]);
                   }
               }
           };

           return (
            <Form>
              <FormObserver />
              <div className="card edit-mode-container" style={{background: "#f8fafc", borderColor: "var(--primary)"}}>
                  
                  <div style={{
                      display: "flex", 
                      alignItems: "center", 
                      gap: "10px", 
                      marginBottom: "15px", 
                      borderBottom: "1px solid #e2e8f0", 
                      paddingBottom: "10px"
                  }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "2px" }}>
                              Requirement {reqIndex + 1} of {values.requirements.length}
                          </label>
                          
                          {isEditingDesc ? (
                              <div style={{ display: "flex", gap: "5px" }}>
                                  <Field 
                                    name={`requirements.${reqIndex}.description`} 
                                    type="text" 
                                    autoFocus
                                    placeholder="Enter Requirement Description..."
                                    style={{ height: "38px", width: "100%", marginBottom: 0 }}
                                    onKeyDown={(e: React.KeyboardEvent) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            setIsEditingDesc(false);
                                        }
                                    }}
                                  />
                                  <button type="button" className="btn-primary" onClick={() => setIsEditingDesc(false)} title="Done Editing" style={{ padding: "0 12px" }}>✓</button>
                              </div>
                          ) : (
                              <select 
                                value={reqIndex} 
                                onChange={(e) => handleSwitchReq(parseInt(e.target.value), dirty, resetForm)}
                                style={{ width: "100%", fontWeight: "bold", fontSize: "1rem", marginBottom: 0, cursor: "pointer", border: "1px solid transparent", background: "transparent", paddingLeft: 0 }}
                                className="req-switcher-select"
                              >
                                {values.requirements.map((req: any, idx: number) => (
                                  <option key={idx} value={idx}>
                                    {idx + 1}. {req.description ? (req.description.length > 80 ? req.description.substring(0,80)+"..." : req.description) : "(No Description)"}
                                  </option>
                                ))}
                              </select>
                          )}
                      </div>

                      {!isEditingDesc && (
                          <button type="button" className="btn-secondary" onClick={() => setIsEditingDesc(true)} title="Edit Description" style={{ padding: "8px 12px" }}>✎</button>
                      )}
                      
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => {
                           const newReq = { description: "", skillIds: [], matches: [] };
                           const newReqs = [...values.requirements, newReq];
                           setFieldValue("requirements", newReqs);
                           setActiveReqIndex(newReqs.length - 1);
                           setIsEditingDesc(true);
                        }}
                        title="Add New Requirement"
                        style={{ padding: "8px 12px" }}
                      >
                        +
                      </button>
                      
                      <button 
                        type="button" 
                        className="btn-ghost" 
                        style={{ color: "var(--danger)", padding: "8px 12px" }}
                        onClick={() => {
                           if (!window.confirm("Are you sure you want to delete this requirement?")) return;
                           const newReqs = values.requirements.filter((_: any, i: number) => i !== reqIndex);
                           if (newReqs.length === 0) newReqs.push({ description: "", skillIds: [], matches: [] });
                           setFieldValue("requirements", newReqs);
                           if (reqIndex >= newReqs.length) setActiveReqIndex(newReqs.length - 1);
                        }}
                        title="Delete Requirement"
                        disabled={values.requirements.length <= 1} 
                      >
                        🗑️
                      </button>
                  </div>
                  
                  <SearchableDropdown 
                    label="Related Skills" 
                    name={`requirements.${reqIndex}.skillIds`} 
                    options={skills} 
                    multiple={true} 
                    createEndpoint="/lists/skills" 
                    onOptionCreated={refreshSkills}
                    onRename={updateSkill}
                    onDeleteOption={async (id: number) => {
                        if (!window.confirm("Warning: You are about to delete this skill globally from all experiences and requirements.\n\nAre you sure?")) return;
                        
                        await deleteGlobalSkill(id);
                        
                        // Check if deleted skill was selected in this field and remove it
                        const currentIds = values.requirements[reqIndex].skillIds || [];
                        if (currentIds.includes(id)) {
                             setFieldValue(`requirements.${reqIndex}.skillIds`, currentIds.filter((sid: any) => sid !== id));
                        }
                    }}
                  />
                  
                  <div style={{ background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "15px" }}>
                      <label style={{marginBottom: "10px", display: "block"}}>Matching Experiences</label>
                      
                      <SearchableDropdown 
                          label="" 
                          name={`requirements.${reqIndex}.matches.NEW`}
                          options={filteredExperiences} 
                          onCreate={(title: string) => handleCreateTempExperience(title, setFieldValue, currentReq.matches || [])}
                          
                          onOpen={(id: number) => handleOpenExperience(id, values)}
                          onDeleteOption={handleDeleteExperience} 
                          onRename={(id: number, val: string) => updateExperience(id, 'title', val)}

                          renderOption={(exp: any) => {
                             const allExpSkills = getExpSkills(exp);
                             let displayedSkills = allExpSkills;
                             if (filterByRelatedSkills && reqSkillIds.length > 0) {
                                displayedSkills = allExpSkills.filter((s: any) => s.isOrphan || reqSkillIds.includes(s.id.toString()));
                             }

                             return (
                                 <EditableText 
                                     value={exp.title}
                                     onSave={(val) => updateExperience(exp.id, 'title', val)}
                                     style={{ 
                                         width: "100%", 
                                         border: "none", 
                                         padding: 0, 
                                         background: "transparent", 
                                         cursor: "pointer",
                                         display: "flex"
                                     }}
                                 >
                                     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "center", width: "100%" }}>
                                        <span style={{ fontWeight: 500 }}>{exp.title}</span>
                                        {displayedSkills.length > 0 && (
                                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {displayedSkills.map((s: any) => s.title).join(", ")}
                                            </div>
                                        )}
                                     </div>
                                 </EditableText>
                             );
                          }}

                          headerContent={
                            <div style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: 0 }}>
                                <label style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", cursor: "pointer", marginBottom: 0, fontWeight: "normal", color: "var(--text-muted)" }}>
                                    <input type="checkbox" checked={filterByRelatedSkills} onChange={(e) => setFilterByRelatedSkills(e.target.checked)} style={{ width: "auto", marginBottom: 0, marginRight: "6px" }} />
                                    Filter by Related Skills
                                </label>
                                <label style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", cursor: "pointer", marginBottom: 0, fontWeight: "normal", color: "var(--text-muted)" }}>
                                    <input type="checkbox" checked={filterByAllSkills} onChange={(e) => { setFilterByAllSkills(e.target.checked); if (e.target.checked) setFilterByRelatedSkills(true); }} style={{ width: "auto", marginBottom: 0, marginRight: "6px" }} />
                                    Filter by ALL Skills
                                </label>
                            </div>
                          }

                          onSelect={(id: number) => {
                              const currentMatches = currentReq.matches || [];
                              const existingIndex = currentMatches.findIndex((m: any) => m.experienceId === id);
                              if (existingIndex >= 0) {
                                  setActiveMatchIndices(prev => ({...prev, [reqIndex]: existingIndex}));
                              } else {
                                  setFieldValue(`requirements.${reqIndex}.matches`, [
                                      ...currentMatches, 
                                      { experienceId: id, matchExplanation: "" }
                                  ]);
                                  setActiveMatchIndices(prev => ({...prev, [reqIndex]: currentMatches.length}));
                              }
                          }}
                      />
                      
                      {currentReq.matches && currentReq.matches.length > 0 && (
                        <>
                          <div className="tabs-row">
                              {(() => {
                                  const activeIndex = activeMatchIndices[reqIndex] ?? 0;
                                  const activeMatch = currentReq.matches[activeIndex] || currentReq.matches[0]; 
                                  const isTemp = activeMatch.experienceId < 0;

                                  return (
                                    <div className="tab-static">
                                        <EditableText 
                                            targetId={`match-explanation-${reqIndex}`}
                                            value={getExpTitle(activeMatch.experienceId)}
                                            onSave={(val) => updateExperience(activeMatch.experienceId, 'title', val)}
                                            onClick={(e) => insertTextAtCursor(`match-explanation-${reqIndex}`, getExpTitle(activeMatch.experienceId), e)}
                                            style={{ border: "none", background: "transparent", color: "inherit", paddingRight: 0, fontWeight: "inherit", fontSize: "0.9rem", minWidth: "60px" }}
                                        />
                                        
                                        {isTemp && (
                                            <span 
                                                onClick={(e) => { e.stopPropagation(); }}
                                                style={{ padding: "0 4px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--success)", fontSize: "0.8rem" }}
                                                title="Save Experience to Database"
                                            >
                                                💾
                                            </span>
                                        )}

                                        <span 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newMatches = [...currentReq.matches];
                                                newMatches.splice(activeIndex, 1);
                                                setFieldValue(`requirements.${reqIndex}.matches`, newMatches);
                                                setActiveMatchIndices(prev => ({...prev, [reqIndex]: 0}));
                                            }}
                                            style={{ padding: "0 4px", cursor: "pointer", marginLeft: "4px", display: "flex", alignItems: "center", fontSize: "1.1rem", lineHeight: 1 }}
                                            title="Remove Match"
                                        >
                                            ×
                                        </span>
                                    </div>
                                  );
                              })()}

                              <div className="tabs-scroll-area">
                                  {currentReq.matches.map((match: any, matchIdx: number) => {
                                      const activeIndex = activeMatchIndices[reqIndex] ?? 0;
                                      const isActive = matchIdx === activeIndex;
                                      if (isActive) return null;

                                      return (
                                        <div 
                                            key={match.experienceId}
                                            className="tab-scrollable"
                                            onClick={() => setActiveMatchIndices(prev => ({...prev, [reqIndex]: matchIdx}))}
                                        >
                                            <EditableText 
                                                targetId={`match-explanation-${reqIndex}`} 
                                                value={getExpTitle(match.experienceId)}
                                                onSave={(val) => updateExperience(match.experienceId, 'title', val)}
                                                onClick={() => { setActiveMatchIndices(prev => ({...prev, [reqIndex]: matchIdx})); }}
                                                style={{ border: "none", background: "transparent", color: "inherit", paddingRight: 0, fontWeight: "inherit", fontSize: "0.9rem", minWidth: "60px" }}
                                            />
                                            <span 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newMatches = [...currentReq.matches];
                                                    newMatches.splice(matchIdx, 1);
                                                    setFieldValue(`requirements.${reqIndex}.matches`, newMatches);
                                                }}
                                                style={{ padding: "0 4px", cursor: "pointer", marginLeft: "4px", display: "flex", alignItems: "center", fontSize: "1.1rem", lineHeight: 1 }}
                                                title="Remove Match"
                                            >
                                                ×
                                            </span>
                                        </div>
                                      );
                                  })}
                              </div>
                          </div>

                          <div className="tab-content">
                              {(() => {
                                  const currentIndex = activeMatchIndices[reqIndex] ?? 0;
                                  const matchData = currentReq.matches[currentIndex] || currentReq.matches[0];
                                  if(!matchData) return null;
                                  
                                  const fullExp = getFullExp(matchData.experienceId);
                                  const validIndex = currentReq.matches.indexOf(matchData);
                                  const targetId = `match-explanation-${reqIndex}`;
                                  
                                  const otherExplanations = values.requirements.reduce((acc: any[], r: any, idx: number) => {
                                      if (idx === reqIndex) return acc;
                                      const hasSharedSkill = r.skillIds?.some((sId: any) => currentReq.skillIds?.includes(sId));
                                      if (!hasSharedSkill) return acc;
                                      const match = r.matches?.find((m: any) => m.experienceId === matchData.experienceId);
                                      if (match && match.matchExplanation) {
                                          acc.push({ reqDesc: r.description, explanation: match.matchExplanation });
                                      }
                                      return acc;
                                  }, []);

                                  const insertBtnStyle = { padding: "4px 8px", fontSize: "0.8rem", flex: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" as const };

                                  return (
                                      <>
                                          <div style={{ marginBottom: "10px" }}>
                                              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                                  <div style={{ display: "flex", gap: "5px", width: "100%" }}>
                                                    <EditableText targetId={targetId} value={fullExp?.position} placeholder="Position" style={insertBtnStyle} onSave={(val) => updateExperience(matchData.experienceId, 'position', val)} />
                                                    <EditableText targetId={targetId} value={fullExp?.location} placeholder="Location" style={insertBtnStyle} onSave={(val) => updateExperience(matchData.experienceId, 'location', val)} />
                                                    <EditableText targetId={targetId} value={fullExp?.duration} placeholder="Duration" style={insertBtnStyle} onSave={(val) => updateExperience(matchData.experienceId, 'duration', val)} />
                                                  </div>
                                                  <div style={{ display: "flex", width: "100%" }}>
                                                      <EditableText targetId={targetId} value={fullExp?.description} placeholder="Description" style={{...insertBtnStyle, textAlign: "left"}} onSave={(val) => updateExperience(matchData.experienceId, 'description', val)} />
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          <Field id={targetId} name={`requirements.${reqIndex}.matches.${validIndex}.matchExplanation`} as="textarea" rows={3} placeholder={`How does "${getExpTitle(matchData.experienceId)}" meet this requirement?`} style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, resize: "vertical" }} />

                                          {otherExplanations.length > 0 && (
                                              <select
                                                  style={{ width: "100%", borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, background: "#f1f5f9", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "10px", cursor: "pointer", padding: "4px 8px", height: "auto" }}
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
                                              experienceId={matchData.experienceId} 
                                              experiences={experiences} 
                                              allSkills={skills} 
                                              relatedSkillIds={reqSkillIds} 
                                              onSkillDemoUpdate={updateSkillDemonstration}
                                              onAddSkillDemo={async (expId: number, skillId: number, exp: string) => {
                                                  checkAndAddRelatedSkill(skillId);
                                                  await handleAddSkillDemonstration(expId, skillId, exp);
                                              }} 
                                              onDeleteSkillDemo={handleDeleteSkillDemonstration}
                                              onGlobalSkillCreated={refreshSkills}
                                              onSkillChange={async (demoId: number, newSkillId: number) => {
                                                  checkAndAddRelatedSkill(newSkillId);
                                                  await handleSkillReassign(demoId, newSkillId);
                                              }} 
                                              onGlobalSkillRename={updateSkill}
                                              onGlobalSkillDelete={deleteGlobalSkill}
                                          />
                                      </>
                                  );
                              })()}
                          </div>
                        </>
                      )}
                  </div>
              </div>
              
              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                 <button type="button" onClick={() => submitForm()} className="btn-primary" style={{ flex: 1 }}>Save Changes</button>
                 <button type="button" onClick={() => handleReturn(dirty)} className="btn-secondary" style={{ flex: 1 }}>Return to Job</button>
              </div>
            </Form>
           );
        }}
      </Formik>
    </div>
  );
};