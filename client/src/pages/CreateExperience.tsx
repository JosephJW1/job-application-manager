import { useEffect, useState } from "react";
import { Formik, Form } from "formik";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext";
import { FormObserver } from "./JobFormComponents";
import { DataTable, type Column } from "../components/DataTable"; 
import { ExperienceEditor } from "../components/ExperienceEditor"; 

// --- HELPERS ---
const formatExpForForm = (item: any) => ({
    id: item.id, // Ensure ID is passed explicitly
    title: item.title || "",
    position: item.position || "",
    location: item.location || "",
    duration: item.duration || "",
    description: item.description || "",
    SkillDemonstrations: item.SkillDemonstrations || []
});

const isExpClean = (values: any, original: any) => {
    // Basic field comparison
    if ((values.title || "") !== (original.title || "")) return false;
    if ((values.position || "") !== (original.position || "")) return false;
    if ((values.location || "") !== (original.location || "")) return false;
    if ((values.duration || "") !== (original.duration || "")) return false;
    if ((values.description || "") !== (original.description || "")) return false;

    // Normalize and compare Skill Demonstrations
    const normalizeDemos = (demos: any[]) => {
        return demos.map(d => ({
            skillId: d.SkillId || d.Skill?.id,
            explanation: d.explanation || d.ExpSkillDemo?.explanation || ""
        })).sort((a: any, b: any) => (a.skillId || 0) - (b.skillId || 0));
    };

    const valDemos = normalizeDemos(values.SkillDemonstrations || []);
    const origDemos = normalizeDemos(original.SkillDemonstrations || []);

    return JSON.stringify(valDemos) === JSON.stringify(origDemos);
};

