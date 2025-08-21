import React, { useState, useEffect } from 'react';
import './ConfirmationDialog.css';

function ConfirmationDialog({ 
  confirmationData, 
  onConfirm, 
  onCancel, 
  onModify,
  isVisible 
}) {
  const [selectedWidgets, setSelectedWidgets] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [showModifyOptions, setShowModifyOptions] = useState(false);

  useEffect(() => {
    if (confirmationData?.widgets) {
      // Initialize all widgets as selected
      setSelectedWidgets(confirmationData.widgets.map((_, index) => index));
    }
  }, [confirmationData]);

  if (!isVisible || !confirmationData) return null;

  const { 
    confirmation_id,
    // action,
    widgets = [],
    total_count = 0,
    preview_message,
    user_message
  } = confirmationData;

  // Group widgets by page and type for better organization
  const groupedWidgets = widgets.reduce((acc, widget, index) => {
    const page = widget.page || 'Unknown Page';
    const type = widget.widget_type || 'Unknown Type';
    
    if (!acc[page]) acc[page] = {};
    if (!acc[page][type]) acc[page][type] = [];
    
    acc[page][type].push({ ...widget, originalIndex: index });
    return acc;
  }, {});

  // Filter widgets based on search text
  const filteredGroupedWidgets = Object.entries(groupedWidgets).reduce((acc, [page, types]) => {
    const filteredTypes = Object.entries(types).reduce((typeAcc, [type, widgetList]) => {
      const filtered = widgetList.filter(widget => {
        const searchLower = filterText.toLowerCase();
        return !filterText || 
          widget.data_key?.toLowerCase().includes(searchLower) ||
          widget.content?.toLowerCase().includes(searchLower) ||
          widget.widget_type?.toLowerCase().includes(searchLower) ||
          page.toLowerCase().includes(searchLower);
      });
      
      if (filtered.length > 0) {
        typeAcc[type] = filtered;
      }
      return typeAcc;
    }, {});
    
    if (Object.keys(filteredTypes).length > 0) {
      acc[page] = filteredTypes;
    }
    return acc;
  }, {});

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleWidgetSelection = (index) => {
    setSelectedWidgets(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const togglePageSelection = (page) => {
    const pageWidgets = Object.values(groupedWidgets[page] || {})
      .flat()
      .map(w => w.originalIndex);
    
    const allSelected = pageWidgets.every(idx => selectedWidgets.includes(idx));
    
    if (allSelected) {
      setSelectedWidgets(prev => prev.filter(idx => !pageWidgets.includes(idx)));
    } else {
      setSelectedWidgets(prev => [...new Set([...prev, ...pageWidgets])]);
    }
  };

  const handleConfirm = () => {
    if (showModifyOptions) {
      // Send only selected widgets
      const modifiedWidgets = widgets.filter((_, index) => selectedWidgets.includes(index));
      onModify(confirmation_id, modifiedWidgets);
      setShowModifyOptions(false);
    } else {
      onConfirm(confirmation_id);
    }
  };

  const handleModify = () => {
    setShowModifyOptions(true);
  };

  const handleCancelModify = () => {
    setShowModifyOptions(false);
    setSelectedWidgets(widgets.map((_, index) => index));
  };

  const renderWidgetPreview = (widget, index) => {
    const isSelected = selectedWidgets.includes(widget.originalIndex);
    
    return (
      <div 
        key={widget.originalIndex}
        className={`widget-item ${isSelected ? 'selected' : 'deselected'}`}
        onClick={() => showModifyOptions && toggleWidgetSelection(widget.originalIndex)}
      >
        {showModifyOptions && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleWidgetSelection(widget.originalIndex)}
            onClick={(e) => e.stopPropagation()}
            className="widget-checkbox"
          />
        )}
        <div className="widget-info">
          <div className="widget-header">
            <span className="widget-type-badge">{widget.widget_type}</span>
            {widget.data_key && (
              <span className="widget-data-key">{widget.data_key}</span>
            )}
          </div>
          {widget.content && (
            <div className="widget-content-preview">
              <div className="content-label">Current:</div>
              <div className="content-text">{widget.content.substring(0, 100)}...</div>
            </div>
          )}
          {widget.suggested_update && (
            <div className="widget-suggested-update">
              <div className="content-label">Will change to:</div>
              <div className="content-text suggested">{widget.suggested_update.substring(0, 100)}...</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="confirmation-overlay">
      <div className="confirmation-dialog">
        <div className="confirmation-header">
          <h2>🤖 Confirm Action</h2>
          {showModifyOptions && (
            <button className="close-modify-btn" onClick={handleCancelModify}>
              ✕
            </button>
          )}
        </div>

        <div className="confirmation-body">
          {user_message && (
            <div className="user-request">
              <strong>Your request:</strong> {user_message}
            </div>
          )}

          <div className="action-summary">
            <h3>📋 Action Summary</h3>
            <p>{preview_message || `The AI will update ${total_count} widgets on your website.`}</p>
            
            {!showModifyOptions && (
              <div className="action-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Widgets:</span>
                  <span className="stat-value">{total_count}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Pages Affected:</span>
                  <span className="stat-value">{Object.keys(groupedWidgets).length}</span>
                </div>
              </div>
            )}
          </div>

          {showModifyOptions && (
            <div className="modify-controls">
              <div className="modify-header">
                <h4>Select widgets to update:</h4>
                <div className="selection-stats">
                  {selectedWidgets.length} of {widgets.length} selected
                </div>
              </div>
              <input
                type="text"
                placeholder="Search widgets..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="widget-search"
              />
            </div>
          )}

          <div className="widgets-preview">
            <h4>{showModifyOptions ? 'Select Widgets:' : 'Widgets to Update:'}</h4>
            
            <div className="grouped-widgets">
              {Object.entries(showModifyOptions ? filteredGroupedWidgets : groupedWidgets).map(([page, types]) => {
                const pageKey = `page-${page}`;
                const isExpanded = expandedSections[pageKey] !== false; // Default to expanded
                const pageWidgets = Object.values(types).flat();
                const selectedCount = pageWidgets.filter(w => 
                  selectedWidgets.includes(w.originalIndex)
                ).length;

                return (
                  <div key={page} className="page-group">
                    <div 
                      className="page-header"
                      onClick={() => toggleSection(pageKey)}
                    >
                      <span className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span className="page-name">{page}</span>
                      <span className="page-count">
                        {showModifyOptions 
                          ? `${selectedCount}/${pageWidgets.length} widgets`
                          : `${pageWidgets.length} widgets`
                        }
                      </span>
                      {showModifyOptions && (
                        <button
                          className="select-all-page"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePageSelection(page);
                          }}
                        >
                          {selectedCount === pageWidgets.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    
                    {isExpanded && (
                      <div className="page-widgets">
                        {Object.entries(types).map(([type, widgetsList]) => (
                          <div key={type} className="type-group">
                            <div className="type-header">
                              <span className="type-name">{type}</span>
                              <span className="type-count">({widgetsList.length})</span>
                            </div>
                            <div className="widgets-list">
                              {widgetsList.slice(0, showModifyOptions ? undefined : 3).map(widget => 
                                renderWidgetPreview(widget)
                              )}
                              {!showModifyOptions && widgetsList.length > 3 && (
                                <div className="more-widgets">
                                  ... and {widgetsList.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="confirmation-footer">
          {!showModifyOptions ? (
            <>
              <button 
                className="confirm-btn"
                onClick={handleConfirm}
              >
                ✅ Confirm & Execute
              </button>
              <button 
                className="modify-btn"
                onClick={handleModify}
              >
                ✏️ Modify Selection
              </button>
              <button 
                className="cancel-btn"
                onClick={() => onCancel(confirmation_id)}
              >
                ❌ Cancel
              </button>
            </>
          ) : (
            <>
              <button 
                className="confirm-btn"
                onClick={handleConfirm}
                disabled={selectedWidgets.length === 0}
              >
                ✅ Update {selectedWidgets.length} Widgets
              </button>
              <button 
                className="cancel-btn"
                onClick={handleCancelModify}
              >
                Cancel Modification
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;