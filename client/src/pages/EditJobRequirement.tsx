import { useEffect, useState } from "react";
import { Formik, Form, Field } from "formik";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext";
import { SearchableDropdown, ExplanationList, FormObserver, insertTextAtCursor, EditableInsertButton } from "./JobFormComponents";
import type { Skill, Experience } from "../types";

const RequirementSwitcher = ({ 
  currentIdx, 
  reqs, 
  onSwitch, 
  isDirty 
}: { currentIdx: number, reqs: any[], onSwitch: (idx: number) => void, isDirty: boolean }) => {
  
  const handleSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = parseInt(e.target.value);
    if (newIndex === currentIdx) return;

    if (isDirty) {
      if (!window.confirm("You have unsaved changes in this requirement. Switching will discard them. Continue?")) {
        return; 
      }
    }
    onSwitch(newIndex);
  };

  return (
    <div style={{ marginBottom: "20px", background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
      <label style={{marginBottom: "5px"}}>Switch Requirement</label>
      <select 
        value={currentIdx} 
        onChange={handleSwitch}
        style={{ width: "100%", fontWeight: "bold", fontSize: "1rem" }}
      >
        {reqs.map((req, idx) => (
          <option key={idx} value={idx}>
            {idx + 1}. {req.description ? (req.description.length > 60 ? req.description.substring(0,60)+"..." : req.description) : "(No Description)"}
          </option>
        ))}
      </select>
    </div>
  );
};

export const EditJobRequirement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setIsDirty } = useFormState();
  
  const [jobDraft, setJobDraft] = useState<any>(null);
  const [activeReqIndex, setActiveReqIndex] = useState<number>(0);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [activeMatchIndices, setActiveMatchIndices] = useState<{[key: number]: number}>({});
  
  // UPDATED: Default to true
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

  // --- LOGIC: CREATE TEMP EXPERIENCE ---
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

  // --- API UPDATERS ---
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

  const updateSkillDemonstration = async (expId: number, skillId: number, newExplanation: string) => {
    if (expId < 0) {
        setExperiences(prev => prev.map(e => {
            if(e.id !== expId) return e;
            const newSkills = (e.DemonstratedSkills || []).map((s: any) => 
                s.id === skillId ? { ...s, ExpSkillDemo: { ...s.ExpSkillDemo, explanation: newExplanation } } : s
            );
            return { ...e, DemonstratedSkills: newSkills };
        }));
        return;
    }
    try {
        await api.put(`/experiences/${expId}/demo/${skillId}`, { explanation: newExplanation });
        setExperiences(prev => prev.map(e => {
            if(e.id !== expId || !e.DemonstratedSkills) return e;
            return {
                ...e,
                DemonstratedSkills: e.DemonstratedSkills.map((s: any) => 
                    s.id === skillId ? { ...s, ExpSkillDemo: { ...s.ExpSkillDemo, explanation: newExplanation } } : s
                )
            };
        }));
    } catch (e: any) { console.error(e); throw e; }
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

  const handleDeleteSkillDemonstration = async (expId: number, skillId: number) => {
    if (expId < 0) {
        setExperiences(prev => prev.map(e => {
            if(e.id !== expId) return e;
            return {
                ...e,
                DemonstratedSkills: (e.DemonstratedSkills || []).filter((s: any) => s.id !== skillId)
            };
        }));
        return;
    }

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
    if (isDirty) {
      if(!window.confirm("You have unsaved changes. Return without saving?")) return;
    }
    navigate("/add-job", { state: { returnFromReq: true } });
  };

  const handleSwitchReq = (newIndex: number) => {
     setActiveReqIndex(newIndex);
     setIsDirty(false); 
  };

  if (!jobDraft) return <div className="page-container">Loading...</div>;

  return (
    <div className="page-container">
      <div className="card-header">
         <h2 style={{margin:0}}>Edit Requirement</h2>
         <button onClick={() => handleReturn(false)} className="btn-ghost">Back</button>
      </div>

      <Formik 
        initialValues={jobDraft} 
        enableReinitialize 
        onSubmit={handleSave}
      >
        {({ values, setFieldValue, dirty, submitForm, resetForm }) => {
           const reqIndex = activeReqIndex;
           const currentReq = values.requirements[reqIndex];
           
           if (!currentReq) return <div>Error: Requirement not found</div>;

           const handleSaveTempExperience = async (tempId: number) => {
                const tempExp = experiences.find(e => e.id === tempId);
                if (!tempExp) return;

                try {
                    const { id, DemonstratedSkills, ...payload } = tempExp;
                    const skillPayload = DemonstratedSkills?.map((s: any) => ({
                        skillId: s.id,
                        explanation: s.ExpSkillDemo?.explanation || ""
                    })) || [];

                    const res = await api.post("/experiences", { ...payload, skillDemonstrations: skillPayload });
                    const newId = res.data.id;
                    const savedExp = res.data; 

                    setExperiences(prev => prev.map(e => e.id === tempId ? savedExp : e));

                    const newRequirements = values.requirements.map((r: any) => ({
                        ...r,
                        matches: r.matches?.map((m: any) => ({
                            ...m,
                            experienceId: m.experienceId === tempId ? newId : m.experienceId
                        }))
                    }));
                    setFieldValue("requirements", newRequirements);

                } catch (e: any) {
                    alert("Error saving experience: " + e.message);
                }
           };

           // --- REMOVE HANDLER (NEW) ---
           const handleRemoveMatch = (match: any, index: number) => {
                const isTemp = match.experienceId < 0;
                const hasExplanation = match.matchExplanation && match.matchExplanation.trim().length > 0;
                
                let shouldWarn = false;

                if (isTemp) {
                    // If it is a newly added temp experience, check if it has any user-entered details
                    const exp = experiences.find(e => e.id === match.experienceId);
                    if (exp) {
                        const hasDetails = 
                            (exp.description && exp.description.trim().length > 0) ||
                            (exp.position && exp.position.trim().length > 0) ||
                            (exp.location && exp.location.trim().length > 0) ||
                            (exp.duration && exp.duration.trim().length > 0) ||
                            (exp.DemonstratedSkills && exp.DemonstratedSkills.length > 0);
                        
                        if (hasDetails || hasExplanation) shouldWarn = true;
                    }
                } else {
                    // Existing experience: Warn if user typed a match explanation that would be lost
                    if (hasExplanation) shouldWarn = true;
                }

                if (shouldWarn) {
                    if (!window.confirm("You have entered details for this match. Removing it will discard them. Continue?")) {
                        return;
                    }
                }

                const newMatches = [...currentReq.matches];
                newMatches.splice(index, 1);
                setFieldValue(`requirements.${reqIndex}.matches`, newMatches);
                setActiveMatchIndices(prev => ({...prev, [reqIndex]: 0}));
           };

           // --- FILTER LOGIC (UPDATED) ---
           const reqSkillIds = (currentReq.skillIds || []).map((id: any) => id.toString());

           const filteredExperiences = experiences.filter(exp => {
                if (reqSkillIds.length === 0) return true;

                const expSkillIds = (exp.DemonstratedSkills || []).map((s: any) => s.id.toString());
                
                if (filterByAllSkills) {
                     return reqSkillIds.every((reqId: string) => expSkillIds.includes(reqId));
                }
                
                if (filterByRelatedSkills) {
                     return reqSkillIds.some((reqId: string) => expSkillIds.includes(reqId));
                }
                
                return true;
           });

           return (
            <Form>
              <FormObserver />
              
              <RequirementSwitcher 
                currentIdx={reqIndex} 
                reqs={values.requirements} 
                onSwitch={(idx) => { 
                    handleSwitchReq(idx); 
                    resetForm({ values: values }); 
                }} 
                isDirty={dirty} 
              />

              <div className="card edit-mode-container" style={{background: "#f8fafc", borderColor: "var(--primary)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", marginBottom: "15px", alignItems: "center"}}>
                      <h4 style={{margin:0, color: "var(--primary)"}}>Requirement Details</h4>
                  </div>
                  
                  <label>Requirement Description <span style={{color:'var(--danger)'}}>*</span></label>
                  <Field 
                    name={`requirements.${reqIndex}.description`} 
                    required 
                    as="textarea" 
                    rows={2} 
                    style={{ resize: "vertical" }}
                  />
                  
                  <SearchableDropdown 
                    label="Related Skills" 
                    name={`requirements.${reqIndex}.skillIds`} 
                    options={skills} 
                    multiple={true} 
                    createEndpoint="/lists/skills" 
                    onOptionCreated={refreshSkills}
                    onRename={updateSkill} 
                  />
                  
                  <div style={{ background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "15px" }}>
                      <label style={{marginBottom: "10px", display: "block"}}>Matching Experiences</label>
                      
                      <SearchableDropdown 
                          label="" 
                          name={`requirements.${reqIndex}.matches.NEW`}
                          options={filteredExperiences} 
                          onCreate={(title: string) => handleCreateTempExperience(title, setFieldValue, currentReq.matches || [])}
                          
                          renderOption={(exp: any) => (
                             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", overflow: "hidden" }}>
                                <span style={{ fontWeight: 500, marginRight: "10px" }}>{exp.title}</span>
                                {exp.DemonstratedSkills && exp.DemonstratedSkills.length > 0 && (
                                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>
                                        ({exp.DemonstratedSkills.map((s: any) => s.title).join(", ")})
                                    </span>
                                )}
                             </div>
                          )}

                          headerContent={
                            <div style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: 0 }}>
                                <label style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    fontSize: "0.85rem", 
                                    cursor: "pointer", 
                                    marginBottom: 0,
                                    fontWeight: "normal",
                                    color: "var(--text-muted)"
                                }}>
                                    <input 
                                        type="checkbox" 
                                        checked={filterByRelatedSkills} 
                                        onChange={(e) => {
                                            setFilterByRelatedSkills(e.target.checked);
                                        }} 
                                        style={{ width: "auto", marginBottom: 0, marginRight: "6px" }}
                                    />
                                    <span style={{ whiteSpace: "nowrap" }}>Filter by Related Skills</span>
                                </label>

                                <label style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    fontSize: "0.85rem", 
                                    cursor: "pointer", 
                                    marginBottom: 0,
                                    fontWeight: "normal",
                                    color: "var(--text-muted)"
                                }}>
                                    <input 
                                        type="checkbox" 
                                        checked={filterByAllSkills} 
                                        onChange={(e) => {
                                            setFilterByAllSkills(e.target.checked);
                                            if (e.target.checked) setFilterByRelatedSkills(true);
                                        }} 
                                        style={{ width: "auto", marginBottom: 0, marginRight: "6px" }}
                                    />
                                    <span style={{ whiteSpace: "nowrap" }}>Filter by ALL Skills</span>
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

                      {/* --- PINNED TAB INTERFACE --- */}
                      {currentReq.matches && currentReq.matches.length > 0 && (
                        <>
                          <div className="tabs-row">
                              {/* 1. Render ONLY the Active Tab (Pinned) */}
                              {(() => {
                                  const activeIndex = activeMatchIndices[reqIndex] ?? 0;
                                  const activeMatch = currentReq.matches[activeIndex] || currentReq.matches[0]; 
                                  const isTemp = activeMatch.experienceId < 0;

                                  return (
                                    <div className="tab-static">
                                        <EditableInsertButton 
                                            targetId={`match-explanation-${reqIndex}`}
                                            value={getExpTitle(activeMatch.experienceId)}
                                            onSave={(val) => updateExperience(activeMatch.experienceId, 'title', val)}
                                            onInsert={(e) => insertTextAtCursor(`match-explanation-${reqIndex}`, getExpTitle(activeMatch.experienceId), e)}
                                            style={{
                                                border: "none",
                                                background: "transparent",
                                                color: "inherit",
                                                paddingRight: 0, 
                                                fontWeight: "inherit",
                                                fontSize: "0.9rem",
                                                minWidth: "60px"
                                            }}
                                        />
                                        
                                        {isTemp && (
                                            <span 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveTempExperience(activeMatch.experienceId);
                                                }}
                                                style={{ 
                                                    padding: "0 4px", 
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    color: "var(--success)", 
                                                    fontSize: "0.8rem"
                                                }}
                                                title="Save Experience to Database"
                                            >
                                                💾
                                            </span>
                                        )}

                                        <span 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const indexToRemove = currentReq.matches.indexOf(activeMatch);
                                                if (indexToRemove > -1) {
                                                    handleRemoveMatch(activeMatch, indexToRemove);
                                                }
                                            }}
                                            style={{ 
                                                padding: "0 4px", 
                                                cursor: "pointer",
                                                marginLeft: "4px",
                                                display: "flex",
                                                alignItems: "center",
                                                fontSize: "1.1rem",
                                                lineHeight: 1
                                            }}
                                            title="Remove Match"
                                        >
                                            ×
                                        </span>
                                    </div>
                                  );
                              })()}

                              {/* 2. Render the REST in the scrollable area */}
                              <div className="tabs-scroll-area">
                                  {currentReq.matches.map((match: any, matchIdx: number) => {
                                      const activeIndex = activeMatchIndices[reqIndex] ?? 0;
                                      const isActive = matchIdx === activeIndex;
                                      
                                      if (isActive) return null;

                                      const isTemp = match.experienceId < 0;

                                      return (
                                        <div 
                                            key={match.experienceId}
                                            className="tab-scrollable"
                                            onClick={() => setActiveMatchIndices(prev => ({...prev, [reqIndex]: matchIdx}))}
                                        >
                                            <EditableInsertButton 
                                                targetId={`match-explanation-${reqIndex}`} 
                                                value={getExpTitle(match.experienceId)}
                                                onSave={(val) => updateExperience(match.experienceId, 'title', val)}
                                                onInsert={() => {
                                                    setActiveMatchIndices(prev => ({...prev, [reqIndex]: matchIdx}));
                                                }}
                                                style={{
                                                    border: "none",
                                                    background: "transparent",
                                                    color: "inherit",
                                                    paddingRight: 0, 
                                                    fontWeight: "inherit",
                                                    fontSize: "0.9rem",
                                                    minWidth: "60px"
                                                }}
                                            />
                                            
                                            {isTemp && (
                                                <span 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSaveTempExperience(match.experienceId);
                                                    }}
                                                    style={{ 
                                                        padding: "0 4px", 
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        color: "var(--success)", 
                                                        fontSize: "0.8rem"
                                                    }}
                                                    title="Save Experience to Database"
                                                >
                                                    💾
                                                </span>
                                            )}

                                            <span 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveMatch(match, currentReq.matches.indexOf(match));
                                                }}
                                                style={{ 
                                                    padding: "0 4px", 
                                                    cursor: "pointer",
                                                    marginLeft: "4px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    fontSize: "1.1rem",
                                                    lineHeight: 1
                                                }}
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
                                          acc.push({
                                              reqDesc: r.description,
                                              explanation: match.matchExplanation
                                          });
                                      }
                                      return acc;
                                  }, []);

                                  const insertBtnStyle = { 
                                      padding: "4px 8px", 
                                      fontSize: "0.8rem", 
                                      flex: 1, 
                                      whiteSpace: "nowrap" as const, 
                                      overflow: "hidden", 
                                      textOverflow: "ellipsis",
                                      textAlign: "center" as const
                                  };

                                  return (
                                      <>
                                          <div style={{ marginBottom: "10px" }}>
                                              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                                  <div style={{ display: "flex", gap: "5px", width: "100%" }}>
                                                    <EditableInsertButton 
                                                        targetId={targetId}
                                                        value={fullExp?.position}
                                                        placeholder="Position"
                                                        style={insertBtnStyle}
                                                        onSave={(val) => updateExperience(matchData.experienceId, 'position', val)}
                                                    />
                                                    <EditableInsertButton 
                                                        targetId={targetId}
                                                        value={fullExp?.location}
                                                        placeholder="Location"
                                                        style={insertBtnStyle}
                                                        onSave={(val) => updateExperience(matchData.experienceId, 'location', val)}
                                                    />
                                                    <EditableInsertButton 
                                                        targetId={targetId}
                                                        value={fullExp?.duration}
                                                        placeholder="Duration"
                                                        style={insertBtnStyle}
                                                        onSave={(val) => updateExperience(matchData.experienceId, 'duration', val)}
                                                    />
                                                  </div>
                                                  
                                                  <div style={{ display: "flex", width: "100%" }}>
                                                      <EditableInsertButton 
                                                          targetId={targetId}
                                                          value={fullExp?.description}
                                                          placeholder="Description"
                                                          style={{...insertBtnStyle, textAlign: "left"}}
                                                          onSave={(val) => updateExperience(matchData.experienceId, 'description', val)}
                                                      />
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          <Field 
                                              id={targetId} 
                                              name={`requirements.${reqIndex}.matches.${validIndex}.matchExplanation`} 
                                              as="textarea" 
                                              rows={3} 
                                              placeholder={`How does "${getExpTitle(matchData.experienceId)}" meet this requirement?`}
                                              style={{ 
                                                  marginBottom: 0, 
                                                  borderBottomLeftRadius: 0, 
                                                  borderBottomRightRadius: 0,
                                                  resize: "vertical"
                                              }} 
                                          />

                                          {otherExplanations.length > 0 && (
                                              <select
                                                  style={{ 
                                                      width: "100%", 
                                                      borderTop: "none", 
                                                      borderTopLeftRadius: 0, 
                                                      borderTopRightRadius: 0,
                                                      background: "#f1f5f9",
                                                      fontSize: "0.8rem",
                                                      color: "var(--text-muted)",
                                                      marginBottom: "10px",
                                                      cursor: "pointer",
                                                      padding: "4px 8px",
                                                      height: "auto"
                                                  }}
                                                  value=""
                                                  onChange={(e) => {
                                                      if(e.target.value) {
                                                          insertTextAtCursor(targetId, e.target.value, { ctrlKey: true } as any);
                                                          e.target.value = ""; 
                                                      }
                                                  }}
                                              >
                                                  <option value="" disabled selected hidden>-- Copy from similar requirement --</option>
                                                  {otherExplanations.map((item: any, idx: number) => (
                                                      <option key={idx} value={item.explanation}>
                                                          {item.reqDesc.length > 60 ? item.reqDesc.substring(0,60)+"..." : item.reqDesc}
                                                          {" → "}
                                                          {item.explanation.length > 120 ? item.explanation.substring(0,120)+"..." : item.explanation}
                                                      </option>
                                                  ))}
                                              </select>
                                          )}
                                          
                                          <ExplanationList 
                                              targetId={targetId} 
                                              experienceId={matchData.experienceId} 
                                              experiences={experiences} 
                                              allSkills={skills} 
                                              relatedSkillIds={reqSkillIds} // UPDATED: Passed prop
                                              onSkillDemoUpdate={updateSkillDemonstration}
                                              onAddSkillDemo={handleAddSkillDemonstration} 
                                              onDeleteSkillDemo={handleDeleteSkillDemonstration}
                                              onGlobalSkillCreated={refreshSkills}
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
                 <button 
                   type="button" 
                   onClick={() => submitForm()} 
                   className="btn-primary" 
                   style={{ flex: 1 }}
                 >
                   Save Changes
                 </button>
                 <button 
                   type="button" 
                   onClick={() => handleReturn(dirty)} 
                   className="btn-secondary" 
                   style={{ flex: 1 }}
                 >
                   Return to Job
                 </button>
              </div>
            </Form>
           );
        }}
      </Formik>
    </div>
  );
};