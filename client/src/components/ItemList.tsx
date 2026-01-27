import React, { useEffect, useRef } from 'react';
import { EditableText } from "./EditableText";

export interface ItemListProps {
  items: any[];
  selectedIds?: number[];
  activeId?: number | null; // For keyboard highlighting
  onSelect?: (id: number) => void; // For Checkbox selection
  onItemClick?: (item: any) => void; // For Row selection (Dropdown mode)
  onDelete?: (id: number) => void;
  onRename?: (id: number, newVal: string) => Promise<void>;
  onOpen?: (id: number) => void;
  renderContent?: (item: any) => React.ReactNode;
  emptyMessage?: React.ReactNode; 
  className?: string; // NEW: Allow custom classes
  style?: React.CSSProperties; // NEW: Allow custom styles
}

export const ItemList = ({ 
  items, 
  onSelect, 
  selectedIds = [], 
  activeId,
  onItemClick,
  onDelete, 
  onRename, 
  onOpen,
  renderContent,
  emptyMessage,
  className,
  style
}: ItemListProps) => {

  // Auto-scroll to active item
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeId]);

  return (
    <div className={`item-list ${className || ""}`} style={style}>
      {items.length === 0 ? (
        <div style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          {emptyMessage || "No items found."}
        </div>
      ) : items.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        const isActive = activeId === item.id;
        
        return (
          <div 
            key={item.id} 
            ref={isActive ? activeRef : null}
            className={`item-list-row ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
            onClick={() => onItemClick && onItemClick(item)}
            style={{ cursor: onItemClick ? "pointer" : "default" }}
          >
            
            {/* 1. SELECTION (Checkbox) */}
            {onSelect && (
              <div 
                className="item-list-selection"
                onClick={(e) => e.stopPropagation()} // Prevent row click
                style={{ display: "flex", alignItems: "center", paddingRight: "8px" }}
              >
                 <input 
                    type="checkbox" 
                    checked={isSelected} 
                    onChange={() => onSelect(item.id)}
                    style={{ margin: 0, cursor: "pointer", width: "16px", height: "16px" }}
                 />
              </div>
            )}

            {/* 2. CONTENT */}
            <div className="item-list-content">
               {renderContent ? (
                  renderContent(item)
               ) : onRename ? (
                  <EditableText 
                     value={item.title} 
                     onSave={(val) => onRename(item.id, val)}
                     
                     // Allow clicking text to trigger row click if no open handler
                     onClick={(e) => { 
                         if(onOpen) {
                             e.stopPropagation();
                             onOpen(item.id);
                         } else if (onItemClick) {
                             // Let bubble up to row handler
                         }
                     }}
                     
                     style={{ 
                         width: "100%", 
                         display: "flex",
                         border: "none", 
                         padding: 0, 
                         fontWeight: 500, 
                         background: "transparent",
                         cursor: onOpen || onItemClick ? "pointer" : "default"
                     }}
                  />
               ) : (
                  <span style={{fontWeight: 500}}>{item.title}</span>
               )}
            </div>

            {/* 3. ACTIONS */}
            <div className="item-list-actions">
               {onOpen && (
                 <button 
                   type="button"
                   onClick={(e) => { e.stopPropagation(); onOpen(item.id); }} 
                   className="btn-ghost"
                   style={{ padding: "4px 8px" }}
                   title="Open details"
                 >
                   ↗
                 </button>
               )}

               {onDelete && (
                 <button 
                   type="button"
                   onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                   className="btn-ghost"
                   style={{ color: "var(--danger)", padding: "4px 8px" }}
                   title="Delete"
                 >
                   🗑️
                 </button>
               )}
            </div>

          </div>
        );
      })}
    </div>
  );
};