import React, { useState, useEffect } from 'react';
import { useQuery } from '../contexts/QueryContext';

const NewQueryModal = ({ isOpen, onClose, editingQuery = null }) => {
  const { addQuery, updateQuery } = useQuery();
  
  // Basic query info
  const [queryInfo, setQueryInfo] = useState({
    name: '',
    description: '',
    color: '#0066cc'
  });

  // Categories and fields loaded from API
  const [categories, setCategories] = useState({});
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Query structure - starts with a root group
  const [queryStructure, setQueryStructure] = useState({
    id: 'root',
    logic: 'AND',
    conditions: [],
    subgroups: []
  });

  // Counter for generating unique IDs
  const [nextId, setNextId] = useState(1);

  // Load categories when modal opens
  useEffect(() => {
    if (isOpen && Object.keys(categories).length === 0) {
      loadCategories();
    }
  }, [isOpen]);

  // Load editing data when editingQuery changes
  useEffect(() => {
    if (editingQuery && isOpen) {
      console.log('Loading editing query:', editingQuery);
      
      // Set basic query info
      setQueryInfo({
        name: editingQuery.name,
        description: editingQuery.description || '',
        color: editingQuery.color
      });
      
      try {
        // Convert the backend conditions format back to the form format
        // Handle different possible formats of conditions
        let backendQueryFormat;
        
        if (editingQuery.conditions && typeof editingQuery.conditions === 'object') {
          // If conditions is already a structured object
          if (editingQuery.conditions.logic && editingQuery.conditions.conditions) {
            backendQueryFormat = editingQuery.conditions;
          } else if (Array.isArray(editingQuery.conditions)) {
            // If conditions is a direct array
            backendQueryFormat = {
              logic: editingQuery.logic || 'AND',
              conditions: editingQuery.conditions
            };
          } else {
            // Fallback: treat the whole conditions object as a single query
            backendQueryFormat = {
              logic: editingQuery.logic || 'AND',
              conditions: [editingQuery.conditions]
            };
          }
        } else {
          // Fallback: create empty structure
          backendQueryFormat = {
            logic: editingQuery.logic || 'AND',
            conditions: []
          };
        }
        
        console.log('Backend query format for conversion:', backendQueryFormat);
        const conversionResult = convertFromBackendFormat(backendQueryFormat);
        console.log('Converted structure:', conversionResult.structure);
        setQueryStructure(conversionResult.structure);
        setNextId(conversionResult.nextId);
      } catch (error) {
        console.error('Error converting query format:', error);
        // Reset to default structure on error
        setQueryStructure({
          id: 'root',
          logic: 'AND',
          conditions: [],
          subgroups: []
        });
        setNextId(1);
      }
    } else if (isOpen && !editingQuery) {
      // Reset form for new query
      resetForm();
    }
  }, [editingQuery, isOpen]);

  if (!isOpen) return null;

  const loadCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const response = await fetch('http://localhost:8082/api/query/categories');
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const generateId = () => {
    const id = nextId;
    setNextId(prev => prev + 1);
    return `item_${id}`;
  };

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'does_not_contain', label: 'Does Not Contain' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
    { value: 'less_than_or_equal', label: 'Less Than or Equal' }
  ];

  const colorOptions = [
    '#0066cc', '#cc0066', '#66cc00', '#cc6600', '#6600cc', '#00cc66',
    '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#ff8000', '#8000ff', '#00ff80', '#ff0080', '#80ff00', '#0080ff'
  ];

  // Update query structure functions
  const updateGroupLogic = (groupPath, logic) => {
    setQueryStructure(prev => {
      const updated = JSON.parse(JSON.stringify(prev)); // Deep clone
      const group = findGroupByPath(updated, groupPath);
      if (group) {
        group.logic = logic;
      }
      return updated;
    });
  };

  const addConditionToGroup = (groupPath) => {
    const newCondition = {
      id: generateId(),
      category: '',
      field: '',
      operator: 'equals',
      value: ''
    };
    
    setQueryStructure(prev => {
      const updated = JSON.parse(JSON.stringify(prev)); // Deep clone
      const group = findGroupByPath(updated, groupPath);
      if (group) {
        group.conditions = [...group.conditions, newCondition];
      }
      return updated;
    });
  };

  const removeCondition = (groupPath, conditionId) => {
    setQueryStructure(prev => {
      const updated = JSON.parse(JSON.stringify(prev)); // Deep clone
      const group = findGroupByPath(updated, groupPath);
      if (group) {
        group.conditions = group.conditions.filter(c => c.id !== conditionId);
      }
      return updated;
    });
  };

  const updateCondition = (groupPath, conditionId, updates) => {
    setQueryStructure(prev => {
      const updated = JSON.parse(JSON.stringify(prev)); // Deep clone
      const group = findGroupByPath(updated, groupPath);
      if (group) {
        group.conditions = group.conditions.map(c => 
          c.id === conditionId ? { ...c, ...updates } : c
        );
      }
      return updated;
    });
  };

  const addSubgroup = (groupPath) => {
    const newSubgroup = {
      id: generateId(),
      logic: 'AND',
      conditions: [],
      subgroups: []
    };
    
    setQueryStructure(prev => {
      const updated = JSON.parse(JSON.stringify(prev)); // Deep clone
      const group = findGroupByPath(updated, groupPath);
      if (group) {
        group.subgroups = [...group.subgroups, newSubgroup];
      }
      return updated;
    });
  };

  const removeSubgroup = (groupPath, subgroupId) => {
    setQueryStructure(prev => {
      const updated = JSON.parse(JSON.stringify(prev)); // Deep clone
      const parentPath = groupPath.slice(0, -1);
      const parentGroup = findGroupByPath(updated, parentPath);
      if (parentGroup) {
        parentGroup.subgroups = parentGroup.subgroups.filter(s => s.id !== subgroupId);
      }
      return updated;
    });
  };

  // Helper functions
  const findGroupByPath = (structure, path) => {
    if (path.length === 0 || (path.length === 1 && path[0] === 'root')) {
      return structure;
    }
    
    let current = structure;
    // Skip the 'root' part and iterate through the actual path
    for (let i = 1; i < path.length; i++) {
      const subgroup = current.subgroups.find(s => s.id === path[i]);
      if (!subgroup) {
        console.error(`Group not found at path: ${path.join(' -> ')}, looking for: ${path[i]}`);
        return null;
      }
      current = subgroup;
    }
    return current;
  };

  const updateGroupInStructure = (structure, path, updates) => {
    if (path.length === 0 || (path.length === 1 && path[0] === 'root')) {
      return { ...structure, ...updates };
    }
    
    const updated = { ...structure };
    let current = updated;
    
    // Navigate to the parent of the target group
    for (let i = 1; i < path.length - 1; i++) {
      const subgroupIndex = current.subgroups.findIndex(s => s.id === path[i]);
      if (subgroupIndex === -1) {
        console.error(`Group not found in path: ${path.join(' -> ')}`);
        return structure;
      }
      current.subgroups[subgroupIndex] = { ...current.subgroups[subgroupIndex] };
      current = current.subgroups[subgroupIndex];
    }
    
    // Update the target group
    const finalId = path[path.length - 1];
    if (finalId === 'root') {
      return { ...updated, ...updates };
    }
    
    const finalIndex = current.subgroups.findIndex(s => s.id === finalId);
    if (finalIndex === -1) {
      console.error(`Final group not found: ${finalId}`);
      return structure;
    }
    
    current.subgroups[finalIndex] = { ...current.subgroups[finalIndex], ...updates };
    
    return updated;
  };

  // Convert to backend format
  const convertToBackendFormat = (group) => {
    const result = {
      logic: group.logic,
      conditions: []
    };

    // Add direct conditions
    group.conditions.forEach(condition => {
      if (condition.category && condition.field && condition.operator && condition.value) {
        result.conditions.push({
          category: condition.category,
          field: condition.field,
          operator: condition.operator,
          value: condition.value
        });
      }
    });

    // Add subgroups recursively
    group.subgroups.forEach(subgroup => {
      // Only add subgroups that have content
      const convertedSubgroup = convertToBackendFormat(subgroup);
      if (convertedSubgroup.conditions.length > 0) {
        result.conditions.push(convertedSubgroup);
      }
    });

    return result;
  };

  // Convert from backend format to form format
  const convertFromBackendFormat = (backendQuery) => {
    const rootGroup = {
      id: 'root',
      logic: backendQuery.logic || 'AND',
      conditions: [],
      subgroups: []
    };

    let conditionIdCounter = 1;
    let groupIdCounter = 1;

    const processConditions = (conditions, targetGroup) => {
      // Add validation to ensure conditions is an array
      if (!conditions || !Array.isArray(conditions)) {
        console.warn('Expected conditions to be an array, got:', conditions);
        return;
      }

      conditions.forEach(condition => {
        if (condition.category && condition.field && condition.operator && condition.value) {
          // It's a direct condition
          targetGroup.conditions.push({
            id: `item_${conditionIdCounter++}`,
            category: condition.category,
            field: condition.field,
            operator: condition.operator,
            value: condition.value
          });
        } else if (condition.logic && condition.conditions) {
          // It's a subgroup
          const newSubgroup = {
            id: `item_${groupIdCounter++}`,
            logic: condition.logic,
            conditions: [],
            subgroups: []
          };
          processConditions(condition.conditions, newSubgroup);
          targetGroup.subgroups.push(newSubgroup);
        }
      });
    };

    if (backendQuery.conditions) {
      processConditions(backendQuery.conditions, rootGroup);
    }

    return { structure: rootGroup, nextId: Math.max(conditionIdCounter, groupIdCounter) + 1 };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!queryInfo.name.trim()) {
      alert('Please enter a query name');
      return;
    }

    // Check if we have at least one condition
    const hasConditions = (group) => {
      if (group.conditions.some(c => c.category && c.field && c.operator && c.value)) {
        return true;
      }
      return group.subgroups.some(hasConditions);
    };

    if (!hasConditions(queryStructure)) {
      alert('Please add at least one condition to your query');
      return;
    }

    // Convert to backend format
    const backendQuery = convertToBackendFormat(queryStructure);

    if (editingQuery) {
      // Update existing query
      updateQuery(editingQuery.id, {
        name: queryInfo.name.trim(),
        description: queryInfo.description.trim(),
        color: queryInfo.color,
        conditions: backendQuery
      });
    } else {
      // Add new query
      addQuery(
        queryInfo.name.trim(),
        backendQuery,
        queryInfo.color,
        queryInfo.description.trim()
      );
    }

    // Reset form and close modal
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setQueryInfo({
      name: '',
      description: '',
      color: '#0066cc'
    });
    setQueryStructure({
      id: 'root',
      logic: 'AND',
      conditions: [],
      subgroups: []
    });
    setNextId(1);
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  // Render condition component
  const renderCondition = (condition, groupPath, depth = 0) => {
    const categoryOptions = Object.keys(categories);
    const fieldOptions = condition.category && categories[condition.category] 
      ? categories[condition.category] 
      : [];

    return (
      <div 
        key={condition.id} 
        className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-center">
          {/* Category */}
          <select
            value={condition.category}
            onChange={(e) => updateCondition(groupPath, condition.id, { 
              category: e.target.value, 
              field: '' // Reset field when category changes
            })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Category</option>
            {categoryOptions.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          {/* Field */}
          <select
            value={condition.field}
            onChange={(e) => updateCondition(groupPath, condition.id, { field: e.target.value })}
            disabled={!condition.category}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          >
            <option value="">Select Field</option>
            {fieldOptions.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>

          {/* Operator */}
          <select
            value={condition.operator}
            onChange={(e) => updateCondition(groupPath, condition.id, { operator: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {operators.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>

          {/* Value */}
          <input
            type="text"
            value={condition.value}
            onChange={(e) => updateCondition(groupPath, condition.id, { value: e.target.value })}
            placeholder="Enter value"
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => removeCondition(groupPath, condition.id)}
            className="text-red-600 hover:text-red-800 transition-colors p-2 hover:bg-red-50 rounded-md flex items-center justify-center"
            title="Remove condition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Render group component
  const renderGroup = (group, groupPath, depth = 0) => {
    const isRoot = groupPath.length === 1 && groupPath[0] === 'root';
    
    return (
      <div 
        key={group.id}
        className={`${isRoot ? '' : 'border border-blue-200 rounded-lg p-4 mb-4 bg-blue-50'}`}
        style={{ marginLeft: isRoot ? 0 : `${depth * 15}px` }}
      >
        {!isRoot && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Group Logic:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => updateGroupLogic(groupPath, 'AND')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    group.logic === 'AND' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  AND
                </button>
                <button
                  type="button"
                  onClick={() => updateGroupLogic(groupPath, 'OR')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    group.logic === 'OR' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  OR
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeSubgroup(groupPath, group.id)}
              className="text-red-600 hover:text-red-800 transition-colors p-1 hover:bg-red-50 rounded"
              title="Remove group"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        {isRoot && (
          <div className="mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Main Logic:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => updateGroupLogic(groupPath, 'AND')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    group.logic === 'AND' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  AND
                </button>
                <button
                  type="button"
                  onClick={() => updateGroupLogic(groupPath, 'OR')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    group.logic === 'OR' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  OR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Render conditions */}
        {group.conditions.map(condition => 
          renderCondition(condition, groupPath, depth)
        )}

        {/* Render subgroups */}
        {group.subgroups.map(subgroup => 
          renderGroup(subgroup, [...groupPath, subgroup.id], depth + 1)
        )}

        {/* Add buttons */}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => addConditionToGroup(groupPath)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Condition
          </button>
          
          <button
            type="button"
            onClick={() => addSubgroup(groupPath)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Add Group
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col pointer-events-auto border border-gray-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">
            {editingQuery ? 'Edit Query' : 'Build New Query'}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6">
            {/* Basic Query Info */}
            <div className="mb-6 bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Query Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Query Name *
                  </label>
                  <input
                    type="text"
                    value={queryInfo.name}
                    onChange={(e) => setQueryInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter query name..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Query Color
                  </label>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: queryInfo.color }}
                    />
                    <div className="grid grid-cols-6 gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setQueryInfo(prev => ({ ...prev, color }))}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                            queryInfo.color === color ? 'border-gray-600' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={queryInfo.description}
                  onChange={(e) => setQueryInfo(prev => ({ ...prev, description: e.target.value }))}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter query description..."
                />
              </div>
            </div>

            {/* Query Builder */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Query Conditions</h3>
              
              {isLoadingCategories ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading categories...</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  {renderGroup(queryStructure, ['root'])}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {editingQuery ? 'Update Query' : 'Create Query'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewQueryModal;
