import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { useFormState } from "../context/FormStateContext"; 
import { ItemList } from "../components/ItemList"; 

interface CreateSimpleProps {
  title: string;      
  endpoint: string;   
}

export const CreateSimple = ({ title, endpoint }: CreateSimpleProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { setIsDirty } = useFormState();

  // --- 1. Fetch Existing Items ---
  const fetchItems = async () => {
    try {
      const res = await api.get(endpoint);
      setItems(res.data);
      // Clean up selection if items were deleted externally
      setSelectedIds(prev => prev.filter(id => res.data.find((i:any) => i.id === id)));
    } catch (err) {
      console.error(`Error fetching ${title}s:`, err);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [endpoint]); 

  // --- 2. Filtering & Selection Logic ---
  
  // Filter items based on search
  const filteredItems = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return items.filter(item => item.title.toLowerCase().includes(lowerSearch));
  }, [items, search]);

  // Determine if "Select All" is checked for the CURRENTLY VISIBLE items
  const allVisibleIds = filteredItems.map(i => i.id);
  const isAllVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id));

  // Toggle selection for individual items
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Toggle "Select All" (Only affects visible items)
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Add all visible IDs that aren't already selected
      const newIds = allVisibleIds.filter(id => !selectedIds.includes(id));
      setSelectedIds(prev => [...prev, ...newIds]);
    } else {
      // Remove all visible IDs from selection
      setSelectedIds(prev => prev.filter(id => !allVisibleIds.includes(id)));
    }
  };

  // --- 3. Actions ---

  // Create New Item (triggered by Enter on search)
  const handleCreate = async () => {
    if (!search.trim()) return;

    // Check for exact match to prevent duplicates
    const exactMatch = items.find(i => i.title.toLowerCase() === search.toLowerCase());
    if (exactMatch) {
      alert(`${title} "${search}" already exists.`);
      return;
    }

    try {
      const res = await api.post(endpoint, { title: search });
      setIsDirty(false);
      
      // If we are in "Return Mode" (came from a dropdown), go back immediately with new ID
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

      // Otherwise, just refresh the list. 
      // Do NOT clear search so the user sees the new item immediately.
      fetchItems();
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        setSearch("");
    }
  };

  const handleDelete = async (id: number) => {
    // Standard delete check
    if (title === "Skill") {
       try {
         const usageRes = await api.get(`${endpoint}/${id}/usage`);
         if (usageRes.data.experienceCount > 0 || usageRes.data.requirementCount > 0) {
             if (!window.confirm(`This skill is used in ${usageRes.data.experienceCount} experiences. Delete anyway?`)) return;
         }
       } catch (e) {}
    } else {
       if (!window.confirm("Are you sure?")) return;
    }

    try {
      await api.delete(`${endpoint}/${id}`); 
      fetchItems();
    } catch (err: any) {
      console.error(err);
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} items? This action cannot be undone.`)) return;

    try {
      await Promise.all(selectedIds.map(id => api.delete(`${endpoint}/${id}`)));
      fetchItems(); 
      setSelectedIds([]); // Clear selection after delete
    } catch (err: any) {
      alert("Error deleting some items: " + err.message);
      fetchItems();
    }
  };

  const handleRename = async (id: number, newVal: string) => {
    try {
      await api.put(`${endpoint}/${id}`, { title: newVal });
      fetchItems(); 
    } catch (err: any) {
      alert("Error renaming: " + err.message);
    }
  };

  return (
    <div className="page-container">
      {location.state?.returnPath && (
        <div style={{ background: "#eff6ff", padding: "15px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #bfdbfe", color: "#1e40af" }}>
          <strong>Creating a new {title}</strong>
          <p style={{margin: "5px 0 0 0", fontSize: "0.9em"}}>
            Create a {title} here to select it in your form.
          </p>
        </div>
      )}
      
      <div className="card-header">
        <h2>Manage {title}s</h2>
        {location.state?.returnPath && (
           <button onClick={() => navigate(location.state.returnPath)} className="btn-ghost">Cancel</button>
        )}
      </div>
      
      <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", maxHeight: "70vh" }}>
        
        {/* HEADER: Search / Create Input */}
        <div style={{ marginBottom: "10px", position: "relative" }}>
            <input 
              className="input"
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              onKeyDown={handleKeyDown}
              placeholder={filteredItems.length === 0 && search ? `Press Enter to create "${search}"` : `Search or Type to create ${title}...`} 
              style={{ marginBottom: 0, width: "100%", paddingRight: search ? "30px" : "10px" }}
              autoFocus
            />
            {/* Optional: Visual hint for creation */}
            {search && filteredItems.length === 0 && (
                <div style={{ position: "absolute", right: "35px", top: "50%", transform: "translateY(-50%)", fontSize: "0.8rem", color: "var(--success)", pointerEvents: "none" }}>
                    Press Enter to Create
                </div>
            )}

            {search && (
                <button 
                    onClick={() => setSearch("")}
                    style={{ 
                        position: "absolute", 
                        right: "10px", 
                        top: "50%", 
                        transform: "translateY(-50%)", 
                        border: "none", 
                        background: "transparent", 
                        cursor: "pointer", 
                        color: "#94a3b8", 
                        fontSize: "1.1rem",
                        padding: "0 4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%"
                    }}
                    title="Clear Search (Esc)"
                >
                    ✕
                </button>
            )}
        </div>

        {/* LIST AREA */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px", marginBottom: "15px" }}>
            <ItemList 
              items={filteredItems}
              onDelete={handleDelete}
              onRename={handleRename}
              onSelect={toggleSelection}
              selectedIds={selectedIds}
              emptyMessage={search ? `No match. Press Enter to create "${search}"` : "No items found."}
              // FIX: Override default max-height/overflow to prevent double scrollbars
              style={{ maxHeight: "none", overflow: "visible" }}
            />
        </div>

        {/* FOOTER: Bulk Actions */}
        <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            paddingTop: "10px", 
            borderTop: "1px solid #f1f5f9",
            opacity: items.length > 0 ? 1 : 0.5,
            pointerEvents: items.length > 0 ? "auto" : "none"
        }}>
            <label style={{ fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: 0, fontWeight: 500, color: "var(--text-muted)" }}>
                <input 
                    type="checkbox" 
                    checked={isAllVisibleSelected}
                    onChange={handleSelectAll}
                    disabled={filteredItems.length === 0}
                    style={{ margin: 0, width: "16px", height: "16px" }}
                />
                Select All ({filteredItems.length} visible)
            </label>
            
            {selectedIds.length > 0 && (
                <button 
                    onClick={handleBulkDelete} 
                    className="btn-ghost" 
                    style={{ 
                        color: "var(--danger)", 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "6px", 
                        padding: "6px 12px", 
                        background: "#fff1f2", 
                        border: "1px solid #fecdd3", 
                        borderRadius: "6px",
                        fontSize: "0.9rem",
                        fontWeight: 500
                    }}
                >
                    🗑️ Delete Selected ({selectedIds.length})
                </button>
            )}
        </div>

      </div>
    </div>
  );
};