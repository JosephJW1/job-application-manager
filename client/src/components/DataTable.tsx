import React, { useState, useMemo } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
  // New: Custom filter UI renderer
  renderFilter?: (value: any, onChange: (val: any) => void) => React.ReactNode;
  // New: Custom filter matching logic
  filterMatcher?: (item: T, filterValue: any) => boolean;
}

interface DataTableProps<T extends { id: number }> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  onDelete?: (ids: number[]) => Promise<void>;
  onAdd?: () => void;
  title?: string;
  addButtonLabel?: string;
}

export const DataTable = <T extends { id: number }>({ 
  data, 
  columns, 
  onRowClick, 
  onDelete, 
  onAdd, 
  title,
  addButtonLabel = "+ Create"
}: DataTableProps<T>) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // Allow filter values to be strings, numbers, or arrays (any)
  const [filters, setFilters] = useState<Record<string, any>>({});

  // --- FILTERING ---
  const filteredData = useMemo(() => {
    return data.filter(item => {
      return columns.every(col => {
        const filterValue = filters[col.key];
        
        // Skip filtering if value is empty/null or empty array
        if (filterValue === undefined || filterValue === "" || filterValue === null) return true;
        if (Array.isArray(filterValue) && filterValue.length === 0) return true;
        
        // Use custom matcher if provided
        if (col.filterMatcher) {
            return col.filterMatcher(item, filterValue);
        }
        
        // Default Filtering Logic
        const itemValue = (item as any)[col.key];
        const searchStr = String(filterValue).toLowerCase();

        // Handle Array properties (e.g. searching "A" in ["A", "B"] or [{title: "A"}])
        if (Array.isArray(itemValue)) {
            return itemValue.some(v => {
                // If array of objects, check title/name, otherwise stringify
                const valStr = typeof v === 'object' && v !== null 
                    ? (v.title || v.name || JSON.stringify(v)) 
                    : String(v);
                return String(valStr).toLowerCase().includes(searchStr);
            });
        }
        
        return String(itemValue || "").toLowerCase().includes(searchStr);
      });
    });
  }, [data, filters, columns]);

  // --- SELECTION ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredData.map(d => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!onDelete) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} item(s)?`)) {
      await onDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const clearFilter = (key: string) => {
      setFilters(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
      });
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* HEADER */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{title || "Items"}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
           {selectedIds.length > 0 && onDelete && (
             <button 
                onClick={handleBulkDelete} 
                className="btn-ghost" 
                style={{ 
                    color: 'var(--danger)', 
                    border: '1px solid var(--danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }}
             >
               🗑️ Delete Selected ({selectedIds.length})
             </button>
           )}
           {onAdd && <button onClick={onAdd} className="btn-primary">{addButtonLabel}</button>}
        </div>
      </div>

      {/* TABLE */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {/* Headers */}
            <tr>
              <th style={{ width: '40px', padding: '10px' }}>
                <input 
                  type="checkbox" 
                  checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                  onChange={handleSelectAll}
                  disabled={filteredData.length === 0}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              {columns.map(col => (
                <th key={col.key} style={{ textAlign: 'left', width: col.width, padding: '10px' }}>
                    {col.header}
                </th>
              ))}
              {onDelete && <th style={{ textAlign: 'right', padding: '10px' }}>Actions</th>}
            </tr>
            
            {/* Search Filters Row */}
            <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
              <th></th>
              {columns.map(col => {
                const hasValue = filters[col.key] !== undefined && filters[col.key] !== "" && 
                                 (!Array.isArray(filters[col.key]) || filters[col.key].length > 0);

                return (
                    <th key={`filter-${col.key}`} style={{ padding: '5px 10px', verticalAlign: 'top' }}>
                      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                        {col.renderFilter ? (
                            // Custom Filter Component
                            <div style={{ width: '100%' }} onClick={e => e.stopPropagation()}>
                                {col.renderFilter(filters[col.key], (val) => setFilters(prev => ({ ...prev, [col.key]: val })))}
                            </div>
                        ) : (
                            // Default Text Input
                            <input
                                placeholder={`Filter ${col.header}...`}
                                value={filters[col.key] || ""}
                                onChange={(e) => setFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                onClick={(e) => e.stopPropagation()}
                                style={{ 
                                    width: '100%', 
                                    fontSize: '0.85rem', 
                                    padding: '4px 8px', 
                                    paddingRight: '24px', // Space for clear button
                                    border: '1px solid var(--border-color)', 
                                    borderRadius: '4px', 
                                    fontWeight: 'normal',
                                    marginBottom: 0
                                }}
                            />
                        )}

                        {/* Clear Button (Visible if filter has value) */}
                        {hasValue && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); clearFilter(col.key); }}
                                style={{
                                    position: 'absolute',
                                    right: '4px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '1.2em',
                                    lineHeight: 1,
                                    padding: '0 4px',
                                    zIndex: 10
                                }}
                                title="Clear Filter"
                            >
                                &times;
                            </button>
                        )}
                      </div>
                    </th>
                );
              })}
              {onDelete && <th></th>}
            </tr>
          </thead>
          
          <tbody>
            {filteredData.length === 0 ? (
                <tr>
                    <td colSpan={columns.length + (onDelete ? 2 : 1)} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No items found matching your search.
                    </td>
                </tr>
            ) : (
                filteredData.map(item => (
                  <tr 
                    key={item.id} 
                    onClick={() => onRowClick && onRowClick(item)} 
                    className={selectedIds.includes(item.id) ? 'selected' : ''}
                    style={{ 
                        cursor: onRowClick ? 'pointer' : 'default',
                        transition: 'background 0.2s' 
                    }}
                  >
                    <td onClick={e => e.stopPropagation()} style={{ padding: '10px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleSelectRow(item.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    
                    {columns.map(col => (
                      <td key={col.key} style={{ padding: '10px' }}>
                        {col.render ? col.render(item) : (item as any)[col.key]}
                      </td>
                    ))}
                    
                    {onDelete && (
                        <td style={{ textAlign: 'right', padding: '10px' }} onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => { 
                                  if(window.confirm("Are you sure you want to delete this item?")) {
                                      onDelete([item.id]); 
                                  }
                              }} 
                              className="btn-ghost" 
                              style={{ color: 'var(--danger)', padding: '4px 8px' }}
                            >
                              Delete
                            </button>
                        </td>
                    )}
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};