import { useEffect, useState } from "react";
import { Formik, Form, Field, FieldArray } from "formik";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext"; 
import { SearchableDropdown, FormObserver } from "./JobFormComponents"; 
import { DataTable, type Column } from "../components/DataTable"; 
import type { Experience, JobTag } from "../types";

// --- HELPERS ---

// formats a raw DB job item into the shape used by the Form
const formatJobForForm = (item: any) => ({
  ...item,
  jobTagIds: item.JobTags ? item.JobTags.map((t: any) => t.id) : [],
  requirements: item.Requirements ? item.Requirements.map((r: any) => ({
        id: r.id, 
        description: r.description,
        skillIds: r.Skills ? r.Skills.map((s: any) => s.id) : [],
        matches: r.MatchedExperiences ? r.MatchedExperiences.map((e: any) => ({
            experienceId: e.id,
            matchExplanation: e.RequirementMatch?.matchExplanation || ""
        })) : []
      })) : []
});

// Deep comparison between Current Form Values and Original DB Data
const isJobClean = (values: any, original: any) => {
    // 1. Compare Basic Fields
    if ((values.title || "") !== (original.title || "")) return false;
    if ((values.company || "") !== (original.company || "")) return false;
    if ((values.description || "") !== (original.description || "")) return false;

    // 2. Compare Tags (Sort IDs to ignore order)
    const valTags = (values.jobTagIds || []).slice().sort((a: number, b: number) => a - b);
    const origTags = (original.jobTagIds || []).slice().sort((a: number, b: number) => a - b);
    if (JSON.stringify(valTags) !== JSON.stringify(origTags)) return false;

    // 3. Compare Requirements (Normalize structure & sort nested arrays)
    const normalizeReqs = (reqs: any[]) => {
        return reqs.map(r => ({
            description: r.description,
            // Sort Skills
            skillIds: (r.skillIds || []).slice().sort((a: number, b: number) => a - b),
            // Sort Matches by Experience ID
            matches: (r.matches || []).map((m: any) => ({
                experienceId: m.experienceId,
                matchExplanation: m.matchExplanation
            })).sort((a: any, b: any) => a.experienceId - b.experienceId)
        })).sort((a: any, b: any) => (a.description || "").localeCompare(b.description || ""));
    };

    const valReqs = normalizeReqs(values.requirements || []);
    const origReqs = normalizeReqs(original.requirements || []);

    return JSON.stringify(valReqs) === JSON.stringify(origReqs);
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

  // --- RESTORE DRAFT LOGIC ---
  useEffect(() => {
    if (state?.returnFromReq) {
      const draft = sessionStorage.getItem("job_form_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        setEditingItem(parsed);
        
        sessionStorage.removeItem("job_form_draft");
        window.history.replaceState({}, document.title);
      }
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
    setEditingItem(formatJobForForm(item));
    setView("form");
  };

  const onSubmit = async (values: any) => {
    try {
        if (editingItem && editingItem.id) await api.put(`/jobs/${editingItem.id}`, values);
        else await api.post("/jobs", values);
        setIsDirty(false); 
        alert("Job Saved!");
        setView("list"); fetchData();
    } catch(e: any) { alert("Error: " + e.message); }
  };

  const initialValues = editingItem || { title: "", company: "", description: "", jobTagIds: [], requirements: [] };
  
  const refreshTags = (newItem: JobTag) => setJobTags(prev => [...prev, newItem]);
  
  const updateTag = async (id: number, newTitle: string) => {
    try {
      await api.put(`/lists/jobtags/${id}`, { title: newTitle });
      fetchData(); 
    } catch (e: any) { alert("Error renaming tag: " + e.message); }
  };

  const deleteTag = async (id: number) => {
    if (!window.confirm("Warning: You are about to delete this tag globally.")) return;
    try {
        await api.delete(`/lists/jobtags/${id}`);
        fetchData();
    } catch (e: any) { alert("Error deleting tag: " + e.message); }
  };

  const getExpTitle = (id: string | number) => experiences.find(e => e.id.toString() === id?.toString())?.title || "-";

  const handleEditRequirement = (index: number, currentValues: any, isDirty: boolean) => {
    sessionStorage.setItem("job_form_draft", JSON.stringify(currentValues));
    setIsDirty(false);
    navigate("/edit-requirement", { state: { reqIndex: index, parentDirty: isDirty } });
  };

  // --- COLUMNS DEFINITION ---
  const jobColumns: Column<any>[] = [
      { key: "title", header: "Job Title", render: (j) => <strong>{j.title}</strong> },
      { key: "company", header: "Company" },
      { 
          key: "JobTags", 
          header: "Job Tags", 
          width: "30%",
          render: (job) => (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {job.JobTags && job.JobTags.map((t: any) => (
                      <span key={t.id} style={{ 
                          background: 'var(--bg-selected)', 
                          color: 'var(--text-main)',
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          border: '1px solid var(--border-color)' 
                      }}>
                          {t.title}
                      </span>
                  ))}
              </div>
          ),
          renderFilter: (value, onChange) => (
              // Wrap in Dummy Formik to satisfy SearchableDropdown's internal useFormikContext
              <Formik initialValues={{}} onSubmit={() => {}}>
                  <SearchableDropdown
                      options={jobTags}
                      multiple={true}
                      placeholder="Filter by Tags..."
                      initialValue={value} 
                      createEndpoint="/lists/jobtags"
                      onSelect={(id: number) => {
                          const current = (value as number[]) || [];
                          if (current.includes(id)) onChange(current.filter(i => i !== id));
                          else onChange([...current, id]);
                      }}
                      onOptionCreated={refreshTags}
                      onRename={updateTag}
                      onDeleteOption={deleteTag}
                  />
              </Formik>
          ),
          filterMatcher: (job, filterValue) => {
              if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
              if (!job.JobTags || job.JobTags.length === 0) return false;
              const jobTagIds = job.JobTags.map((t: any) => t.id);
              return filterValue.some((id: number) => jobTagIds.includes(id));
          }
      }
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
      <Formik initialValues={initialValues} enableReinitialize onSubmit={onSubmit}>
          {({ values, submitForm }) => { // removed 'dirty' to fix build warning

            const getIsClean = () => {
                const dbJob = values.id ? jobs.find(j => j.id === values.id) : null;
                const original = dbJob 
                    ? formatJobForForm(dbJob) 
                    : { title: "", company: "", description: "", jobTagIds: [], requirements: [] };
                return isJobClean(values, original);
            };

            const handleExitJob = () => {
                if (!getIsClean() && !window.confirm("You have unsaved changes. Exit without saving?")) return;
                setIsDirty(false);
                setView("list");
            };

            return (
            <>
              {/* TOP NAVIGATION */}
              <div style={{ display: "flex", justifyContent: "flex-start", gap: "10px", marginBottom: "1rem" }}>
                 <button type="button" onClick={handleExitJob} className="btn-ghost" style={{ paddingLeft: 0 }}>&larr; Exit Job</button>
                 <button type="button" onClick={() => { submitForm().then(() => setView("list")); }} className="btn-ghost" style={{ border: "1px solid var(--border-color)", padding: "4px 12px" }}>Save + Exit Job</button>
              </div>

              <div className="card">
                <h2 style={{marginTop: 0}}>{editingItem ? "Edit Job" : "Create New Job"}</h2>
                <Form>
                  <FormObserver />
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                        <label>Job Title <span style={{color:'var(--danger)'}}>*</span></label>
                        <Field name="title">
                          {({ field }: any) => (
                             <input 
                                {...field}
                                required
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        
                                        const dbJob = values.id ? jobs.find(j => j.id === values.id) : null;
                                        const original = dbJob 
                                            ? formatJobForForm(dbJob) 
                                            : { title: "", company: "", description: "", jobTagIds: [], requirements: [] };
                                        
                                        const valuesWithOriginalTitle = { ...values, title: original.title };
                                        
                                        if (isJobClean(valuesWithOriginalTitle, original) && values.title && values.title.trim()) {
                                            submitForm();
                                        }
                                    }
                                }}
                             />
                          )}
                        </Field>
                    </div>
                    <div><label>Company</label><Field name="company" placeholder="e.g. Acme Corp" /></div>
                  </div>
                  <SearchableDropdown 
                      label="Job Tags" 
                      name="jobTagIds" 
                      options={jobTags} 
                      multiple={true} 
                      createEndpoint="/lists/jobtags" 
                      onOptionCreated={refreshTags} 
                      onRename={updateTag}
                      onDeleteOption={deleteTag}
                  />
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
                                <tr key={index} onClick={() => handleEditRequirement(index, values, !getIsClean())} style={{ cursor: "pointer" }} title="Click to edit details">
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
                            handleEditRequirement(newValues.requirements.length - 1, newValues, true); 
                        }} className="btn-secondary" style={{width: "100%"}}>+ Add Requirement</button>
                      </div>
                    )}
                  </FieldArray>
                  <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: "10px" }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, padding: "1rem", fontSize: "1rem" }}>{editingItem && editingItem.id ? "Save Changes" : "Create Job"}</button>
                    <button type="button" onClick={handleExitJob} className="btn-secondary" style={{ flex: 1 }}>Return to Jobs</button>
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