import { useEffect, useState } from "react";
import { Formik, Form } from "formik";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext";
import { FormObserver } from "./JobFormComponents";
import { DataTable, type Column } from "../components/DataTable"; 
import { ExperienceEditor } from "../components/ExperienceEditor"; 

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
      fetchData(); 
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

  const onSubmit = async (values: any) => {
    try {
      const payload = {
          ...values,
          skillDemonstrations: (values.SkillDemonstrations || []).map((d: any) => ({
              skillId: d.Skill ? d.Skill.id : (d.SkillId || d.skillId),
              explanation: d.explanation || d.ExpSkillDemo?.explanation || ""
          }))
      };

      let res;
      if (editingItem && editingItem.id) {
         await api.put(`/experiences/${editingItem.id}`, payload);
         res = { data: editingItem };
      } else { 
         res = await api.post("/experiences", payload); 
      }

      setIsDirty(false);

      if (location.state?.returnPath) {
        navigate(location.state.returnPath, { 
          state: { 
            newId: res.data.id, 
            targetField: location.state.targetField, 
            isMulti: location.state.isMulti 
          } 
        });
        return;
      }
      alert("Saved!");
      setView("list");
      fetchData();
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
    let demos = item.SkillDemonstrations || item.skillDemonstrations || [];
    setEditingItem({ ...item, SkillDemonstrations: demos });
    setView("form");
  };
  
  const initialValues = editingItem || { title: "", description: "", location: "", position: "", duration: "", SkillDemonstrations: [] };

  const handleBack = () => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath, { state: { reqIndex: location.state.reqIndex } });
    } else {
      setView("list");
    }
  };

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
      <button onClick={handleBack} className="btn-ghost" style={{ marginBottom: "1rem", paddingLeft: 0 }}>&larr; {location.state?.returnPath ? "Cancel & Return" : "Back"}</button>
      
      {location.state?.returnPath && <div className="card" style={{background: "var(--bg-selected)", border: "1px solid var(--border-color)", marginBottom: "20px", padding: "15px"}}><strong>Adding New Experience</strong><br/><small>Fill this out to select it for your Job Requirement.</small></div>}
      
      <div className="card">
        <Formik initialValues={initialValues} enableReinitialize onSubmit={onSubmit}>
          {({ values, setFieldValue }) => (
            <Form>
              <FormObserver />
              
              <ExperienceEditor 
                mode="standalone"
                experience={values}
                experiences={experiences} 
                skills={availableSkills}
                // Wrap to ignore Formik Errors return type and ensure void Promise
                onUpdate={async (field, val) => { await setFieldValue(field, val); }}
                handlers={{
                    // Use _ prefix to ignore unused expId arg
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
                        if (!skillObj) return Promise.resolve(); // Must return Promise, not undefined
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
                    onDeleteSkillDemo: (_expId, skillId) => {
                        if (!skillId) return; 
                        const demos = (values.SkillDemonstrations || []).filter((d: any) => (d.SkillId || d.Skill?.id) !== skillId);
                        setFieldValue("SkillDemonstrations", demos);
                    },
                    onGlobalSkillCreated: handleSkillCreated,
                    onGlobalSkillRename: updateSkill,
                    onGlobalSkillDelete: deleteGlobalSkill,
                    onSkillChange: (demoId, newSkillId) => {
                        const demos = [...(values.SkillDemonstrations || [])];
                        const idx = demos.findIndex(d => d.id === demoId);
                        if(idx >= 0) {
                             const skillObj = availableSkills.find(s => s.id === newSkillId);
                             demos[idx] = { ...demos[idx], SkillId: newSkillId, Skill: skillObj };
                             setFieldValue("SkillDemonstrations", demos);
                        }
                    }
                }}
              />

              <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #e2e8f0" }}>
                <button type="submit" className="btn-primary" style={{ width: "100%", padding: "1rem", fontSize: "1rem" }}>{editingItem && editingItem.id ? "Save Changes" : "Create & Select"}</button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};