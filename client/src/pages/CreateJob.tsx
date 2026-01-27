import { useEffect, useState } from "react";
import { Formik, Form, Field, FieldArray, useFormikContext } from "formik";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext"; 
import { SearchableDropdown, FormObserver } from "./JobFormComponents"; 
import { DataTable, type Column } from "../components/DataTable"; // FIXED: Type import
import type { Experience, JobTag } from "../types";

// --- HELPER: Restores Draft Data ---
const DraftRestorer = () => {
  const { setValues } = useFormikContext<any>();
  const location = useLocation();
  const state = location.state as any;

  useEffect(() => {
    if (state?.returnFromReq) {
      const draft = sessionStorage.getItem("job_form_draft");
      if (draft) {
        setValues(JSON.parse(draft));
        sessionStorage.removeItem("job_form_draft");
        window.history.replaceState({}, document.title);
      }
    }
  }, [state, setValues]);

  return null;
};

// --- MAIN PAGE ---
export const CreateJob = () => {
  const [view, setView] = useState<"list" | "form">("list");
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobTags, setJobTags] = useState<JobTag[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);

  const location = useLocation();
  const state = location.state as any; 
  const { setIsDirty } = useFormState();
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [jobRes, tagRes, expRes] = await Promise.all([
        api.get("/jobs"),
        api.get("/lists/jobtags"),
        api.get("/experiences")
      ]);
      setJobs(jobRes.data);
      setJobTags(tagRes.data);
      setExperiences(expRes.data);
    } catch (err) { console.error(err); }
  };
  useEffect(() => { fetchData(); }, []);
  
  // --- NAV RESET LOGIC ---
  useEffect(() => {
    if (state?.resetView) {
      navigate(location.pathname, { replace: true, state: {} });
      if (view === "form") {
         setIsDirty(false);
         setEditingItem(null);
         setView("list");
      }
    }
  }, [state, view, setIsDirty, navigate, location.pathname]);

  useEffect(() => {
    if (state?.returnFromReq) {
      setView("form");
    }
  }, [state]);

  const handleDelete = async (ids: number[]) => {
    try {
        await Promise.all(ids.map(id => api.delete(`/jobs/${id}`)));
        fetchData();
    } catch(e: any) { alert("Error deleting: " + e.message); }
  };

  const handleEdit = (item: any) => {
    const formattedItem = {
      ...item,
      jobTagIds: item.JobTags ? item.JobTags.map((t: any) => t.id) : [],
      requirements: item.Requirements ? item.Requirements.map((r: any) => ({
            description: r.description,
            skillIds: r.Skills ? r.Skills.map((s: any) => s.id) : [],
            matches: r.MatchedExperiences ? r.MatchedExperiences.map((e: any) => ({
                experienceId: e.id,
                matchExplanation: e.RequirementMatch?.matchExplanation || ""
            })) : []
          })) : []
    };
    setEditingItem(formattedItem);
    setView("form");
  };

  const onSubmit = async (values: any) => {
    try {
        if (editingItem && editingItem.id) await api.put(`/jobs/${editingItem.id}`, values);
        else await api.post("/jobs", values);
        setIsDirty(false); 
        setView("list"); fetchData();
    } catch(e: any) { alert("Error: " + e.message); }
  };

  const initialValues = editingItem || { title: "", company: "", description: "", jobTagIds: [], requirements: [] };
  const refreshTags = (newItem: JobTag) => setJobTags(prev => [...prev, newItem]);
  const getExpTitle = (id: string | number) => experiences.find(e => e.id.toString() === id?.toString())?.title || "-";

  const handleEditRequirement = (index: number, currentValues: any) => {
    sessionStorage.setItem("job_form_draft", JSON.stringify(currentValues));
    setIsDirty(false);
    navigate("/edit-requirement", { state: { reqIndex: index } });
  };

  // --- COLUMNS DEFINITION ---
  const jobColumns: Column<any>[] = [
      { key: "title", header: "Job Title", render: (j) => <strong>{j.title}</strong> },
      { key: "company", header: "Company" }
  ];

  if (view === "list") {
    return (
      <div className="page-container">
        <DataTable 
            title="Your Jobs"
            data={jobs}
            columns={jobColumns}
            onRowClick={handleEdit}
            onDelete={handleDelete}
            onAdd={() => { setEditingItem(null); setView("form"); }}
            addButtonLabel="+ Create Job"
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <button onClick={() => setView("list")} className="btn-ghost" style={{ marginBottom: "1rem", paddingLeft: 0 }}>&larr; Back to Jobs</button>
      <div className="card">
        <h2 style={{marginTop: 0}}>{editingItem ? "Edit Job" : "Create New Job"}</h2>
        <Formik initialValues={initialValues} enableReinitialize onSubmit={onSubmit}>
          {({ values }) => (
            <Form>
              <FormObserver />
              <DraftRestorer />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                    <label>Job Title <span style={{color:'var(--danger)'}}>*</span></label>
                    {/* Added autoFocus here */}
                    <Field name="title" required autoFocus />
                </div>
                <div><label>Company</label><Field name="company" placeholder="e.g. Acme Corp" /></div>
              </div>
              <SearchableDropdown label="Job Tags" name="jobTagIds" options={jobTags} multiple={true} createEndpoint="/lists/jobtags" onOptionCreated={refreshTags} />
              <label>Description</label>
              <Field name="description" as="textarea" rows={3} placeholder="Paste the full job description here..." />

              <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>Requirements</h3>
              <FieldArray name="requirements">
                {({ remove }) => (
                  <div style={{ marginBottom: "20px" }}>
                    {values.requirements.length > 0 ? (
                      <table className="data-table" style={{ border: "1px solid #e2e8f0" }}>
                        <thead><tr><th style={{width: "40%"}}>Description</th><th style={{width: "50%"}}>Matches</th><th style={{width: "10%"}}></th></tr></thead>
                        <tbody>
                          {values.requirements.map((req: any, index: number) => (
                            <tr key={index} onClick={() => handleEditRequirement(index, values)} style={{ cursor: "pointer" }} title="Click to edit details">
                              <td>{req.description.length > 50 ? req.description.substring(0, 50) + "..." : req.description}</td>
                              <td>
                                  {req.matches && req.matches.length > 0 ? (
                                      <div style={{display: "flex", gap: "5px", flexWrap: "wrap"}}>
                                          {req.matches.map((m: any) => (
                                              <span key={m.experienceId} style={{background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem"}}>
                                                  {getExpTitle(m.experienceId)}
                                              </span>
                                          ))}
                                      </div>
                                  ) : <span style={{color: "var(--text-muted)"}}>-</span>}
                              </td>
                              <td style={{textAlign: "center"}}>
                                <button type="button" onClick={(e) => { e.stopPropagation(); remove(index); }} className="btn-ghost" style={{color: "var(--danger)"}}>×</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (<div style={{ padding: "30px", textAlign: "center", border: "2px dashed #e2e8f0", borderRadius: "8px", color: "var(--text-muted)", marginBottom: "15px" }}>No requirements extracted yet.</div>)}
                    
                    <button type="button" onClick={() => { 
                        const newReq = { description: "New Requirement", skillIds: [], matches: [] };
                        const newValues = { ...values, requirements: [...values.requirements, newReq] };
                        handleEditRequirement(newValues.requirements.length - 1, newValues); 
                    }} className="btn-secondary" style={{width: "100%"}}>+ Add Requirement</button>
                  </div>
                )}
              </FieldArray>
              <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #e2e8f0" }}>
                <button type="submit" className="btn-primary" style={{ width: "100%", padding: "1rem", fontSize: "1rem" }}>{editingItem && editingItem.id ? "Save Changes" : "Create Job"}</button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};