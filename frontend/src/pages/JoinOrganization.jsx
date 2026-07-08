import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Loader, Building } from 'lucide-react';

export const JoinOrganization = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { token: authToken } = useAuthStore();
  const { setActiveWorkspace } = useWorkspaceStore();
  const [error, setError] = useState(null);

  const joinOrgMutation = useMutation({
    mutationFn: async (tokenValue) => {
      const res = await axios.post(`/api/organizations/join/${tokenValue}`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.organizationId) {
        setActiveWorkspace(data.organizationId);
      }
      navigate('/dashboard');
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to join organization.');
    }
  });

  useEffect(() => {
    if (authToken && token) {
      joinOrgMutation.mutate(token);
    } else if (!authToken) {
      // Redirect to login, but ideally with returnTo url (not fully implemented yet)
      navigate('/login');
    }
  }, [authToken, token, joinOrgMutation, navigate]);

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-6 text-[#1A1A1A]">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#E8E4DD] max-w-md w-full text-center">
        <Building size={48} className="text-[#7C3AED] mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Joining Organization</h1>
        
        {error ? (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm text-left">
            {error}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-6 text-[#6B6560]">
            <Loader className="animate-spin" size={20} />
            <span>Processing your invite...</span>
          </div>
        )}
        
        {error && (
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 w-full border border-[#E8E4DD] py-2 rounded-xl text-sm font-medium hover:bg-[#F5F2EE] transition"
          >
            Go to Dashboard
          </button>
        )}
      </div>
    </div>
  );
};
