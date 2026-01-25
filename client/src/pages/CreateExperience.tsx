import { useEffect, useState } from "react";
import { Formik, Form, Field, FieldArray } from "formik";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext";
import { FormObserver } from "./JobFormComponents";

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
    
    if (location.state?.newId && location.state?.targetField) {
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
  }, [location.state]);

  const handleAddNewSkill = (index: number, currentValues: any) => {
    setIsDirty(false);
    sessionStorage.setItem("exp_form_draft", JSON.stringify(currentValues));
    navigate("/add-skill", { state: { returnPath: "/add-experience", targetField: `skillDemonstrations.${index}.skillId`, isMulti: false } });
  };

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

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure?")) return;
    await api.delete(`/experiences/${id}`);
    fetchData();
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

    const formattedItem = {
      ...item,
      skillDemonstrations: mappedDemos
    };
    setEditingItem(formattedItem);
    setView("form");
  };
  
  const initialValues = editingItem || { title: "", description: "", location: "", position: "", duration: "", skillDemonstrations: [] };

  const handleBack = () => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath);
    } else {
      setView("list");
    }
  };

  if (view === "list") return (
      <div className="page-container">
         <div className="card-header">
           <h2>Experiences</h2>
           <button onClick={handleCreate} className="btn-primary">+ Create Experience</button>
         </div>
         <table className="data-table">
            <thead><tr><th>Title</th><th>Position</th><th>Description</th><th style={{textAlign:"right"}}>Actions</th></tr></thead>
            <tbody>
              {experiences.map(exp => (
                <tr key={exp.id} onClick={() => handleEdit(exp)} style={{ cursor: "pointer" }}>
                  <td><strong>{exp.title}</strong></td>
                  <td>{exp.position || "-"}</td>
                  <td>{exp.description.length > 60 ? exp.description.substring(0, 60) + "..." : exp.description}</td>
                  <td style={{textAlign:"right"}}>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(exp.id); }} className="btn-ghost" style={{color: "var(--danger)"}}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>
  );

  return (
    <div className="page-container">
      <button onClick={handleBack} className="btn-ghost" style={{ marginBottom: "1rem", paddingLeft: 0 }}>&larr; {location.state?.returnPath ? "Cancel & Return" : "Back"}</button>
      
      {location.state?.returnPath && <div className="card" style={{background: "#eff6ff", border: "1px solid #bfdbfe", marginBottom: "20px", padding: "15px"}}><strong>Adding New Experience</strong><br/><small>Fill this out to select it for your Job Requirement.</small></div>}
      
      <div className="card">
        <h2 style={{marginTop: 0}}>{editingItem ? "Edit Experience" : "Add Experience"}</h2>
        <Formik initialValues={initialValues} enableReinitialize onSubmit={onSubmit}>
          {({ values, handleChange }) => (
            <Form>
              <FormObserver />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "10px" }}>
                  <div>
                    <label>Title / Project <span style={{color:'var(--danger)'}}>*</span></label>
                    <Field name="title" required placeholder="e.g. Project Alpha" />
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
                      // Check for orphan state: No skill ID, but has explanation
                      const isOrphan = !item.skillId && item.explanation;
                      
                      return (
                        <div 
                          key={index} 
                          style={{ 
                            display: "grid", 
                            gridTemplateColumns: "1fr 2fr auto", 
                            gap: "10px", 
                            alignItems: "start", 
                            marginBottom: "10px", 
                            borderBottom: "1px solid #f1f5f9", 
                            paddingBottom: "10px",
                            // More noticeable warning style
                            background: isOrphan ? "#fff5f5" : "transparent",
                            border: isOrphan ? "2px solid #fc8181" : "none",
                            padding: isOrphan ? "10px" : "0 0 10px 0",
                            borderRadius: isOrphan ? "6px" : "0"
                          }}
                        >
                          {isOrphan && (
                            <div style={{ gridColumn: "1 / -1", color: "#e53e3e", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "5px" }}>
                              ⚠ This skill was deleted. Please select a replacement to save this explanation.
                            </div>
                          )}

                          <select 
                            name={`skillDemonstrations.${index}.skillId`} 
                            value={values.skillDemonstrations[index].skillId} 
                            onChange={(e) => { if (e.target.value === "ADD_NEW") handleAddNewSkill(index, values); else handleChange(e); }}
                            style={{ 
                              borderColor: isOrphan ? "#fc8181" : "#ccc",
                            }}
                          >
                            <option value="">{isOrphan ? "Select Replacement..." : "Select Skill..."}</option>
                            <option value="ADD_NEW" style={{fontWeight:'bold', color:'var(--primary)'}}>+ Add New</option>
                            {availableSkills.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                          </select>
                          
                          <Field 
                            name={`skillDemonstrations.${index}.explanation`} 
                            placeholder="How did you use this skill?" 
                            as="textarea" 
                            rows={1}
                            style={{ 
                                borderColor: isOrphan ? "#fc8181" : "#ccc"
                            }}
                          />
                          
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