import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext"; // IMPORT

interface CreateSimpleProps {
  title: string;      
  endpoint: string;   
}

export const CreateSimple = ({ title, endpoint }: CreateSimpleProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { setIsDirty } = useFormState(); // CONTEXT

  // --- 1. Fetch Existing Items ---
  const fetchItems = async () => {
    try {
      const res = await api.get(endpoint);
      setItems(res.data);
    } catch (err) {
      console.error(`Error fetching ${title}s:`, err);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [endpoint]); 

  // --- 2. Update Dirty State ---
  useEffect(() => {
    setIsDirty(inputValue.length > 0);
    return () => setIsDirty(false);
  }, [inputValue, setIsDirty]);


  // --- 3. Handle Create ---
  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    try {
      const res = await api.post(endpoint, { title: inputValue });
      
      // Clean up dirty state immediately after save
      setIsDirty(false);
      
      // --- A. RETURN LOGIC ---
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

      // --- B. STANDARD LOGIC ---
      alert(`${title} Added!`);
      setInputValue("");
      fetchItems();

    } catch (err: any) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`${endpoint}/${id}`); 
      fetchItems();
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="page">
      {location.state?.returnPath && (
        <div style={{ background: "#e2e3e5", padding: "15px", marginBottom: "20px", borderRadius: "4px", borderLeft: "5px solid #007bff" }}>
          <strong>Creating a new {title}</strong>
          <p style={{margin: "5px 0 0 0", fontSize: "0.9em"}}>
            Once created, you will be redirected back to your form with this {title.toLowerCase()} selected.
          </p>
        </div>
      )}
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Manage {title}s</h2>
        {location.state?.returnPath && (
           <button onClick={() => navigate(location.state.returnPath)} style={{background: "#6c757d"}}>Cancel</button>
        )}
      </div>
      
      <div className="form-box" style={{ marginBottom: "30px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
        <label style={{display: "block", marginBottom: "5px", fontWeight: "bold"}}>Add New {title}</label>
        <div style={{ display: "flex", gap: "10px" }}>
          <input 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            placeholder={`Enter ${title} Title`} 
            style={{ flex: 1, padding: "8px" }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button onClick={handleSubmit} style={{ background: "#28a745" }}>Create</button>
        </div>
      </div>

      <h3>Existing {title}s</h3>
      <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "10px" }}>{i.title}</td>
                <td style={{ padding: "10px", textAlign: "right", width: "50px" }}>
                   <button 
                     onClick={() => handleDelete(i.id)} 
                     style={{ background: "transparent", color: "#dc3545", border: "none", padding: 0, cursor: "pointer" }}
                     title="Delete"
                   >
                     X
                   </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={2} style={{padding: "20px", textAlign: "center", color: "#888"}}>No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};