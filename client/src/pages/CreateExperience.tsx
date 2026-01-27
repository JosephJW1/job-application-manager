import { useEffect, useState } from "react";
import { Formik, Form, Field, FieldArray } from "formik";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext";
import { FormObserver, SearchableDropdown } from "./JobFormComponents";
import { DataTable, type Column } from "../components/DataTable"; // FIXED: Type import

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

  // --- ACTIONS FOR SKILL DROPDOWN ---
  const updateSkill = async (id: number, newTitle: string) => {
    try {
      await api.put(`/lists/skills/${id}`, { title: newTitle });
      fetchData(); 
    } catch (e: any) { alert("Error renaming skill: " + e.message); }
  };

  const deleteGlobalSkill = async (id: number) => {
    if (!window.confirm("Warning: You are about to delete this skill globally (from all experiences and requirements).\n\nAre you sure?")) return;
    try {
        await api.delete(`/lists/skills/${id}`);
        fetchData();
    } catch (e: any) { alert("Error deleting skill: " + (e.response?.data?.error || e.message)); }
  };

  const handleSkillCreated = (newSkill: any) => {
     setAvailableSkills(prev => [...prev, newSkill]);
  };

  // --- NAV RESET LOGIC ---
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

  // --- DETECT SUB-FORM MODE ---
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
          skillDemonstrations: [] 
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
        const parsedDraft = JSON.parse(draft);
        const { targetField, newId } = location.state;
        if (targetField.includes("skillId")) {
           const parts = targetField.split('.');
           const index = parseInt(parts[1]);
           if (parsedDraft.skillDemonstrations[index]) parsedDraft.skillDemonstrations[index].skillId = newId;
        }
        setEditingItem(parsedDraft);
        setView("form");
        sessionStorage.removeItem("exp_form_draft");
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, experiences]);

  const onSubmit = async (values: any) => {
    try {
      let res;
      if (editingItem && editingItem.id) {
         await api.put(`/experiences/${editingItem.id}`, values);
         res = { data: editingItem };
      } else { res = await api.post("/experiences", values); }

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

  const handleCreate = () => { setEditingItem(null); setView("form"); };
  
  const handleEdit = (item: any) => {
    let mappedDemos = [];
    if (item.SkillDemonstrations) {
      mappedDemos = item.SkillDemonstrations.map((demo: any) => ({
        skillId: demo.SkillId || "", 
        explanation: demo.explanation || ""
      }));
    }

    const formattedItem = { ...item, skillDemonstrations: mappedDemos };
    setEditingItem(formattedItem);
    setView("form");
  };
  
  const initialValues = editingItem || { title: "", description: "", location: "", position: "", duration: "", skillDemonstrations: [] };

  const handleBack = () => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath, { state: { reqIndex: location.state.reqIndex } });
    } else {
      setView("list");
    }
  };

  // --- COLUMNS ---
  const expColumns: Column<any>[] = [
      { key: "title", header: "Title", render: (exp) => <strong>{exp.title}</strong> },
      { key: "position", header: "Position", render: (exp) => exp.position || "-" },
      // UPDATED: Changed from Description to Location
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
      
      {location.state?.returnPath && <div className="card" style={{background: "#eff6ff", border: "1px solid #bfdbfe", marginBottom: "20px", padding: "15px"}}><strong>Adding New Experience</strong><br/><small>Fill this out to select it for your Job Requirement.</small></div>}
      
      <div className="card">
        <h2 style={{marginTop: 0}}>{editingItem ? "Edit Experience" : "Add Experience"}</h2>
        <Formik initialValues={initialValues} enableReinitialize onSubmit={onSubmit}>
          {({ values }) => (
            <Form>
              <FormObserver />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "10px" }}>
                  <div>
                    <label>Title / Project <span style={{color:'var(--danger)'}}>*</span></label>
                    <Field name="title" required placeholder="e.g. Project Alpha" autoFocus />
                  </div>
                  <div>
                    <label>Position / Role</label>
                    <Field name="position" placeholder="e.g. Lead Developer" />
                  </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "10px" }}>
                  <div>
                    <label>Location</label>
                    <Field name="location" placeholder="e.g. New York, NY" />
                  </div>
                  <div>
                    <label>Duration</label>
                    <Field name="duration" placeholder="e.g. Jan 2020 - Dec 2021" />
                  </div>
              </div>

              <label>Description</label>
              <Field name="description" as="textarea" rows={4} placeholder="What did you do?" />

              <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>Skills Used</h3>
              <FieldArray name="skillDemonstrations">
                {({ push, remove }) => (
                  <div>
                    {values.skillDemonstrations.map((item: any, index: number) => {
                      const isOrphan = !item.skillId && item.explanation;
                      return (
                        <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "10px", alignItems: "start", marginBottom: "10px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", background: isOrphan ? "#fff5f5" : "transparent", border: isOrphan ? "2px solid #fc8181" : "none", padding: isOrphan ? "10px" : "0 0 10px 0", borderRadius: isOrphan ? "6px" : "0" }}>
                          {isOrphan && <div style={{ gridColumn: "1 / -1", color: "#e53e3e", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "5px" }}>⚠ This skill was deleted. Please select a replacement to save this explanation.</div>}
                          <div style={{ position: "relative" }}>
                            <SearchableDropdown name={`skillDemonstrations.${index}.skillId`} placeholder={isOrphan ? "Select Replacement..." : "Select Skill..."} options={availableSkills} createEndpoint="/lists/skills" onOptionCreated={handleSkillCreated} onRename={updateSkill} onDeleteOption={deleteGlobalSkill} />
                          </div>
                          <Field name={`skillDemonstrations.${index}.explanation`} placeholder="How did you use this skill?" as="textarea" rows={1} style={{ borderColor: isOrphan ? "#fc8181" : "#ccc", height: "38px" }} />
                          <button type="button" onClick={() => remove(index)} className="btn-ghost" style={{color: "var(--danger)", padding: "5px", marginTop: "5px"}}>×</button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={() => push({ skillId: "", explanation: "" })} className="btn-secondary" style={{width: "100%", marginTop: "10px"}}>+ Add Skill Link</button>
                  </div>
                )}
              </FieldArray>
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