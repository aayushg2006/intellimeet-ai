import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Building, User, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const WorkspaceSwitcher = () => {
  const { token } = useAuthStore();
  const { activeWorkspace, setActiveWorkspace, setOrganizations } = useWorkspaceStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await axios.get('/api/organizations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (organizations.length > 0) {
      setOrganizations(organizations);
    }
  }, [organizations, setOrganizations]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id) => {
    setActiveWorkspace(id);
    setIsOpen(false);
  };

  const activeOrg = organizations.find((org) => org._id === activeWorkspace);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 rounded-lg border border-[#E8E4DD] bg-white px-3 py-1.5 transition-colors hover:bg-[#F5F2EE]"
      >
        {activeWorkspace === 'personal' ? (
          <User size={16} className="text-[#6B6560]" />
        ) : (
          <Building size={16} className="text-[#7C3AED]" />
        )}
        <span className="text-sm font-medium text-[#1A1A1A] max-w-[120px] truncate">
          {activeWorkspace === 'personal' ? 'Personal' : activeOrg?.name || 'Loading...'}
        </span>
        <ChevronDown size={14} className="text-[#6B6560]" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-[60] mt-1 w-56 overflow-hidden rounded-xl border border-[#E8E4DD] bg-white py-1 shadow-lg">
          <div className="px-3 py-2 text-xs font-semibold text-[#6B6560] uppercase tracking-wider">
            Workspaces
          </div>
          <button
            onClick={() => handleSelect('personal')}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-[#F5F2EE] transition-colors ${
              activeWorkspace === 'personal' ? 'bg-[#F5F2EE] font-medium' : 'text-[#1A1A1A]'
            }`}
          >
            <User size={16} className="text-[#6B6560]" />
            Personal Workspace
          </button>
          
          {organizations.length > 0 && (
            <>
              <div className="border-t border-[#E8E4DD] my-1"></div>
              {organizations.map((org) => (
                <button
                  key={org._id}
                  onClick={() => handleSelect(org._id)}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-[#F5F2EE] transition-colors ${
                    activeWorkspace === org._id ? 'bg-[#F5F2EE] font-medium' : 'text-[#1A1A1A]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building size={16} className="text-[#7C3AED] shrink-0" />
                    <span className="truncate">{org.name}</span>
                  </div>
                  {org.userRole === 'OrgAdmin' && (
                    <span className="text-[10px] bg-[#7C3AED]/10 text-[#7C3AED] px-1.5 py-0.5 rounded ml-2 shrink-0">Admin</span>
                  )}
                </button>
              ))}
            </>
          )}

          <div className="border-t border-[#E8E4DD] my-1"></div>
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/org/settings'); // Assuming route for joining/creating orgs
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#7C3AED] hover:bg-[#F5F2EE] transition-colors font-medium text-left"
          >
            Manage Organizations
          </button>
        </div>
      )}
    </div>
  );
};