export const CreateExperience = () => {
  const [view, setView] = useState<"list" | "form">("list");
  const [experiences, setExperiences] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { setIsDirty } = useFormState();

  const fetchData = async () => {
    try {
      const expRes = await api.get("/experiences");
      const skillRes = await api.get("/lists/skills");
      setExperiences(expRes.data);
      setAvailableSkills(skillRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  const updateSkill = async (id: number, newTitle: string) => {
    try {
      await api.put(`/lists/skills/${id}`, { title: newTitle });
      // Optimistic update
      setAvailableSkills(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    } catch (e: any) { alert("Error renaming skill: " + e.message); }
  };

  const deleteGlobalSkill = async (id: number) => {
    if (!window.confirm("Warning: You are about to delete this skill globally.")) return;
    try {
        await api.delete(`/lists/skills/${id}`);
        fetchData();
    } catch (e: any) { alert("Error deleting skill: " + e.message); }
  };

  const handleSkillCreated = (newSkill: any) => {
     setAvailableSkills(prev => [...prev, newSkill]);
  };

  useEffect(() => {
    if (location.state?.resetView) {
      navigate(location.pathname, { replace: true, state: {} });
      if (view === "form") {
         setIsDirty(false);
         setEditingItem(null);
         setView("list");
      }
    }
  }, [location.state, view, setIsDirty, navigate, location.pathname]);

  useEffect(() => {
    if (location.state?.returnPath || location.state?.initialTitle) {
      setView("form");
      if (location.state?.initialTitle) {
        setEditingItem({ 
          title: location.state.initialTitle, 
          description: "", 
          location: "",
          position: "",
          duration: "",
          SkillDemonstrations: [] 
        });
      }
    }
    
    if (location.state?.newId && location.state?.targetField === "experience_edit_mode") {
        const itemToEdit = experiences.find(e => e.id === location.state.newId);
        if (itemToEdit) handleEdit(itemToEdit);
    } 
    else if (location.state?.newId && location.state?.targetField) {
      const draft = sessionStorage.getItem("exp_form_draft");
      if (draft) {
        setEditingItem(JSON.parse(draft));
        setView("form");
        sessionStorage.removeItem("exp_form_draft");
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, experiences]);

  const handleSave = async (values: any, _helpers: any, shouldExit: boolean) => {
    try {
      const payload = {
          ...values,
          skillDemonstrations: (values.SkillDemonstrations || []).map((d: any) => ({
              skillId: d.Skill ? d.Skill.id : (d.SkillId || d.skillId),
              explanation: d.explanation || d.ExpSkillDemo?.explanation || ""
          }))
      };

      let res;
      // FIX: Use values.id as the primary check for update vs create
      if (values.id) {
         await api.put(`/experiences/${values.id}`, payload);
         // Ensure we return the full object with ID for state updates
         res = { data: { ...values } }; 
      } else { 
         res = await api.post("/experiences", payload); 
      }

      setIsDirty(false);
      alert("Experience Saved!");

      if (shouldExit) {
          if (location.state?.returnPath) {
            navigate(location.state.returnPath, { 
              state: { 
                newId: res.data.id, 
                targetField: location.state.targetField, 
                isMulti: location.state.isMulti 
              } 
            });
          } else {
            setView("list");
            fetchData();
          }
      } else {
          // Stay on page: Update editingItem to ensure subsequent saves are updates
          setEditingItem(formatExpForForm(res.data));
          fetchData(); // Refresh background list
      }
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const handleDelete = async (ids: number[]) => {
    try {
        await Promise.all(ids.map(id => api.delete(`/experiences/${id}`)));
        fetchData();
    } catch(e: any) { alert("Error deleting: " + e.message); }
  };

  const handleCreate = () => { 
      setEditingItem({ title: "", description: "", location: "", position: "", duration: "", SkillDemonstrations: [] }); 
      setView("form"); 
  };
  
  const handleEdit = (item: any) => {
    setEditingItem(formatExpForForm(item));
    setView("form");
  };
  
  const initialValues = editingItem || { title: "", description: "", location: "", position: "", duration: "", SkillDemonstrations: [] };

  const expColumns: Column<any>[] = [
      { key: "title", header: "Title", render: (exp) => <strong>{exp.title}</strong> },
      { key: "position", header: "Position", render: (exp) => exp.position || "-" },
      { key: "location", header: "Location", render: (exp) => exp.location || "-" }
  ];

  if (view === "list") {
      return (
          <div className="page-container">
             <DataTable 
                title="Experiences"
                data={experiences}
                columns={expColumns}
                onRowClick={handleEdit}
                onDelete={handleDelete}
                onAdd={handleCreate}
                addButtonLabel="+ Create Experience"
             />
          </div>
      );
  }

  return (
    <div className="page-container">
      
      {location.state?.returnPath && <div className="card" style={{background: "var(--bg-selected)", border: "1px solid var(--border-color)", marginBottom: "20px", padding: "15px"}}><strong>Adding New Experience</strong><br/><small>Fill this out to select it for your Job Requirement.</small></div>}
      
      <Formik initialValues={initialValues} enableReinitialize onSubmit={(values, helpers) => handleSave(values, helpers, false)}>
          {({ values, setFieldValue }) => {

            const getIsClean = () => {
                const dbExp = values.id ? experiences.find(e => e.id === values.id) : null;
                const original = dbExp 
                    ? formatExpForForm(dbExp) 
                    : { title: "", description: "", location: "", position: "", duration: "", SkillDemonstrations: [] };
                return isExpClean(values, original);
            };

            const handleExit = () => {
                if (!getIsClean() && !window.confirm("You have unsaved changes. Exit without saving?")) return;
                
                setIsDirty(false);
                if (location.state?.returnPath) {
                    navigate(location.state.returnPath, { state: { reqIndex: location.state.reqIndex } });
                } else {
                    setView("list");
                }
            };

            // Determine Label: "Save Changes" (Edit) vs "Create & Select" (Req Flow) vs "Create Experience" (Standalone)
            const isEditing = !!values.id;
            const submitLabel = isEditing 
                ? "Save Changes" 
                : (location.state?.returnPath ? "Create & Select" : "Create Experience");

            return (
                <>
                    {/* TOP NAVIGATION */}
                    <div style={{ display: "flex", justifyContent: "flex-start", gap: "10px", marginBottom: "1rem" }}>
                        <button type="button" onClick={handleExit} className="btn-ghost" style={{ paddingLeft: 0 }}>&larr; Exit Experience</button>
                        <button type="button" onClick={() => handleSave(values, { resetForm: () => {} }, true)} className="btn-ghost" style={{ border: "1px solid var(--border-color)", padding: "4px 12px" }}>Save + Exit Experience</button>
                    </div>

                    <div className="card">
                        <Form>
                        <FormObserver />
                        
                        <ExperienceEditor 
                            mode="standalone"
                            experience={values}
                            experiences={experiences} 
                            skills={availableSkills}
                            onUpdate={async (field, val) => { await setFieldValue(field, val); }}
                            onTitleEnter={() => {
                                // Smart Enter Logic
                                if (values.title && values.title.trim()) {
                                    const dbExp = values.id ? experiences.find(e => e.id === values.id) : null;
                                    const original = dbExp 
                                        ? formatExpForForm(dbExp) 
                                        : { title: "", description: "", location: "", position: "", duration: "", SkillDemonstrations: [] };
                                    
                                    const valuesWithOriginalTitle = { ...values, title: original.title };
                                    
                                    // Save if only title changed (or if clean)
                                    if (isExpClean(valuesWithOriginalTitle, original)) {
                                        handleSave(values, { resetForm: () => {} }, true);
                                    }
                                }
                            }}
                            handlers={{
                                onSkillDemoUpdate: (_expId, skillId, explanation) => {
                                    const demos = [...(values.SkillDemonstrations || [])];
                                    const idx = demos.findIndex(d => (d.SkillId || d.Skill?.id) === skillId);
                                    if (idx >= 0) {
                                        demos[idx] = { ...demos[idx], explanation, ExpSkillDemo: { explanation } };
                                        setFieldValue("SkillDemonstrations", demos);
                                    }
                                },
                                onAddSkillDemo: (_expId, skillId, explanation) => {
                                    const skillObj = availableSkills.find(s => s.id === skillId);
                                    if (!skillObj) return Promise.resolve(); 
                                    const newDemo = { 
                                        id: -Date.now(), 
                                        SkillId: skillId, 
                                        Skill: skillObj, 
                                        explanation,
                                        ExpSkillDemo: { explanation }
                                    };
                                    setFieldValue("SkillDemonstrations", [...(values.SkillDemonstrations || []), newDemo]);
                                    return Promise.resolve(false);
                                },
                                onDeleteSkillDemo: (_expId, skillId, demoId) => {
                                    if (demoId !== undefined && demoId !== null) {
                                        const demos = (values.SkillDemonstrations || []).filter((d: any) => d.id !== demoId);
                                        setFieldValue("SkillDemonstrations", demos);
                                        return;
                                    }
                                    if (!skillId) return; 
                                    const demos = (values.SkillDemonstrations || []).filter((d: any) => (d.SkillId || d.Skill?.id) !== skillId);
                                    setFieldValue("SkillDemonstrations", demos);
                                },
                                onGlobalSkillCreated: handleSkillCreated,
                                onGlobalSkillRename: async (id, newTitle) => {
                                    await updateSkill(id, newTitle);
                                    const currentDemos = values.SkillDemonstrations || [];
                                    const updatedDemos = currentDemos.map((d: any) => {
                                        if ((d.SkillId || d.Skill?.id) === id) {
                                            return { ...d, Skill: { ...(d.Skill || {}), id, title: newTitle } };
                                        }
                                        return d;
                                    });
                                    setFieldValue("SkillDemonstrations", updatedDemos);
                                },
                                onGlobalSkillDelete: deleteGlobalSkill,
                                onSkillChange: (demoId, newSkillId, newSkillObj) => {
                                    const demos = [...(values.SkillDemonstrations || [])];
                                    const idx = demos.findIndex(d => d.id === demoId);
                                    if(idx >= 0) {
                                        const skillObj = newSkillObj || availableSkills.find(s => s.id === newSkillId);
                                        demos[idx] = { ...demos[idx], SkillId: newSkillId, Skill: skillObj };
                                        setFieldValue("SkillDemonstrations", demos);
                                    }
                                }
                            }}
                        />

                        <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: "10px" }}>
                            <button type="submit" className="btn-primary" style={{ flex: 1, padding: "1rem", fontSize: "1rem" }}>{submitLabel}</button>
                            <button type="button" onClick={handleExit} className="btn-secondary" style={{ flex: 1 }}>Return to Experiences</button>
                        </div>
                        </Form>
                    </div>
                </>
            );
          }}
      </Formik>
    </div>
  );
};